// Safe dynamic import of expo-speech to support both Expo runtime and headless Node test runner
let SpeechModule = null;

async function getSpeechModule() {
  if (!SpeechModule) {
    try {
      SpeechModule = await import('expo-speech');
    } catch {
      try {
        SpeechModule = require('expo-speech');
      } catch (err) {
        console.warn('expo-speech is not available in current environment');
      }
    }
  }
  return SpeechModule;
}

export const FALLBACK_PRIORITY = ['hi', 'en', 'bn'];

export const RELATION_LABELS_BY_LANG = {
  en: {
    'Father': 'Father', 'Mother': 'Mother', 'Son': 'Son', 'Daughter': 'Daughter',
    'Spouse': 'Spouse', 'Friend': 'Friend', 'Grandson': 'Grandson', 'Granddaughter': 'Granddaughter',
    'Brother': 'Brother', 'Sister': 'Sister', 'Daughter-in-law': 'Daughter-in-law',
    'Son-in-law': 'Son-in-law', 'Uncle': 'Uncle', 'Aunty': 'Aunty',
    'Caregiver/Nurse': 'Caregiver', 'Other': 'Family Member'
  },
  hi: {
    'Father': 'पिताजी', 'Mother': 'माताजी', 'Son': 'बेटे', 'Daughter': 'बेटी',
    'Spouse': 'जीवनसाथी', 'Friend': 'मित्र', 'Grandson': 'पोते', 'Granddaughter': 'पोती',
    'Brother': 'भाई', 'Sister': 'बहन', 'Daughter-in-law': 'बहू',
    'Son-in-law': 'दामाद', 'Uncle': 'चाचाजी', 'Aunty': 'चाचीजी',
    'Caregiver/Nurse': 'सहायक', 'Other': 'परिवार के सदस्य'
  },
  as: {
    'Father': 'দেউতা', 'Mother': 'মা', 'Son': 'ল’ৰা', 'Daughter': 'ছোৱালী',
    'Spouse': 'জীৱনসংগী', 'Friend': 'বন্ধু', 'Grandson': 'নাতি', 'Granddaughter': 'নাতিনী',
    'Brother': 'ভাই', 'Sister': 'ভনী', 'Daughter-in-law': 'বোৱাৰী',
    'Son-in-law': 'জোঁৱাই', 'Uncle': 'খুৰা', 'Aunty': 'খুৰী',
    'Caregiver/Nurse': 'শুশ্ৰূষাকাৰী', 'Other': 'পৰিয়ালৰ ব্যক্তি'
  },
  bn: {
    'Father': 'বাবা', 'Mother': 'মা', 'Son': 'ছেলে', 'Daughter': 'মেয়ে',
    'Spouse': 'জীবনসঙ্গী', 'Friend': 'বন্ধু', 'Grandson': 'নাতি', 'Granddaughter': 'নাতনি',
    'Brother': 'ভাই', 'Sister': 'বোন', 'Daughter-in-law': 'বৌমা',
    'Son-in-law': 'জামাই', 'Uncle': 'কাকা', 'Aunty': 'কাকীমা',
    'Caregiver/Nurse': 'সেবিকা', 'Other': 'পরিবারের সদস্য'
  }
};

/**
 * Pure function: Determines the best available TTS voice language given the preferred
 * language and list of available device voices.
 * Fallback order: Preferred -> Hindi ('hi') -> English ('en') -> Bengali ('bn') -> Default 'en-IN'
 */
