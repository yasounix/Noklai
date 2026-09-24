import { supabase } from './supabaseClient.js';

export const getPatientProfile = async (patientId) => {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('patient_id', patientId)
    .single();
  if (error) console.error('Error fetching patient:', error);
  return data;
};

export const savePatientProfile = async (patientData) => {
  try {
    const { data, error } = await supabase
      .from('patients')
      .upsert([patientData], { onConflict: 'patient_id' })
      .select();
    if (error) {
      console.warn('Supabase savePatientProfile error:', error.message || error);
      return null;
    }
    return data;
  } catch (error) {
    console.warn('Supabase savePatientProfile network exception:', error.message || error);
    return null;
  }
};

export const getAllPatients = async () => {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching all patients:', error);
    return [];
  }
};

export const getReminders = async (patientId) => {
  if (!patientId) return [];
  try {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('patient_id', String(patientId))
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Error fetching reminders from Supabase:', error);
      throw error;
    }

    return (data || []).map((item) => ({
      id: String(item.id),
      patient_id: item.patient_id,
      title: item.title,
      time: item.time,
      date: item.date ,
      category: item.category || 'Routine',
      completed: !!item.completed,
      done: !!item.completed,
      completed_at: item.completed_at ,
      created_at: item.created_at,
      created_by: item.created_by || 'patient',
    }));
  } catch (err) {
    console.warn('getReminders fallback error:', err);
    throw err;
  }
};

