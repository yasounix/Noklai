import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { noklaiTheme } from '../../theme/noklaiTheme';
import { useTheme } from '../../../context/ThemeContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useNoklai } from '../../context/NoklaiContext';
import { MemoryService } from '../../../services/MemoryService';
import { speakMemory, stopSpeech, RELATION_LABELS_BY_LANG } from '../../../utils/speechHelper';
import MemoryModal from '../../components/MemoryModal';
import InlineAuthCard from '../../components/InlineAuthCard';

const { width } = Dimensions.get('window');

const STRINGS = {
  en: {
    title: 'Family & Loved Ones',
    subtitle: 'Look at familiar faces and remember cherished memories',
    listen: 'Tap to Hear',
    speaking: 'Speaking...',
    previous: 'Previous',
    next: 'Next',
    addPhoto: 'Add Photo',
    emptyTitle: 'No Photos Added Yet',
    emptyDesc: 'Photos of your family and friends will appear here so you can look at them anytime.',
    signInRequired: 'Sign in to View Family Photos',
    signInDesc: 'Family memory photos are kept private and secure. Please sign in to see your family album.',
    signInBtn: 'Sign In With Email',
    photoCounter: 'Photo %{current} of %{total}',
  },
  hi: {
    title: 'परिवार और प्रियजन',
    subtitle: 'पहचाने चेहरों को देखें और प्यारी यादों को ताज़ा करें',
    listen: 'सुनने के लिए दबाएं',
    speaking: 'बोल रहा है...',
    previous: 'पिछला',
    next: 'अगला',
    addPhoto: 'तस्वीर जोड़ें',
    emptyTitle: 'अभी कोई तस्वीर नहीं है',
    emptyDesc: 'आपके परिवार और दोस्तों की तस्वीरें यहाँ दिखेंगी ताकि आप उन्हें कभी भी देख सकें।',
    signInRequired: 'परिवार की तस्वीरें देखने के लिए साइन इन करें',
    signInDesc: 'पारिवारिक तस्वीरें सुरक्षित और निजी रखी जाती हैं। कृपया एल्बम देखने के लिए साइन इन करें।',
    signInBtn: 'ईमेल से साइन इन करें',
    photoCounter: 'तस्वीर %{current} / %{total}',
  },
  as: {
    title: 'পৰিয়াল আৰু আপোনজন',
    subtitle: 'চিনাকি মুখবোৰ চাওক আৰু স্মৃতিবোৰ সজীৱ কৰক',
    listen: 'শুনিবলৈ টিপক',
    speaking: 'কৈ আছে...',
    previous: 'আগৰটো',
    next: 'পিছৰটো',
    addPhoto: 'ছবি যোগ কৰক',
    emptyTitle: 'এতিয়ালৈকে কোনো ছবি যোগ কৰা হোৱা নাই',
    emptyDesc: 'আপোনাৰ পৰিয়াল আৰু বন্ধুসকলৰ ছবি ইয়াত থাকিব যাতে আপুনি যিকোনো সময়ত চাব পাৰে।',
    signInRequired: 'পৰিয়ালৰ ছবি চাবলৈ ছাইন ইন কৰক',
    signInDesc: 'পৰিয়ালৰ ছবিসমূহ সুৰক্ষিত আৰু গোপনীয়। এলবাম চাবলৈ অনুগ্ৰহ কৰি ছাইন ইন কৰক।',
    signInBtn: 'ইমেইলৰে ছাইন ইন কৰক',
    photoCounter: 'ছবি %{current} / %{total}',
  },
  bn: {
    title: 'পরিবার ও প্রিয়জন',
    subtitle: 'চেনা মুখগুলো দেখুন এবং স্মৃতিগুলো মনে করুন',
    listen: 'শোনার জন্য চাপুন',
    speaking: 'বলছে...',
    previous: 'আগেরটি',
    next: 'পরেরটি',
    addPhoto: 'ছবি যোগ করুন',
    emptyTitle: 'এখনও কোনো ছবি যোগ করা হয়নি',
    emptyDesc: 'আপনার পরিবার এবং বন্ধুদের ছবি এখানে থাকবে যাতে আপনি যেকোনো সময় দেখতে পারেন।',
    signInRequired: 'পরিবারের ছবি দেখতে সাইন ইন করুন',
    signInDesc: 'পারিবারিক ছবিগুলো সুরক্ষিত ও ব্যক্তিগত রাখা হয়। অ্যালবাম দেখতে অনুগ্রহ করে সাইন ইন করুন।',
    signInBtn: 'ইমেল দিয়ে সাইন ইন করুন',
    photoCounter: 'ছবি %{current} / %{total}',
  },
};

