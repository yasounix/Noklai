import { supabase, supabaseUrl } from '../modules/supabaseClient';

export const RELATION_OPTIONS = [
  'Father', 'Mother', 'Son', 'Daughter', 'Spouse',
  'Friend', 'Grandson', 'Granddaughter', 'Brother', 'Sister',
  'Daughter-in-law', 'Son-in-law', 'Uncle', 'Aunty',
  'Caregiver/Nurse', 'Other'
];

export const MemoryService = {
  /**
   * Fetches all active (non-deleted) memories for a patient,
   * generating 1-hour signed URLs for each private photo.
   */
  async fetchMemories(patientId) {
    if (!patientId) return { memories: [], error: 'Patient ID is required' };

    try {
      const cleanId = String(patientId).trim();
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .eq('patient_id', cleanId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error querying memories:', error.message);
        return { memories: [], error: error.message };
      }

      if (!data || data.length === 0) {
        return { memories: [], error: null };
      }

      // Generate 1-hour signed URLs (3600 seconds)
      const memoriesWithUrls = await Promise.all(
        data.map(async (item) => {
          try {
            const { data: signedData, error: signError } = await supabase.storage
              .from('memory-photos')
              .createSignedUrl(item.image_path, 3600);

            return {
              ...item,
              signed_url: signError ? null : signedData?.signedUrl,
            };
          } catch {
            return { ...item, signed_url: null };
          }
        })
      );

      return { memories: memoriesWithUrls, error: null };
    } catch (err) {
      console.error('Unexpected error fetching memories:', err);
      return { memories: [], error: 'An error occurred while loading memories.' };
    }
  },

  /**
   * Securely uploads a memory photo via the Supabase Edge Function.
   * Enforces 5MB limit, server-side MIME inspection, daily rate limit (30/day),
   * and patient quota (150 max).
   */
  async uploadMemoryPhoto({ photoUri, base64, patientId, personName, relation, notes, mimeType }) {
    if (!photoUri || !patientId || !personName || !relation) {
      return { success: false, error: 'Please provide all required fields.' };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.access_token) {
        return { success: false, error: 'Authentication required. Please sign in to upload photos.' };
      }

      const token = session.access_token;
      let rawMime = (mimeType || (photoUri.endsWith('.png') ? 'image/png' : 'image/jpeg')).toLowerCase().trim();
      if (rawMime === 'image/jpg') rawMime = 'image/jpeg';
      const detectedMime = rawMime;
      const filename = photoUri.split('/').pop() || 'photo.jpg';

      if (detectedMime !== 'image/jpeg' && detectedMime !== 'image/png') {
        return {
          success: false,
          error: 'Invalid image format. Only JPEG and PNG images are allowed.',
        };
      }

      // [TEMPORARY DIAGNOSTIC LOG]
      console.log('[MemoryService DIAGNOSTIC] Image input:', {
        photoUri,
        uriScheme: photoUri?.split(':')[0],
        hasBase64: Boolean(base64),
        incomingMime: mimeType,
        detectedMime,
        filename,
      });

      let uint8Array = null;

      if (base64) {
        if (typeof atob === 'function') {
          const binaryString = atob(base64);
          const len = binaryString.length;
          uint8Array = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
          }
        } else {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
          const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
          const len = clean.length;
          const placeHolders = clean.charAt(len - 2) === '=' ? 2 : clean.charAt(len - 1) === '=' ? 1 : 0;
          uint8Array = new Uint8Array((len * 3 / 4) - placeHolders);
          let j = 0;
          for (let i = 0; i < len; i += 4) {
            const a = chars.indexOf(clean.charAt(i));
            const b = chars.indexOf(clean.charAt(i + 1));
            const c = chars.indexOf(clean.charAt(i + 2));
            const d = chars.indexOf(clean.charAt(i + 3));
            uint8Array[j++] = (a << 2) | (b >> 4);
            if (c !== -1 && j < uint8Array.length) uint8Array[j++] = ((b & 15) << 4) | (c >> 2);
            if (d !== -1 && j < uint8Array.length) uint8Array[j++] = ((c & 3) << 6) | d;
          }
        }
      } else {
        // Fallback: read via expo-file-system legacy
        try {
          const FileSystem = require('expo-file-system/legacy');
          const fileBase64 = await FileSystem.readAsStringAsync(photoUri, {
            encoding: FileSystem.EncodingType?.Base64 || 'base64',
          });
          if (fileBase64) {
            const binaryString = atob(fileBase64);
            const len = binaryString.length;
            uint8Array = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              uint8Array[i] = binaryString.charCodeAt(i);
            }
          }
        } catch (fsErr) {
          console.warn('[MemoryService] FileSystem read error:', fsErr);
        }
      }

      if (!uint8Array || uint8Array.byteLength === 0) {
        return { success: false, error: 'Could not read photo data' };
      }

      if (uint8Array.byteLength > 5 * 1024 * 1024) {
        return { success: false, error: 'Photo exceeds 5MB limit.' };
      }

      // Check first bytes: JPEG starts with ff d8 ff, PNG with 89 50 4e 47
      const isJpeg = uint8Array.length >= 3 && uint8Array[0] === 0xff && uint8Array[1] === 0xd8 && uint8Array[2] === 0xff;
      const isPng = uint8Array.length >= 8 && uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4e && uint8Array[3] === 0x47;

      const first4BytesHex = Array.from(uint8Array.slice(0, 4))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');

      // [TEMPORARY DIAGNOSTIC LOG]
      console.log('[MemoryService DIAGNOSTIC] Buffer inspection:', {
        byteLength: uint8Array.byteLength,
        first4BytesHex,
        isJpeg,
        isPng,
      });

      if (!isJpeg && !isPng) {
        return { success: false, error: 'Could not read photo data' };
      }

      // Note: The bytes() duck-typing pattern below depends on Expo winter fetch internals (convertFormData.ts)
      const photoPart = {
        name: filename,
        type: detectedMime,
        size: uint8Array.byteLength,
        bytes: async () => uint8Array,
      };

      // [TEMPORARY DEBUG LOG] To verify file object construction - remove after testing
      console.log('[MemoryService] Prepared photo for upload:', {
        name: filename,
        size: uint8Array.byteLength,
        type: detectedMime,
      });

      const formData = new FormData();
      formData.append('photo', photoPart);
      formData.append('patient_id', patientId);
      formData.append('person_name', personName.trim());
      formData.append('relation', relation);
      if (notes) {
        formData.append('notes', notes.trim());
      }

      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/upload-memory-photo`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const responseText = await response.text();

      // [TEMPORARY DIAGNOSTIC LOG]
      console.log('[MemoryService DIAGNOSTIC] Edge Function response:', {
        status: response.status,
        ok: response.ok,
        body: responseText,
      });

      let responseJson = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        // Non-JSON response (e.g. gateway error HTML or plain text)
      }

      if (!response.ok) {
        const serverError = responseJson?.error || (responseText && responseText.length < 200 ? responseText.trim() : null);
        return {
          success: false,
          error: serverError || `Upload failed (HTTP ${response.status})`,
        };
      }

      return {
        success: true,
        memory: responseJson?.memory,
      };
    } catch (err) {
      console.error('Upload error in MemoryService:', err, err?.stack);
      return { success: false, error: 'Network error during upload. Please verify your connection.' };
    }
  },

  /**
   * Updates an existing memory's name, relation, or notes.
   */
  async updateMemory({ memoryId, personName, relation, notes }) {
    if (!memoryId || !personName || !relation) {
      return { success: false, error: 'Required fields missing' };
    }

    try {
      const { data, error } = await supabase
        .from('memories')
        .update({
          person_name: personName.trim(),
          relation: relation,
          notes: notes ? notes.trim() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memoryId)
        .select()
        .single();

      if (error) {
        console.warn('Update memory error:', error.message);
        return { success: false, error: 'Failed to update details.' };
      }

      return { success: true, memory: data };
    } catch (err) {
      return { success: false, error: 'Could not update memory.' };
    }
  },

  /**
   * Soft-deletes a memory (sets is_deleted = true, deleted_at = now()).
   * Restricted by RLS to the uploader or a primary caregiver.
   */
  async softDeleteMemory(memoryId) {
    if (!memoryId) return { success: false, error: 'Memory ID is required' };

    try {
      const { data, error } = await supabase
        .from('memories')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', memoryId)
        .select()
        .single();

      if (error) {
        console.warn('Soft delete error:', error.message);
        return {
          success: false,
          error: 'Could not delete memory. Only linked caregivers or uploaders have delete permission.',
        };
      }

      return { success: true, memory: data };
    } catch (err) {
      return { success: false, error: 'An error occurred while deleting the memory.' };
    }
  },

  /**
   * Fetches linked patient/caregiver info and primary status
   */
  async getCaregiverLink(patientId, caregiverId) {
    if (!patientId || !caregiverId) return null;
    try {
      const cleanId = String(patientId).trim();
      const { data, error } = await supabase
        .from('patient_caregiver_links')
        .select('*')
        .eq('patient_id', cleanId)
        .eq('caregiver_id', caregiverId)
        .maybeSingle();

      if (error || !data) return null;
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Links a caregiver to a patient directly (active immediately)
   */
  async linkCaregiverToPatient(patientId, caregiverId, relation = 'Caregiver') {
    if (!patientId || !caregiverId) return { success: false };
    try {
      const cleanId = String(patientId).trim();
      const { data, error } = await supabase
        .from('patient_caregiver_links')
        .upsert(
          {
            patient_id: cleanId,
            caregiver_id: caregiverId,
            relation: relation || 'Caregiver',
          },
          { onConflict: 'patient_id,caregiver_id' }
        );
      return { success: !error, error: error?.message };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
};

