import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePatient } from '../../context/PatientContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { cognitiveAnalytics } from '../../modules/performance/CognitiveAnalyticsService';
import {
  getReminders,
  addReminder as dbAddReminder,
  updateReminder as dbUpdateReminder,
  toggleReminder as dbToggleReminder,
  deleteReminder as dbDeleteReminder,
  syncOfflineReminders,
  getPatientByCode,
  getPatientsByCaregiverPhone,
  linkPatientToCaregiver,
  savePatientProfile,
} from '../../modules/database';
import { supabase } from '../../modules/supabaseClient';
import { checkAndResetDailyReminders, sortReminders } from '../../modules/remindersHelper';

const NoklaiContext = createContext();

const STORAGE_KEYS = {
  CURRENT_ROLE: '@noklai_current_role',
  ONBOARDING_SEEN: '@noklai_onboarding_seen',
  LOCAL_REMINDERS_PREFIX: '@noklai_local_reminders_',
  PENDING_REMINDER_DELETIONS_PREFIX: '@noklai_pending_del_reminders_',
  CAREGIVER_NAME: '@noklai_caregiver_name',
  CAREGIVER_PHONE: '@noklai_caregiver_phone',
  CAREGIVER_GENDER: '@noklai_caregiver_gender',
  PATIENT_NAME: '@noklai_patient_name',
  PATIENT_PHONE: '@noklai_patient_phone',
  PATIENT_GENDER: '@noklai_patient_gender',
  SETUP_COMPLETED: '@noklai_setup_completed',
};