export const addReminder = async (reminderData) => {
  if (!reminderData || !reminderData.title || !reminderData.patient_id) {
    throw new Error('addReminder: Missing title or patient_id');
  }

  const generatedId = reminderData.id || `rem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const payload = {
    id: String(generatedId),
    patient_id: String(reminderData.patient_id),
    title: String(reminderData.title).trim(),
    time: String(reminderData.time || '12:00 PM').trim(),
    date: reminderData.date ,
    category: reminderData.category || 'Routine',
    completed: !!reminderData.completed,
    completed_at: reminderData.completed ? (reminderData.completed_at || new Date().toISOString()) : null,
    created_by: reminderData.created_by || 'patient',
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('reminders')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Error inserting reminder into Supabase:', error);
      throw error;
    }

    return {
      ...payload,
      ...(data || {}),
      id: String(data?.id || payload.id),
      done: !!(data?.completed ?? payload.completed),
      completed: !!(data?.completed ?? payload.completed),
    };
  } catch (err) {
    console.warn('addReminder network/insert failure, returning local payload:', err);
    return {
      ...payload,
      done: payload.completed,
      _offline: true,
    };
  }
};

export const getFamilyMembers = async (patientId) => {
  const { data, error } = await supabase
    .from('family_members')
    .select('*')
    .eq('patient_id', patientId);
  if (error) {
    console.error('Error fetching family members:', error);
    throw error;
  }
  return data || [];
};

export const addFamilyMember = async (data) => {
  const memberPayload = {
    patient_id: data.patient_id,
    name: data.name,
    relationship: data.relationship,
    description: data.description,
    phone: data.phone ,
    photo_url: data.photo_url,
  };
  const { data: result, error } = await supabase
    .from('family_members')
    .insert([memberPayload])
    .select();
  if (error) {
    console.error('Error adding family member:', error);
    throw error;
  }
  return result;
};

export const deleteFamilyMember = async (id) => {
  const { data, error } = await supabase
    .from('family_members')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('Error deleting family member:', error);
    throw error;
  }
  return data;
};

export const saveGameResult = async (resultData) => {
  try {
    const payload = {
      patient_id: resultData.patient_id,
      game_name: resultData.game_name || 'Brain Exercise',
      score: typeof resultData.score === 'number' ? resultData.score : 10,
      duration: typeof resultData.duration === 'number' ? resultData.duration : 45,
      difficulty: resultData.difficulty
        ? resultData.difficulty.charAt(0).toUpperCase() + resultData.difficulty.slice(1)
        : 'Medium',
      played_at: resultData.played_at || new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('game_results')
      .insert([payload])
      .select();
    if (error) {
      console.warn('Error saving game result to Supabase:', error.message || error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('saveGameResult exception:', err.message || err);
    return null;
  }
};

export const getPatientByCode = async (code) => {
  if (!code) return null;
  const cleanCode = code.trim();
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('patient_id', cleanCode)
      .maybeSingle();
    if (data) return data;

    if (!isNaN(cleanCode)) {
      const { data: numData } = await supabase
        .from('patients')
        .select('*')
        .eq('id', parseInt(cleanCode, 10))
        .maybeSingle();
      if (numData) return numData;
    }
    return null;
  } catch (err) {
    console.warn('getPatientByCode exception:', err.message || err);
    return null;
  }
};

export const getPatientsByCaregiverPhone = async (phone) => {
  if (!phone) return [];
  const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*');
    if (error || !data) return [];

    return data.filter((p) => {
      if (!p.caregiver_phone) return false;
      const cgDigits = p.caregiver_phone.replace(/\D/g, '').slice(-10);
      return cgDigits === cleanPhone;
    });
  } catch (err) {
    console.warn('getPatientsByCaregiverPhone exception:', err);
    return [];
  }
};

export const linkPatientToCaregiver = async (patientId, caregiverPhone, caregiverName = 'Caregiver') => {
  try {
    const cleanPhone = caregiverPhone.trim();
    const { error: pErr } = await supabase
      .from('patients')
      .update({ caregiver_phone: cleanPhone })
      .eq('patient_id', patientId);

    if (pErr) console.warn('linkPatient update caregiver_phone warning:', pErr.message);

    const { data: existingFm } = await supabase
      .from('family_members')
      .select('id')
      .eq('patient_id', patientId)
      .eq('relationship', 'Primary Caregiver')
      .maybeSingle();

    if (existingFm) {
      await supabase
        .from('family_members')
        .update({ name: caregiverName, phone: cleanPhone })
        .eq('id', existingFm.id);
    } else {
      await supabase
        .from('family_members')
        .insert([{
          patient_id: patientId,
          name: caregiverName,
          relationship: 'Primary Caregiver',
          description: 'Linked Family Caregiver monitoring cognitive vitality.',
          phone: cleanPhone,
        }]);
    }

    return true;
  } catch (err) {
    console.warn('linkPatientToCaregiver exception:', err);
    return false;
  }
};

export const getRemoteGameSessions = async (patientId) => {
  if (!patientId) return [];
  try {
    const [resultsRes, perfRes] = await Promise.all([
      supabase
        .from('game_results')
        .select('*')
        .eq('patient_id', patientId)
        .order('played_at', { ascending: false }),
      supabase
        .from('game_performance')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false }),
    ]);

    const results = resultsRes.data || [];
    const performances = perfRes.data || [];

    return results.map((r) => {
      const gName = r.game_name || 'Brain Exercise';
      const gId = gName.toLowerCase().includes('suh')
        ? 'suh_tah_lam'
        : gName.toLowerCase().includes('dhop')
        ? 'dhop_khel'
        : gName.toLowerCase().includes('ubila')
        ? 'ubilakapki'
        : gName.toLowerCase().includes('story') || gName.toLowerCase().includes('xuwo')
        ? 'memory_stories'
        : 'northeast_memory';

      const relatedPerfs = performances.filter((p) => p.game_name === r.game_name);
      const validRts = relatedPerfs
        .map((p) => p.response_time)
        .filter((t) => typeof t === 'number' && t > 0);
      const avgRt =
        validRts.length > 0
          ? Math.round((validRts.reduce((a, b) => a + b, 0) / validRts.length) * 10) / 10
          : null;

      const scoreNum = typeof r.score === 'number' ? r.score : null;
      const totalAttempts = relatedPerfs.length;
      const correctAttempts = relatedPerfs.filter((p) => p.is_correct === true).length;

      let genuineAccuracy = null;
      if (totalAttempts > 0) {
        genuineAccuracy = Math.round((correctAttempts / totalAttempts) * 100);
      } else if (scoreNum !== null) {
        // If score is normalized 0-10 or 0-100
        genuineAccuracy = scoreNum <= 10 ? Math.round(scoreNum * 10) : Math.min(100, Math.round(scoreNum));
      }

      const durationSec = typeof r.duration === 'number' && r.duration >= 0 ? r.duration : 0;

      return {
        id: `supabase_gr_${r.id}`,
        patientId: r.patient_id,
        gameId: gId,
        gameName: gName,
        difficulty: (r.difficulty || 'Medium').toLowerCase(),
        durationSec,
        questionsTotal: totalAttempts > 0 ? totalAttempts : (scoreNum !== null ? 1 : 0),
        questionsCorrect: totalAttempts > 0 ? correctAttempts : (scoreNum !== null && scoreNum > 0 ? 1 : 0),
        accuracy: genuineAccuracy,
        responseTimeSec: avgRt,
        score: scoreNum !== null ? scoreNum : 0,
        maxScore: 10,
        timestamp: r.played_at ,
        metadata: {
          eligibleForCVI: genuineAccuracy !== null,
          source: 'supabase_remote',
        },
      };
    });
  } catch (err) {
    console.warn('getRemoteGameSessions exception:', err);
    return [];
  }
};

export const updateReminder = async (id, updates) => {
  if (!id) return null;
  const cleanUpdates = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // If completed changed, manage completed_at
  if (typeof updates.completed === 'boolean') {
    if (updates.completed && !updates.completed_at) {
      cleanUpdates.completed_at = new Date().toISOString();
    } else if (!updates.completed) {
      cleanUpdates.completed_at = null;
    }
  }

  try {
    const { data, error } = await supabase
      .from('reminders')
      .update(cleanUpdates)
      .eq('id', String(id))
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Error updating reminder in Supabase:', error);
      throw error;
    }
    return data;
  } catch (err) {
    console.warn('updateReminder fallback error:', err);
    return { id: String(id), ...cleanUpdates };
  }
};

export const toggleReminder = async (id, completed) => {
  return updateReminder(id, {
    completed: !!completed,
    completed_at: completed ? new Date().toISOString() : null,
  });
};

export const deleteReminder = async (id) => {
  if (!id) return { success: false };
  try {
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', String(id));

    if (error) {
      console.warn('Error deleting reminder from Supabase:', error);
      throw error;
    }
    return { success: true, id: String(id) };
  } catch (err) {
    console.warn('deleteReminder fallback error:', err);
    return { success: false, id: String(id), error: err.message };
  }
};

export const syncOfflineReminders = async (patientId, localReminders = [], pendingDeletions = []) => {
  if (!patientId) return localReminders;

  // 1. Process pending deletions on remote
  if (Array.isArray(pendingDeletions) && pendingDeletions.length > 0) {
    for (const delId of pendingDeletions) {
      try {
        await supabase.from('reminders').delete().eq('id', String(delId));
      } catch (e) {
        // Continue
      }
    }
  }

  // 2. Push any locally created/modified items that are marked offline or missing on remote
  const offlineItems = localReminders.filter((item) => item._offline);
  for (const item of offlineItems) {
    try {
      const payload = {
        id: String(item.id),
        patient_id: String(patientId),
        title: item.title,
        time: item.time,
        date: item.date ,
        category: item.category || 'Routine',
        completed: !!(item.completed || item.done),
        completed_at: item.completed_at ,
        created_by: item.created_by || 'patient',
        updated_at: new Date().toISOString(),
      };
      await supabase.from('reminders').upsert([payload]);
    } catch (e) {
      // Continue
    }
  }

  // 3. Fetch latest canonical list from remote
  try {
    const remoteList = await getReminders(patientId);
    if (Array.isArray(remoteList)) {
      const map = new Map();
      // First populate with remote items
      remoteList.forEach((r) => map.set(String(r.id), r));
      // If there are local items not yet synced (e.g. still offline error), preserve them
      localReminders.forEach((loc) => {
        if (!map.has(String(loc.id)) && !pendingDeletions.includes(String(loc.id))) {
          map.set(String(loc.id), loc);
        }
      });
      return Array.from(map.values());
    }
  } catch (e) {
    // If still offline, keep local list minus pending deletions
    return localReminders.filter((loc) => !pendingDeletions.includes(String(loc.id)));
  }

  return localReminders;
};

export const getNextMemoryScene = async (patientId) => {
  try {
    // Get scenes the patient has NOT seen
    const { data: seen } = await supabase
      .from('player_scene_history')
      .select('scene_id')
      .eq('patient_id', patientId);
    
    const seenIds = seen?.map(s => s.scene_id).filter(Boolean) || [];
    
    let query = supabase
      .from('memory_scenes')
      .select('*')
      .eq('active', true);
    
    if (seenIds.length > 0) {
      query = query.not('scene_id', 'in', `(${seenIds.join(',')})`);
    }
    
    const { data } = await query.limit(1).maybeSingle();
    if (data) return data;

    // Fallback: If all scenes have been seen, return any active scene so the player can always play
    const { data: fallback } = await supabase
      .from('memory_scenes')
      .select('*')
      .eq('active', true)
      .limit(1)
      .maybeSingle();

    return fallback ;
  } catch (err) {
    console.error('Error in getNextMemoryScene:', err);
    return null;
  }
};

export const getSceneQuestions = async (sceneId) => {
  try {
    const { data, error } = await supabase
      .from('memory_questions')
      .select('*')
      .eq('scene_id', sceneId)
      .eq('active', true);
    if (error) {
      console.error('Error in getSceneQuestions:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Error in getSceneQuestions exception:', err);
    return [];
  }
};

export const recordSceneView = async (patientId, sceneId) => {
  const { error } = await supabase
    .from('player_scene_history')
    .insert([{ patient_id: patientId, scene_id: sceneId }]);
  if (error) console.error(error);
};

export const recordPerformance = async (data) => {
  const { error } = await supabase
    .from('game_performance')
    .insert([data]);
  if (error) console.error(error);
};