export function getResolvedTTSLanguage(preferredLang, availableVoices = []) {
  const normPref = (preferredLang || 'en').toLowerCase().split(/[-_]/)[0];

  const hasVoice = (prefix) => {
    if (!availableVoices || availableVoices.length === 0) return false;
    return availableVoices.some((v) => {
      const vLang = (v.language || v.identifier || '').toLowerCase();
      return vLang.startsWith(prefix) || vLang.includes(`-${prefix}`) || vLang.includes(`_${prefix}`);
    });
  };

  // If voices list is empty or unavailable (e.g. web/simulator), use preferred with dialect
  if (!availableVoices || availableVoices.length === 0) {
    if (normPref === 'hi') return 'hi-IN';
    if (normPref === 'bn') return 'bn-IN';
    if (normPref === 'as') return 'as-IN';
    return 'en-IN';
  }

  // 1. Check if preferred language is directly supported
  if (hasVoice(normPref)) {
    return normPref === 'hi' ? 'hi-IN' : normPref === 'bn' ? 'bn-IN' : normPref === 'as' ? 'as-IN' : 'en-IN';
  }

  // 2. Fallback in priority order: Hindi -> English -> Bengali
  for (const fallback of FALLBACK_PRIORITY) {
    if (hasVoice(fallback)) {
      return fallback === 'hi' ? 'hi-IN' : fallback === 'bn' ? 'bn-IN' : 'en-IN';
    }
  }

  // Default ultimate fallback
  return 'en-IN';
}

/**
 * Pure function: Formats dementia-friendly spoken sentence in the resolved language.
 */
export function formatSpokenMemoryText({ personName, relation, notes, language }) {
  const lang = (language || 'en').toLowerCase().split(/[-_]/)[0];
  const relMap = RELATION_LABELS_BY_LANG[lang] || RELATION_LABELS_BY_LANG.en;
  const relText = relMap[relation] || relation || 'Family Member';
  const cleanName = (personName || 'Loved One').trim();
  const cleanNotes = notes ? notes.trim() : '';

  if (lang === 'hi') {
    const base = `यह ${cleanName} हैं, आपके ${relText}।`;
    return cleanNotes ? `${base} ${cleanNotes}` : base;
  }
  if (lang === 'as') {
    const base = `এখেত ${cleanName}, আপোনাৰ ${relText}।`;
    return cleanNotes ? `${base} ${cleanNotes}` : base;
  }
  if (lang === 'bn') {
    const base = `ইনি ${cleanName}, আপনার ${relText}।`;
    return cleanNotes ? `${base} ${cleanNotes}` : base;
  }

  // English default
  const base = `This is ${cleanName}, your ${relText}.`;
  return cleanNotes ? `${base} ${cleanNotes}` : base;
}

/**
 * Spoken audio player using expo-speech with automatic voice availability check and fallback.
 */
export async function speakMemory({
  personName,
  relation,
  notes,
  language = 'en',
  onStart,
  onDone,
  onError
}) {
  try {
    const Speech = await getSpeechModule();
    if (!Speech) {
      if (onDone) onDone();
      return;
    }

    // Stop any existing speech playback
    await stopSpeech();

    let availableVoices = [];
    try {
      if (Speech.getAvailableVoicesAsync) {
        availableVoices = await Speech.getAvailableVoicesAsync();
      }
    } catch (voiceErr) {
      console.warn('Could not enumerate TTS voices:', voiceErr);
    }

    const resolvedLang = getResolvedTTSLanguage(language, availableVoices);
    const spokenText = formatSpokenMemoryText({
      personName,
      relation,
      notes,
      language: resolvedLang.split(/[-_]/)[0],
    });

    Speech.speak(spokenText, {
      language: resolvedLang,
      pitch: 1.0,
      rate: 0.82, // Slower, calm, clear pace for elderly dementia patients
      onStart: () => {
        if (onStart) onStart();
      },
      onDone: () => {
        if (onDone) onDone();
      },
      onStopped: () => {
        if (onDone) onDone();
      },
      onError: (err) => {
        console.warn('Speech playback error:', err);
        if (onError) onError(err);
      },
    });
  } catch (err) {
    console.error('Failed to trigger speech:', err);
    if (onError) onError(err);
  }
}

export async function stopSpeech() {
  try {
    const Speech = await getSpeechModule();
    if (Speech && Speech.isSpeakingAsync) {
      const isSpeaking = await Speech.isSpeakingAsync();
      if (isSpeaking && Speech.stop) {
        await Speech.stop();
      }
    }
  } catch {
    // ignore
  }
}