export function NoklaiProvider({ children }) {
  const {
    patientId: existingPatientId,
    patientName: existingPatientName,
    patientAge: existingPatientAge,
    patientPhone: existingPatientPhone,
    caregiverName: existingCaregiverName,
    caregiverPhone: existingCaregiverPhone,
    relationship: existingRelationship,
    savePatientSetup,
    selectPatient,
  } = usePatient();

  const { isDarkMode } = useTheme();
  const { currentLanguage, t } = useLanguage();

  const [currentStep, setCurrentStep] = useState('launch'); // 'launch' | 'login' | 'role_select' | 'main'
  const [role, setRole] = useState(null);                   // 'caregiver' | 'patient' | null
  const [caregiverName, setCaregiverName] = useState(existingCaregiverName || '');
  const [caregiverPhone, setCaregiverPhone] = useState(existingCaregiverPhone || '');
  const [caregiverGender, setCaregiverGender] = useState('female'); // 'female' | 'male'
  const [activePatientId, setActivePatientId] = useState(existingPatientId || null);
  const [activePatientName, setActivePatientName] = useState(existingPatientName || '');
  const [patientPhone, setPatientPhone] = useState(existingPatientPhone || '');
  const [patientGender, setPatientGender] = useState('female');     // 'female' | 'male'
  const [hasCompletedSetup, setHasCompletedSetup] = useState(false);

  const patientContextSyncedRef = useRef(false);

  // Sync patientId once when PatientContext loads from storage without re-triggering loops
  useEffect(() => {
    if (!patientContextSyncedRef.current) {
      if (existingPatientId && existingPatientId !== activePatientId) {
        setActivePatientId(existingPatientId);
        patientContextSyncedRef.current = true;
      }
      if (existingPatientName && existingPatientName !== activePatientName) {
        setActivePatientName(existingPatientName);
        patientContextSyncedRef.current = true;
      }
    }
  }, [existingPatientId, existingPatientName, activePatientId, activePatientName]);

  const caregiverAvatar = caregiverGender === 'male' ? '👨' : '👩';
  const patientAvatar = patientGender === 'male' ? '👴' : '👵';

  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [activeCaregiverSubScreen, setActiveCaregiverSubScreen] = useState(null);
  const [activePatientGame, setActivePatientGame] = useState(null);

  // Patients List
  const [patients, setPatients] = useState([]);

  // Active Patient Object
  const activePatient = useMemo(() => {
    if (!activePatientId) return null;
    const found = patients.find((p) => p.id === activePatientId);
    if (found) {
      return {
        ...found,
        avatarText: found.gender === 'male' ? '👴' : (found.avatarText || patientAvatar),
      };
    }
    return {
      id: activePatientId,
      name: activePatientName || '',
      age: existingPatientAge || '',
      relation: existingRelationship || '',
      avatarText: patientAvatar,
    };
  }, [patients, activePatientId, activePatientName, existingPatientAge, existingRelationship, patientAvatar]);

  // Reminders & Analytics
  const [reminders, setReminders] = useState([]);
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [allSessions, setAllSessions] = useState([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);

  const hasInitializedRef = useRef(false);

  // Load saved credentials, role, and setup status (runs once on mount)
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    async function initNoklai() {
      try {
        const [
          savedRole,
          setupCompleted,
          savedCaregiverName,
          savedCaregiverPhone,
          savedCaregiverGender,
          savedPatientName,
          savedPatientPhone,
          savedPatientGender,
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.CURRENT_ROLE),
          AsyncStorage.getItem(STORAGE_KEYS.SETUP_COMPLETED),
          AsyncStorage.getItem(STORAGE_KEYS.CAREGIVER_NAME),
          AsyncStorage.getItem(STORAGE_KEYS.CAREGIVER_PHONE),
          AsyncStorage.getItem(STORAGE_KEYS.CAREGIVER_GENDER),
          AsyncStorage.getItem(STORAGE_KEYS.PATIENT_NAME),
          AsyncStorage.getItem(STORAGE_KEYS.PATIENT_PHONE),
          AsyncStorage.getItem(STORAGE_KEYS.PATIENT_GENDER),
        ]);

        if (savedCaregiverName) setCaregiverName(savedCaregiverName);
        if (savedCaregiverPhone) setCaregiverPhone(savedCaregiverPhone);
        if (savedCaregiverGender) setCaregiverGender(savedCaregiverGender);
        if (savedPatientGender) setPatientGender(savedPatientGender);
        if (savedPatientName) {
          setActivePatientName(savedPatientName);
          setPatients((prev) =>
            prev.map((p) => ({
              ...p,
              name: savedPatientName,
              gender: savedPatientGender || p.gender,
              avatarText: (savedPatientGender || p.gender) === 'male' ? '👴' : '👵',
            }))
          );
        }
        if (savedPatientPhone) setPatientPhone(savedPatientPhone);

        const isSetup = setupCompleted === 'true' || !!savedCaregiverName || !!existingPatientName;
        setHasCompletedSetup(isSetup);

        if (savedRole) setRole(savedRole);
        if (isSetup && savedRole) {
          setCurrentStep('main');
        }
      } catch (e) {
        console.warn('Error reading saved Noklai credentials:', e);
      }
    }
    initNoklai();
  }, []);

  // Save Caregiver & Patient Credentials
  const saveCredentials = useCallback(async ({
    caregiverName: newCaregiverName,
    caregiverPhone: newCaregiverPhone,
    caregiverGender: newCaregiverGender,
    patientName: newPatientName,
    patientPhone: newPatientPhone,
    patientGender: newPatientGender,
  }) => {
    setCaregiverName(newCaregiverName);
    setCaregiverPhone(newCaregiverPhone || '');
    if (newCaregiverGender) setCaregiverGender(newCaregiverGender);
    setActivePatientName(newPatientName);
    setPatientPhone(newPatientPhone || '');
    if (newPatientGender) setPatientGender(newPatientGender);
    setHasCompletedSetup(true);

    const patGender = newPatientGender || patientGender;
    const patAvatar = patGender === 'male' ? '👴' : '👵';

    // Update patients list
    setPatients((prev) =>
      prev.map((p) => (p.id === activePatientId ? {
        ...p,
        name: newPatientName,
        gender: patGender,
        avatarText: patAvatar,
      } : p))
    );

    // Persist to AsyncStorage
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.CAREGIVER_NAME, newCaregiverName],
        [STORAGE_KEYS.CAREGIVER_PHONE, newCaregiverPhone || ''],
        [STORAGE_KEYS.CAREGIVER_GENDER, newCaregiverGender || caregiverGender],
        [STORAGE_KEYS.PATIENT_NAME, newPatientName],
        [STORAGE_KEYS.PATIENT_PHONE, newPatientPhone || ''],
        [STORAGE_KEYS.PATIENT_GENDER, newPatientGender || patientGender],
        [STORAGE_KEYS.SETUP_COMPLETED, 'true'],
      ]);
    } catch (e) {
      console.warn('AsyncStorage save error:', e);
    }

    // Sync with global PatientContext if available
    if (savePatientSetup) {
      try {
        await savePatientSetup({
          patientId: activePatientId || existingPatientId ,
          caregiverName: newCaregiverName,
          caregiverPhone: newCaregiverPhone || '',
          patientName: newPatientName,
          patientPhone: newPatientPhone || '',
        });
      } catch (e) {
        // Continue safely offline
      }
    }

    // Sync to Supabase patients table
    try {
      await savePatientProfile({
        patient_id: activePatientId || existingPatientId ,
        name: newPatientName,
        caregiver_phone: newCaregiverPhone ,
        patient_phone: newPatientPhone ,
        gender: patGender,
      });
    } catch (e) {
      // Continue safely offline
    }
  }, [activePatientId, existingPatientId, savePatientSetup]);

  // Load REAL Reminders (Offline-First + Supabase Sync)
  const loadReminders = useCallback(async () => {
    if (!activePatientId) {
      setReminders([]);
      setLoadingReminders(false);
      return;
    }
    setLoadingReminders(true);
    try {
      const storageKey = `${STORAGE_KEYS.LOCAL_REMINDERS_PREFIX}${activePatientId}`;
      const delKey = `${STORAGE_KEYS.PENDING_REMINDER_DELETIONS_PREFIX}${activePatientId}`;
      let localList = [];
      let pendingDeletions = [];

      const [localRaw, delRaw] = await Promise.all([
        AsyncStorage.getItem(storageKey),
        AsyncStorage.getItem(delKey),
      ]);

      if (localRaw) {
        try {
          localList = JSON.parse(localRaw) || [];
        } catch (e) {
          localList = [];
        }
      }

      if (delRaw) {
        try {
          pendingDeletions = JSON.parse(delRaw) || [];
        } catch (e) {
          pendingDeletions = [];
        }
      }

      // 1. Reset daily reminders if calendar day changed
      localList = checkAndResetDailyReminders(localList);

      // 2. Set optimistic local list sorted by urgency
      setReminders(sortReminders(localList));

      // 3. Attempt sync with Supabase
      try {
        const syncedList = await syncOfflineReminders(activePatientId, localList, pendingDeletions);
        if (Array.isArray(syncedList)) {
          const finalClean = sortReminders(checkAndResetDailyReminders(syncedList));
          setReminders(finalClean);
          await AsyncStorage.setItem(storageKey, JSON.stringify(finalClean));
          if (pendingDeletions.length > 0) {
            await AsyncStorage.removeItem(delKey);
          }
        }
      } catch (syncErr) {
        console.warn('loadReminders sync note:', syncErr.message);
      }
    } catch (err) {
      console.warn('Error loading reminders:', err);
    } finally {
      setLoadingReminders(false);
    }
  }, [activePatientId]);

  // Load REAL Analytics & Sessions
  const loadAnalytics = useCallback(async () => {
    if (!activePatientId) {
      setAnalyticsData(null);
      setAllSessions([]);
      setIsLoadingAnalytics(false);
      return;
    }

    setIsLoadingAnalytics(true);
    try {
      const patientInfo = {
        patientId: activePatientId,
        patientName: activePatientName || '',
        patientAge: existingPatientAge || '',
        caregiverName: caregiverName || '',
        relationship: existingRelationship || '',
      };

      const [dashboard, sessions] = await Promise.all([
        cognitiveAnalytics.getCaregiverDashboardData('7d', patientInfo),
        cognitiveAnalytics.getMergedSessions(activePatientId),
      ]);

      setAnalyticsData(dashboard);
      const patientSessions = (sessions || []).filter((s) => s && s.patientId === activePatientId);
      setAllSessions(patientSessions.reverse());
    } catch (err) {
      console.warn('Error loading real cognitive analytics:', err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [activePatientId, activePatientName, caregiverName, existingPatientAge, existingRelationship]);

  // Load Linked Patients from Supabase based on caregiver's phone
  const loadLinkedPatients = useCallback(async (cgPhone = null) => {
    const targetPhone = cgPhone || caregiverPhone;
    if (!targetPhone) return;

    try {
      const remotePatients = await getPatientsByCaregiverPhone(targetPhone);
      if (Array.isArray(remotePatients) && remotePatients.length > 0) {
        setPatients((prev) => {
          const map = new Map();
          prev.forEach((p) => map.set(p.id, p));
          remotePatients.forEach((rp) => {
            const isMale = (rp.gender || '').toLowerCase() === 'male';
            map.set(rp.patient_id, {
              id: rp.patient_id,
              name: rp.name || 'Loved One',
              age: rp.age ? String(rp.age) : '72',
              gender: rp.gender || 'female',
              connectedSince: rp.created_at
                ? new Date(rp.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                : 'Recent',
              activeToday: true,
              relation: 'Loved One',
              status: 'Connected via phone',
              avatarText: isMale ? '👴' : '👵',
              caregiverPhone: rp.caregiver_phone,
            });
          });
          return Array.from(map.values());
        });

        // Set active patient if current is default and remote has different ID
        if ((!activePatientId || activePatientId === null) && remotePatients[0].patient_id && remotePatients[0].patient_id !== activePatientId) {
          setActivePatientId(remotePatients[0].patient_id);
          if (remotePatients[0].name) {
            setActivePatientName(remotePatients[0].name);
            if (typeof selectPatient === 'function') {
              selectPatient(remotePatients[0].patient_id, remotePatients[0].name);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Could not load linked patients from Supabase:', err);
    }
  }, [caregiverPhone, activePatientId, selectPatient]);

  // Link a Patient by Invite Code (e.g. "P001" or "P_1789648234497")
  const linkPatientByInviteCode = useCallback(async (inviteCode) => {
    if (!inviteCode || !inviteCode.trim()) {
      return { success: false, message: 'Please enter a valid patient connection code.' };
    }

    try {
      const cleanCode = inviteCode.trim();
      const patientData = await getPatientByCode(cleanCode);

      if (!patientData) {
        return {
          success: false,
          message: `No patient found with code "${cleanCode}". Please verify the code on the elder's screen.`,
        };
      }

      // Found patient! Link with current caregiver in Supabase
      if (caregiverPhone) {
        await linkPatientToCaregiver(patientData.patient_id, caregiverPhone, caregiverName);
      }

      const isMale = (patientData.gender || '').toLowerCase() === 'male';
      const formatted = {
        id: patientData.patient_id,
        name: patientData.name || 'Loved One',
        age: patientData.age ? String(patientData.age) : '72',
        gender: patientData.gender || 'female',
        connectedSince: 'Today',
        activeToday: true,
        relation: 'Loved One',
        status: 'Linked via code',
        avatarText: isMale ? '👴' : '👵',
        caregiverPhone: caregiverPhone || patientData.caregiver_phone,
      };

      setPatients((prev) => {
        const filtered = prev.filter((p) => p.id !== formatted.id);
        return [formatted, ...filtered];
      });

      setActivePatientId(formatted.id);
      setActivePatientName(formatted.name);
      if (typeof selectPatient === 'function') {
        selectPatient(formatted.id, formatted.name);
      }

      // Force refresh analytics
      setTimeout(() => {
        loadAnalytics();
      }, 200);

      return { success: true, patient: formatted };
    } catch (err) {
      console.warn('linkPatientByInviteCode error:', err);
      return { success: false, message: 'Connection failed. Please check network.' };
    }
  }, [caregiverPhone, caregiverName, loadAnalytics]);

  // Sign out cleanly to isolate user sessions
  const signOut = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.CURRENT_ROLE,
      ]);
    } catch (e) {}
    setRole(null);
    setCurrentStep('launch');
    setActiveCaregiverSubScreen(null);
    setAllSessions([]);
    setAnalyticsData(null);
  }, []);

  // Load real reminders and analytics whenever active patient changes (guarded)
  useEffect(() => {
    if (!activePatientId) return;
    loadReminders();
    loadAnalytics();
  }, [activePatientId]);

  // Load linked patients when caregiver role or caregiver phone changes
  useEffect(() => {
    if (role === 'caregiver' && caregiverPhone) {
      loadLinkedPatients(caregiverPhone);
    }
  }, [role, caregiverPhone]);

  const handleGameFinished = useCallback(() => {
    setActivePatientGame(null);
    loadAnalytics();
    setTimeout(() => {
      loadAnalytics();
    }, 400);
  }, [loadAnalytics]);

  const toggleRoutineItem = useCallback(async (itemId) => {
    if (!itemId) return;
    const targetPatientId = activePatientId ;
    let nextStatus = false;

    setReminders((prev) => {
      const current = prev.find((i) => i.id === itemId);
      nextStatus = current ? !(current.completed || current.done) : true;

      const updated = prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            completed: nextStatus,
            done: nextStatus,
            completed_at: nextStatus ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          };
        }
        return item;
      });

      const storageKey = `${STORAGE_KEYS.LOCAL_REMINDERS_PREFIX}${targetPatientId}`;
      AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});
      return sortReminders(updated);
    });

    try {
      await dbToggleReminder(itemId, nextStatus);
    } catch (e) {
      console.warn('toggleRoutineItem offline note:', e.message);
    }
  }, [activePatientId]);

  const addReminder = useCallback(async (newReminder) => {
    if (!newReminder || !newReminder.title) return null;
    const targetPatientId = newReminder.patient_id || activePatientId ;
    const tempId = newReminder.id || `rem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const item = {
      id: String(tempId),
      patient_id: String(targetPatientId),
      title: String(newReminder.title).trim(),
      time: String(newReminder.time || '12:00 PM').trim(),
      date: newReminder.date ,
      category: newReminder.category || 'Routine',
      completed: false,
      done: false,
      completed_at: null,
      created_by: role === 'caregiver' ? 'caregiver' : 'patient',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Optimistic local update
    setReminders((prev) => {
      const updated = sortReminders([...prev, item]);
      const storageKey = `${STORAGE_KEYS.LOCAL_REMINDERS_PREFIX}${targetPatientId}`;
      AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    // 2. Remote sync
    try {
      const remoteRecord = await dbAddReminder(item);
      if (remoteRecord && remoteRecord.id) {
        setReminders((prev) => {
          const updated = prev.map((r) =>
            r.id === item.id ? { ...r, ...remoteRecord, done: !!remoteRecord.completed } : r
          );
          const storageKey = `${STORAGE_KEYS.LOCAL_REMINDERS_PREFIX}${targetPatientId}`;
          AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});
          return sortReminders(updated);
        });
        return remoteRecord;
      }
    } catch (err) {
      console.warn('addReminder queued locally (offline):', err.message);
    }

    return item;
  }, [activePatientId, role]);

  const updateReminderItem = useCallback(async (itemId, updates) => {
    if (!itemId) return;
    const targetPatientId = activePatientId ;

    setReminders((prev) => {
      const updated = prev.map((item) => {
        if (item.id === itemId) {
          const isDone = typeof updates.completed === 'boolean'
            ? updates.completed
            : (typeof updates.done === 'boolean' ? updates.done : (item.completed || item.done));
          return {
            ...item,
            ...updates,
            completed: isDone,
            done: isDone,
            updated_at: new Date().toISOString(),
          };
        }
        return item;
      });

      const storageKey = `${STORAGE_KEYS.LOCAL_REMINDERS_PREFIX}${targetPatientId}`;
      AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});
      return sortReminders(updated);
    });

    try {
      await dbUpdateReminder(itemId, updates);
    } catch (e) {
      console.warn('updateReminderItem offline note:', e.message);
    }
  }, [activePatientId]);

  const deleteReminder = useCallback(async (itemId) => {
    if (!itemId) return;
    const targetPatientId = activePatientId ;

    // 1. Optimistic local delete
    setReminders((prev) => {
      const updated = prev.filter((item) => item.id !== itemId);
      const storageKey = `${STORAGE_KEYS.LOCAL_REMINDERS_PREFIX}${targetPatientId}`;
      AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    // 2. Track pending deletion for offline safety
    const delKey = `${STORAGE_KEYS.PENDING_REMINDER_DELETIONS_PREFIX}${targetPatientId}`;
    try {
      const raw = await AsyncStorage.getItem(delKey);
      const list = raw ? JSON.parse(raw) : [];
      if (!list.includes(String(itemId))) {
        list.push(String(itemId));
        await AsyncStorage.setItem(delKey, JSON.stringify(list));
      }
    } catch (e) {}

    // 3. Remote delete
    try {
      const res = await dbDeleteReminder(itemId);
      if (res && res.success) {
        const raw = await AsyncStorage.getItem(delKey);
        const list = raw ? JSON.parse(raw) : [];
        const filtered = list.filter((id) => id !== String(itemId));
        await AsyncStorage.setItem(delKey, JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn('deleteReminder queued locally:', e.message);
    }
  }, [activePatientId]);

  // Real-time Supabase Subscription for Reminders: cross-syncs Caregiver and Patient views instantly
  useEffect(() => {
    if (!activePatientId || !supabase || typeof supabase.channel !== 'function') return;

    const channelName = `realtime-reminders-${activePatientId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `patient_id=eq.${activePatientId}`,
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          setReminders((prev) => {
            let nextList;
            if (eventType === 'INSERT') {
              const exists = prev.some((r) => r.id === String(newRecord.id));
              if (exists) return prev;
              const formatted = {
                id: String(newRecord.id),
                patient_id: newRecord.patient_id,
                title: newRecord.title,
                time: newRecord.time,
                date: newRecord.date ,
                category: newRecord.category || 'Routine',
                completed: !!newRecord.completed,
                done: !!newRecord.completed,
                completed_at: newRecord.completed_at ,
                created_at: newRecord.created_at,
                created_by: newRecord.created_by || 'patient',
              };
              nextList = sortReminders([...prev, formatted]);
            } else if (eventType === 'UPDATE') {
              nextList = sortReminders(
                prev.map((r) =>
                  r.id === String(newRecord.id)
                    ? {
                        ...r,
                        ...newRecord,
                        id: String(newRecord.id),
                        completed: !!newRecord.completed,
                        done: !!newRecord.completed,
                      }
                    : r
                )
              );
            } else if (eventType === 'DELETE') {
              nextList = prev.filter((r) => r.id !== String(oldRecord.id));
            } else {
              return prev;
            }

            const storageKey = `${STORAGE_KEYS.LOCAL_REMINDERS_PREFIX}${activePatientId}`;
            AsyncStorage.setItem(storageKey, JSON.stringify(nextList)).catch(() => {});
            return nextList;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activePatientId]);

  const addPatient = useCallback((newPatient) => {
    const isMale = (newPatient.gender || '').toLowerCase() === 'male';
    const formatted = {
      id: `P_${Date.now()}`,
      name: newPatient.name || 'Loved One',
      connectedSince: 'Today',
      activeToday: true,
      age: newPatient.age || '70',
      gender: isMale ? 'male' : 'female',
      relation: newPatient.relation || 'Relative',
      status: 'Connected today',
      avatarText: isMale ? '👴' : '👵',
    };
    setPatients((prev) => [...prev, formatted]);
    setActivePatientId(formatted.id);
    setActivePatientName(formatted.name);
    if (typeof selectPatient === 'function') {
      selectPatient(formatted.id, formatted.name);
    }
  }, [selectPatient]);

  // Computed Real Stats
  const computedStats = useMemo(() => {
    if (!analyticsData || !allSessions || allSessions.length === 0) {
      return {
        gamesToday: 0,
        avgAccuracy: null,
        totalPlayTimeMinutes: 0,
        daysActiveThisWeek: 0,
        currentLevel: null,
        accuracyWeeklyDelta: null,
        vitalityIndex: null,
      };
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayCount = (allSessions || []).filter((s) => {
      const t = new Date(s.timestamp).getTime();
      return t >= startOfToday.getTime();
    }).length;

    return {
      gamesToday: todayCount,
      avgAccuracy: analyticsData.overallAccuracy,
      totalPlayTimeMinutes: analyticsData.exerciseMinutes || 0,
      daysActiveThisWeek: analyticsData.streakDays || ((allSessions || []).length > 0 ? 1 : 0),
      currentLevel: analyticsData.totalSessions >= 8 ? 'Advanced' : analyticsData.totalSessions >= 3 ? 'Medium' : 'Beginner',
      accuracyWeeklyDelta: analyticsData.growthPercent ? `${analyticsData.growthPercent > 0 ? '+' : ''}${analyticsData.growthPercent}%` : null,
      vitalityIndex: analyticsData.vitalityIndex,
    };
  }, [analyticsData, allSessions]);

  // Real Game Breakdown - strictly from actual verified sessions
  const realGamePerformance = useMemo(() => {
    if (!analyticsData?.gameBreakdown || analyticsData.gameBreakdown.length === 0 || !allSessions || allSessions.length === 0) {
      return [];
    }

    const defaultGames = [
      { id: 'suh_tah_lam', name: 'Suh Tah Lam (Bamboo Rhythm)', icon: 'musical-notes-outline', category: 'Rhythm & Sequence' },
      { id: 'ubilakapki', name: 'Ubilakapki Coconut Toss', icon: 'ellipse-outline', category: 'Spatial Tracking' },
      { id: 'dhop_khel', name: 'Dhopkhel Catch', icon: 'football-outline', category: 'Coordination & Focus' },
      { id: 'northeast_memory', name: 'Sinaki Sthan', icon: 'images-outline', category: 'Cultural Visual Memory' },
      { id: 'memory_stories', name: 'Xuworoni Kotha', icon: 'book-outline', category: 'Cultural Memory' },
    ];

    const playedGames = analyticsData.gameBreakdown.filter((b) => b && b.sessionsCount > 0);
    if (playedGames.length === 0) return [];

    return playedGames.map((b) => {
      const meta = defaultGames.find((g) => g.id === b.gameId) || {};
      return {
        id: b.gameId,
        name: b.gameName || meta.name || 'Brain Exercise',
        icon: meta.icon || 'game-controller-outline',
        category: meta.category || 'Cognitive Recall',
        score: b.accuracy,
        sessionsCount: b.sessionsCount || 0,
      };
    });
  }, [analyticsData, allSessions]);

  // Real Recent Activity
  const realRecentActivity = useMemo(() => {
    if (!allSessions || allSessions.length === 0) return [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

    return allSessions.slice(0, 25).map((s) => {
      const sTime = new Date(s.timestamp).getTime();
      let day = 'Earlier';
      if (sTime >= startOfToday) day = 'Today';
      else if (sTime >= startOfYesterday) day = 'Yesterday';

      let timeFormatted = '';
      let formattedDate = '';
      let fullDateTime = '';
      try {
        const d = new Date(s.timestamp);
        formattedDate = d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
        timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        fullDateTime = `${formattedDate} at ${timeFormatted}`;
      } catch (e) {
        timeFormatted = 'Recently';
        fullDateTime = 'Recently';
      }

      const durationSec = typeof s.durationSec === 'number' ? s.durationSec : (typeof s.duration === 'number' ? s.duration : null);
      const durationMin = durationSec ? Math.floor(durationSec / 60) : 0;
      const durationSecRem = durationSec ? Math.round(durationSec % 60) : 0;
      const durationFormatted = durationSec !== null && durationSec > 0
        ? durationMin > 0
          ? `${durationMin} min ${durationSecRem} sec`
          : `${durationSecRem} sec`
        : null;

      const accuracyVal = typeof s.accuracy === 'number' && !isNaN(s.accuracy)
        ? Math.round(s.accuracy)
        : null;
      const status = s.metadata?.status || (s.completed !== false ? 'Completed' : 'Aborted');

      return {
        id: s.id,
        game: s.gameName || s.gameId || 'Brain Exercise',
        gameId: s.gameId,
        time: timeFormatted,
        day,
        formattedDate,
        fullDateTime,
        status,
        rawScore: typeof s.score === 'number' ? s.score : null,
        score: typeof s.score === 'number' ? `${s.score} pts` : (accuracyVal !== null ? `${accuracyVal}%` : '--'),
        rawAccuracy: accuracyVal,
        accuracy: accuracyVal !== null ? `${accuracyVal}%` : null,
        durationSec: durationSec || 0,
        durationFormatted,
        difficulty: s.difficulty || 'Normal',
        icon: s.gameId?.includes('suh') ? 'musical-notes-outline' : s.gameId?.includes('dhop') ? 'football-outline' : s.gameId?.includes('ubi') ? 'grid-outline' : s.gameId?.includes('memory') ? 'book-outline' : 'game-controller-outline',
        color: '#5B409E',
      };
    });
  }, [allSessions]);

  const selectRole = useCallback(async (selectedRole) => {
    setRole(selectedRole);
    setCurrentStep('main');
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_ROLE, selectedRole);
    } catch (e) {
      console.warn('Error persisting Noklai role:', e);
    }
  }, []);

  const resetToRoleSelect = useCallback(async () => {
    setCurrentStep('role_select');
  }, []);

  const resetToLaunch = useCallback(async () => {
    setCurrentStep('launch');
  }, []);

  const noklaiContextValue = useMemo(() => ({
    currentStep,
    setCurrentStep,
    role,
    setRole,
    selectRole,
    resetToRoleSelect,
    resetToLaunch,
    hasCompletedSetup,
    caregiverName,
    setCaregiverName,
    caregiverPhone,
    setCaregiverPhone,
    caregiverGender,
    setCaregiverGender,
    caregiverAvatar,
    activePatientId,
    setActivePatientId,
    activePatientName,
    setActivePatientName,
    patientPhone,
    setPatientPhone,
    patientGender,
    setPatientGender,
    patientAvatar,
    saveCredentials,
    patients,
    activePatient,
    addPatient,
    aiModalVisible,
    setAiModalVisible,
    activeCaregiverSubScreen,
    setActiveCaregiverSubScreen,
    activePatientGame,
    setActivePatientGame,
    handleGameFinished,

    // Real data
    reminders,
    loadingReminders,
    addReminder,
    updateReminder: updateReminderItem,
    deleteReminder,
    toggleRoutineItem,
    toggleReminder: toggleRoutineItem,
    refreshReminders: loadReminders,
    computedStats,
    realGamePerformance,
    realRecentActivity,
    analyticsData,
    isLoadingAnalytics,
    loadAnalytics,
    loadLinkedPatients,
    linkPatientByInviteCode,
    signOut,
    allSessions,

    isDarkMode,
  }), [
    currentStep,
    role,
    selectRole,
    resetToRoleSelect,
    resetToLaunch,
    hasCompletedSetup,
    caregiverName,
    caregiverPhone,
    caregiverGender,
    caregiverAvatar,
    activePatientId,
    activePatientName,
    patientPhone,
    patientGender,
    patientAvatar,
    saveCredentials,
    patients,
    activePatient,
    addPatient,
    aiModalVisible,
    activeCaregiverSubScreen,
    activePatientGame,
    handleGameFinished,
    reminders,
    loadingReminders,
    addReminder,
    updateReminderItem,
    deleteReminder,
    toggleRoutineItem,
    loadReminders,
    computedStats,
    realGamePerformance,
    realRecentActivity,
    analyticsData,
    isLoadingAnalytics,
    loadAnalytics,
    loadLinkedPatients,
    linkPatientByInviteCode,
    signOut,
    allSessions,
    isDarkMode,
  ]);

  return (
    <NoklaiContext.Provider value={noklaiContextValue}>
      {children}
    </NoklaiContext.Provider>
  );
}

export function useNoklai() {
  const context = useContext(NoklaiContext);
  if (!context) {
    throw new Error('useNoklai must be used within a NoklaiProvider');
  }
  return context;
}

export default NoklaiContext;
