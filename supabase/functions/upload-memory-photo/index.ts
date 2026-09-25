import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_RELATIONS = new Set([
  "Father", "Mother", "Son", "Daughter", "Spouse",
  "Friend", "Grandson", "Granddaughter", "Brother", "Sister",
  "Daughter-in-law", "Son-in-law", "Uncle", "Aunty",
  "Caregiver/Nurse", "Other"
]);

// Helper to validate MIME using magic numbers
function validateMagicBytes(bytes: Uint8Array): { valid: boolean; mime: string; ext: string } {
  // JPEG magic bytes: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { valid: true, mime: "image/jpeg", ext: "jpg" };
  }
  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4E &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0D &&
    bytes[5] === 0x0A &&
    bytes[6] === 0x1A &&
    bytes[7] === 0x0A
  ) {
    return { valid: true, mime: "image/png", ext: "png" };
  }
  return { valid: false, mime: "", ext: "" };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Client for token verification
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerId = user.id;

    // Parse multipart form-data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid form data payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const file = formData.get("photo") as File | null;
    const patientId = formData.get("patient_id") as string | null;
    const personName = (formData.get("person_name") as string | null)?.trim();
    const relation = (formData.get("relation") as string | null)?.trim();
    const notes = (formData.get("notes") as string | null)?.trim() || null;

    if (!file || !patientId || !personName || !relation) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: photo, patient_id, person_name, relation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ALLOWED_RELATIONS.has(relation)) {
      return new Response(
        JSON.stringify({ error: "Invalid relation type selected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enforce 5MB limit
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: "File size exceeds 5MB limit" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inspect file buffer for magic bytes
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const magicCheck = validateMagicBytes(bytes);

    if (!magicCheck.valid) {
      return new Response(
        JSON.stringify({ error: "Invalid image format. Only JPEG and PNG images are allowed." }),
        { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin/Service Role client for DB operations and storage
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Explicit ownership / caregiver link check (Layer 2 defense)
    if (callerId !== patientId) {
      const { data: link, error: linkError } = await adminClient
        .from("patient_caregiver_links")
        .select("id")
        .eq("patient_id", patientId)
        .eq("caregiver_id", callerId)
        .maybeSingle();

      if (linkError || !link) {
        return new Response(
          JSON.stringify({ error: "Forbidden: You are not authorized to upload memories for this patient" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Prepare storage path: {patient_id}/{uuid}.jpg
    const memoryId = crypto.randomUUID();
    const filePath = `${patientId}/${memoryId}.${magicCheck.ext}`;

    // Upload to private bucket "memory-photos"
    const { error: storageError } = await adminClient.storage
      .from("memory-photos")
      .upload(filePath, bytes, {
        contentType: magicCheck.mime,
        upsert: false,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError.message);
      return new Response(
        JSON.stringify({ error: "Failed to store image file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert record into public.memories (triggers photo limit and daily upload limit checks)
    const { data: memoryRecord, error: dbError } = await adminClient
      .from("memories")
      .insert({
        id: memoryId,
        patient_id: patientId,
        uploaded_by: callerId,
        person_name: personName,
        relation: relation,
        notes: notes,
        image_path: filePath,
        file_size_bytes: file.size,
        mime_type: magicCheck.mime,
        is_deleted: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError.message);
      // Clean up orphaned storage upload
      await adminClient.storage.from("memory-photos").remove([filePath]);

      let userErrorMessage = "Failed to save memory record";
      if (dbError.message.includes("Photo limit reached")) {
        userErrorMessage = "Photo limit reached (maximum 150 active photos per patient allowed)";
      } else if (dbError.message.includes("Daily upload limit reached")) {
        userErrorMessage = "Daily upload limit reached (maximum 30 uploads per 24 hours allowed)";
      }

      return new Response(
        JSON.stringify({ error: userErrorMessage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate 1-hour signed URL (3600 seconds)
    const { data: signedData } = await adminClient.storage
      .from("memory-photos")
      .createSignedUrl(filePath, 3600);

    return new Response(
      JSON.stringify({
        success: true,
        memory: {
          ...memoryRecord,
          signed_url: signedData?.signedUrl || null,
        },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error in upload-memory-photo:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred during photo upload" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