export default function PatientMemoryScreen() {
  const { isDarkMode } = useTheme();
  const { currentLanguage } = useLanguage();
  const { activePatientId, activePatientName } = useNoklai();

  const lang = (currentLanguage || 'en').toLowerCase().split(/[-_]/)[0];
  const s = STRINGS[lang] || STRINGS.en;
  const relLabels = RELATION_LABELS_BY_LANG[lang] || RELATION_LABELS_BY_LANG.en;

  const [memories, setMemories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    try {
      // Check auth state
      const { supabase } = await import('../../../modules/supabaseClient');
      const { data: authData } = await supabase.auth.getSession();
      const hasAuth = Boolean(authData?.session?.user);
      setIsAuthenticated(hasAuth);

      if (hasAuth && activePatientId) {
        const result = await MemoryService.fetchMemories(activePatientId);
        if (result.memories) {
          setMemories(result.memories);
          if (currentIndex >= result.memories.length) {
            setCurrentIndex(0);
          }
        }
      } else {
        setMemories([]);
      }
    } catch (err) {
      console.warn('Error fetching patient memories:', err);
    } finally {
      setLoading(false);
    }
  }, [activePatientId, currentIndex]);

  useEffect(() => {
    loadMemories();
    return () => {
      stopSpeech();
    };
  }, [activePatientId]);

  const handleSpeak = (memory) => {
    if (!memory) return;
    setSpeaking(true);
    speakMemory({
      personName: memory.person_name,
      relation: memory.relation,
      notes: memory.notes,
      language: currentLanguage || 'en',
      onDone: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const currentMemory = memories[currentIndex];

  const handlePrev = () => {
    stopSpeech();
    setSpeaking(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : memories.length - 1));
  };

  const handleNext = () => {
    stopSpeech();
    setSpeaking(false);
    setCurrentIndex((prev) => (prev < memories.length - 1 ? prev + 1 : 0));
  };

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: isDarkMode
            ? noklaiTheme.colors.backgroundDark
            : noklaiTheme.colors.background,
        },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text
              style={[
                styles.headerTitle,
                { color: isDarkMode ? noklaiTheme.colors.textDark : noklaiTheme.colors.text },
              ]}
            >
              {s.title}
            </Text>
            <Text style={styles.headerSubtitle}>{s.subtitle}</Text>
          </View>

          {isAuthenticated && (
            <TouchableOpacity
              style={styles.headerAddBtn}
              onPress={() => setShowAddModal(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="add-circle" size={32} color="#5B409E" />
            </TouchableOpacity>
          )}
        </View>

        {/* Loading Spinner */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#5B409E" />
          </View>
        ) : !isAuthenticated ? (
          /* Unauthenticated Embedded Auth Card */
          <InlineAuthCard
            initialRole="patient"
            title={s.signInRequired}
            subtitle={s.signInDesc}
            onSuccess={() => {
              loadMemories();
            }}
          />
        ) : memories.length === 0 ? (
          /* Empty Album State */
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: isDarkMode ? noklaiTheme.colors.cardDark : '#FFF' },
            ]}
          >
            <Text style={styles.emptyEmoji}>🖼️</Text>
            <Text
              style={[
                styles.emptyTitle,
                { color: isDarkMode ? noklaiTheme.colors.textDark : noklaiTheme.colors.text },
              ]}
            >
              {s.emptyTitle}
            </Text>
            <Text style={styles.emptyDesc}>{s.emptyDesc}</Text>
            <TouchableOpacity
              style={styles.addFirstBtn}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="camera" size={20} color="#FFF" />
              <Text style={styles.addFirstBtnText}>{s.addPhoto}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Dementia-Friendly Single-Photo Carousel Card */
          <View style={styles.carouselContainer}>
            {/* Counter Badge */}
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>
                {s.photoCounter
                  .replace('%{current}', currentIndex + 1)
                  .replace('%{total}', memories.length)}
              </Text>
            </View>

            {/* Main Photo Card */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDarkMode
                    ? (noklaiTheme.colors.cardBackgroundDark || '#1E232E')
                    : (noklaiTheme.colors.cardBackground || '#FFF'),
                  borderColor: isDarkMode ? '#444' : '#E8E4DF',
                },
              ]}
            >
              {/* Photo */}
              <View style={styles.photoContainer}>
                {currentMemory.signed_url ? (
                  <Image
                    source={{ uri: currentMemory.signed_url }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.photoFallback}>
                    <Ionicons name="person" size={80} color="#BBB" />
                  </View>
                )}
              </View>

              {/* Memory Details - High Contrast & Large Font */}
              <View style={styles.detailsContainer}>
                <Text
                  style={[
                    styles.personName,
                    { color: isDarkMode ? noklaiTheme.colors.textDark : '#1A1A1A' },
                  ]}
                >
                  {currentMemory.person_name}
                </Text>

                <View style={styles.relationTag}>
                  <Text style={styles.relationText}>
                    {relLabels[currentMemory.relation] || currentMemory.relation}
                  </Text>
                </View>

                {currentMemory.notes ? (
                  <Text style={styles.notesText}>
                    "{currentMemory.notes}"
                  </Text>
                ) : null}

                {/* Big Audio Readout Button */}
                <TouchableOpacity
                  style={[styles.audioBtn, speaking && styles.audioBtnSpeaking]}
                  onPress={() => handleSpeak(currentMemory)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={speaking ? 'volume-high' : 'volume-medium-outline'}
                    size={28}
                    color="#FFF"
                  />
                  <Text style={styles.audioBtnText}>
                    {speaking ? s.speaking : s.listen}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Navigation Controls (Large Buttons) */}
            {memories.length > 1 && (
              <View style={styles.navRow}>
                <TouchableOpacity style={styles.navBtn} onPress={handlePrev}>
                  <Ionicons name="chevron-back" size={26} color="#5B409E" />
                  <Text style={styles.navBtnText}>{s.previous}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navBtn} onPress={handleNext}>
                  <Text style={styles.navBtnText}>{s.next}</Text>
                  <Ionicons name="chevron-forward" size={26} color="#5B409E" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Memory Modal */}
      <MemoryModal
        visible={showAddModal}
        patientId={activePatientId}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          loadMemories();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 3,
  },
  headerAddBtn: {
    padding: 4,
    flexShrink: 0,
  },
  centerContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authPromptCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E8E4DF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  lockIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EDE7F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  authPromptTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  authPromptDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  authPromptBtn: {
    backgroundColor: '#5B409E',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  authPromptBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  emptyCard: {
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E8E4DF',
  },
  emptyEmoji: {
    fontSize: 52,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  addFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#5B409E',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
  },
  addFirstBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  carouselContainer: {
    alignItems: 'center',
  },
  counterBadge: {
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 14,
  },
  counterText: {
    color: '#5B409E',
    fontSize: 14,
    fontWeight: 'bold',
  },
  card: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  photoContainer: {
    width: '100%',
    height: 210,
    backgroundColor: '#F0ECE6',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    padding: 16,
    alignItems: 'center',
  },
  personName: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  relationTag: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  relationText: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: 'bold',
  },
  notesText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#5B409E',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#5B409E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  audioBtnSpeaking: {
    backgroundColor: '#2E7D32',
  },
  audioBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
    gap: 14,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F3E5F5',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D1C4E9',
  },
  navBtnText: {
    color: '#5B409E',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

