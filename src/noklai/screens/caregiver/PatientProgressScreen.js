import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { noklaiTheme } from '../../theme/noklaiTheme';
import { useTheme } from '../../../context/ThemeContext';
import { useNoklai } from '../../context/NoklaiContext';
import { StatGrid } from '../../components/StatTile';
import QuoteCard from '../../components/QuoteCard';
import NoklaiHeader from '../../components/NoklaiHeader';
import NoklaiButton from '../../components/NoklaiButton';
import GamePerformanceScreen from './GamePerformanceScreen';
import ActivityHistoryScreen from './ActivityHistoryScreen';
import { callPhone } from '../../../utils/callService';
import { normalizeIndianPhone } from '../../../utils/phoneValidation';

const DOCTOR_STORAGE_PREFIX = '@caregiver_doctor_';

export default function PatientProgressScreen({ onBack }) {
  const { isDarkMode } = useTheme();
  const {
    activePatientName,
    patientAvatar,
    setActiveCaregiverSubScreen,
    setAiModalVisible,
    computedStats,
    realRecentActivity,
    activePatientId,
  } = useNoklai();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'games' | 'history'
  const [doctor, setDoctor] = useState(null);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [showRemoveDoctorModal, setShowRemoveDoctorModal] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const [doctorPhone, setDoctorPhone] = useState('');
  const [doctorError, setDoctorError] = useState('');

  const doctorStorageKey = `${DOCTOR_STORAGE_PREFIX}${activePatientId || 'default'}`;

  React.useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(doctorStorageKey).then((storedDoctor) => {
      if (!isMounted || !storedDoctor) return;
      try {
        const parsedDoctor = JSON.parse(storedDoctor);
        if (parsedDoctor?.name && parsedDoctor?.phone) setDoctor(parsedDoctor);
      } catch (error) {
        setDoctor(null);
      }
    }).catch((error) => console.warn('Error loading doctor contact:', error));
    return () => { isMounted = false; };
  }, [doctorStorageKey]);

  const openDoctorForm = () => {
    setDoctorName(doctor?.name || '');
    setDoctorPhone(doctor?.phone || '');
    setDoctorError('');
    setShowDoctorModal(true);
  };

  const handleSaveDoctor = async () => {
    const name = doctorName.trim();
    const phone = normalizeIndianPhone(doctorPhone);
    if (!name) return setDoctorError("Please enter the doctor's name.");
    if (!phone) return setDoctorError('Please enter a valid 10-digit Indian mobile number.');
    const savedDoctor = { name, phone };
    try {
      await AsyncStorage.setItem(doctorStorageKey, JSON.stringify(savedDoctor));
      setDoctor(savedDoctor);
      setShowDoctorModal(false);
    } catch (error) {
      setDoctorError('Unable to save this doctor right now. Please try again.');
    }
  };

  const handleRemoveDoctor = () => {
    setShowRemoveDoctorModal(true);
  };

  const confirmRemoveDoctor = async () => {
    try {
      await AsyncStorage.removeItem(doctorStorageKey);
      setDoctor(null);
      setShowRemoveDoctorModal(false);
    } catch (error) {
      setShowRemoveDoctorModal(false);
      Alert.alert('Remove Doctor', 'Unable to remove this doctor contact right now.');
    }
  };

  const handleCallDoctor = async () => {
    try {
      if (!doctor || !(await callPhone(doctor.phone))) throw new Error('Unable to open dialer');
    } catch (error) {
      Alert.alert('Calling unavailable', 'Unable to open the phone dialer for this doctor.');
    }
  };

  const hasActivity = realRecentActivity && realRecentActivity.length > 0;

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
      <NoklaiHeader
        showBack
        onBack={onBack || (() => setActiveCaregiverSubScreen(null))}
        title={`${activePatientName}'s Progress`}
      />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Patient Profile Row */}
        <View style={styles.patientProfileRow}>
          <View style={[styles.avatarCircle, { backgroundColor: '#FEF3C7' }]}>
            <Text style={{ fontSize: 30 }}>{patientAvatar}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.patientTitle,
                { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
              ]}
            >
              {activePatientName}
            </Text>
            <View style={styles.activeStatusRow}>
              <View style={[styles.greenActiveDot, { backgroundColor: hasActivity ? '#16A34A' : '#9CA3AF' }]} />
              <Text style={[styles.activeStatusText, { color: hasActivity ? '#16A34A' : '#656F7D' }]}>
                {hasActivity ? 'Active this week' : 'No recent sessions'}
              </Text>
            </View>
          </View>
        </View>

        {/* Tab Pills: Overview | Games | History */}
        <View style={styles.tabsContainer}>
          {['overview', 'games', 'history'].map((tabKey) => {
            const isSelected = activeTab === tabKey;
            const label = tabKey.charAt(0).toUpperCase() + tabKey.slice(1);
            return (
              <TouchableOpacity
                key={tabKey}
                onPress={() => setActiveTab(tabKey)}
                style={[
                  styles.tabPill,
                  {
                    backgroundColor: isSelected
                      ? noklaiTheme.colors.primary
                      : isDarkMode
                      ? '#232938'
                      : '#E8EAE3',
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    {
                      color: isSelected
                        ? '#FFFFFF'
                        : isDarkMode
                        ? '#9CA3AF'
                        : '#4B5563',
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tab 1: Overview - REAL STATS ONLY */}
        {activeTab === 'overview' && (
          <View>
            <View style={styles.thisWeekHeaderRow}>
              <Text
                style={[
                  styles.sectionHeading,
                  { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
                ]}
              >
                This Week (Verified Data)
              </Text>
              <View style={[styles.trendBadge, { backgroundColor: hasActivity ? '#DCFCE7' : '#F1F5F9' }]}>
                <Ionicons
                  name={hasActivity ? 'trending-up' : 'time-outline'}
                  size={12}
                  color={hasActivity ? '#16A34A' : '#64748B'}
                />
                <Text style={[styles.trendBadgeText, { color: hasActivity ? '#16A34A' : '#64748B' }]}>
                  {hasActivity ? computedStats.accuracyWeeklyDelta : 'No baseline yet'}
                </Text>
              </View>
            </View>

            {/* 4 Stat Tiles Grid with REAL values */}
            <StatGrid
              daysActive={computedStats.daysActiveThisWeek}
              avgAccuracy={computedStats.avgAccuracy !== null ? computedStats.avgAccuracy : '--'}
              playTimeMinutes={computedStats.totalPlayTimeMinutes}
              level={computedStats.currentLevel}
            />

            {/* Cognitive Vitality Bar */}
            <View
              style={[
                styles.vitalityCard,
                {
                  backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF',
                  borderColor: isDarkMode ? '#2D3545' : '#E8EAE3',
                },
              ]}
            >
              <View style={styles.vitalityHeader}>
                <View style={styles.vitalityIconCircle}>
                  <Ionicons name="sparkles" size={18} color="#5B409E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.vitalityTitle,
                      { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
                    ]}
                  >
                    Cognitive Vitality Index (CVI)
                  </Text>
                  <Text style={styles.vitalitySub}>
                    {computedStats.vitalityIndex
                      ? 'Clinically validated across rhythm & recall sessions'
                      : 'Play 3+ game rounds to calibrate verified CVI index'}
                  </Text>
                </View>
                <Text style={styles.vitalityScore}>
                  {computedStats.vitalityIndex ? `${computedStats.vitalityIndex} / 100` : '-- / 100'}
                </Text>
              </View>

              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: computedStats.vitalityIndex ? `${computedStats.vitalityIndex}%` : '0%',
                    },
                  ]}
                />
              </View>
            </View>

            <View style={[styles.doctorCard, { backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF', borderColor: isDarkMode ? '#2D3545' : '#E8EAE3' }]}>
              <View style={styles.doctorHeader}>
                <View style={styles.doctorIconCircle}><Ionicons name="medkit-outline" size={18} color="#2563EB" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.doctorTitle, { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary }]}>Doctor Contact</Text>
                  <Text style={styles.doctorSub}>Keep a trusted clinician ready to reach.</Text>
                </View>
              </View>
              {doctor ? (
                <View style={styles.savedDoctor}>
                  <Text style={[styles.doctorName, { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary }]}>{doctor.name}</Text>
                  <Text style={styles.doctorPhone}>+91 {doctor.phone.slice(0, 5)} {doctor.phone.slice(5)}</Text>
                  <View style={styles.doctorActions}>
                    <TouchableOpacity style={styles.callDoctorButton} onPress={handleCallDoctor} accessibilityRole="button" accessibilityLabel={`Call Doctor ${doctor.name}`}>
                      <Ionicons name="call-outline" size={18} color="#FFFFFF" /><Text style={styles.callDoctorText}>Call Doctor</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.doctorSmallButton} onPress={openDoctorForm} accessibilityLabel="Edit Doctor"><Ionicons name="create-outline" size={18} color="#2563EB" /><Text style={styles.doctorSmallText}>Edit</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.doctorSmallButton} onPress={handleRemoveDoctor} accessibilityLabel="Remove Doctor"><Ionicons name="trash-outline" size={18} color="#DC2626" /><Text style={[styles.doctorSmallText, { color: '#DC2626' }]}>Remove</Text></TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.callDoctorButton} onPress={openDoctorForm} accessibilityRole="button" accessibilityLabel="Add Doctor">
                  <Ionicons name="person-add-outline" size={18} color="#FFFFFF" /><Text style={styles.callDoctorText}>Add Doctor</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* AI Assistant Insight Action */}
            <View style={{ marginTop: 14 }}>
              <NoklaiButton
                title="Ask AI for Care Recommendations"
                variant="subtle"
                icon="sparkles-outline"
                size="md"
                onPress={() => setAiModalVisible(true)}
              />
            </View>

            {/* Quote Card */}
            <QuoteCard
              quote="Small steps make a big difference."
              author="Noklai Care"
            />
          </View>
        )}

        {/* Tab 2: Games */}
        {activeTab === 'games' && (
          <GamePerformanceScreen embedded onBack={() => setActiveTab('overview')} />
        )}

        {/* Tab 3: History */}
        {activeTab === 'history' && (
          <ActivityHistoryScreen embedded onBack={() => setActiveTab('overview')} />
        )}
      </ScrollView>

      <Modal visible={showDoctorModal} animationType="slide" transparent onRequestClose={() => setShowDoctorModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.doctorModal, { backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary }]}>{doctor ? 'Edit Doctor' : 'Add Doctor'}</Text>
              <TouchableOpacity onPress={() => setShowDoctorModal(false)} accessibilityLabel="Cancel doctor form"><Ionicons name="close-circle" size={26} color="#64748B" /></TouchableOpacity>
            </View>
            <Text style={[styles.formLabel, { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary }]}>Doctor's name</Text>
            <TextInput value={doctorName} onChangeText={(value) => { setDoctorName(value); setDoctorError(''); }} placeholder="Enter doctor's name" placeholderTextColor="#94A3B8" style={[styles.formInput, { color: isDarkMode ? '#FFFFFF' : '#1E293B' }]} accessibilityLabel="Doctor's name" />
            <Text style={[styles.formLabel, { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary }]}>Doctor's phone number</Text>
            <TextInput value={doctorPhone} onChangeText={(value) => { setDoctorPhone(value); setDoctorError(''); }} placeholder="10-digit mobile number" placeholderTextColor="#94A3B8" keyboardType="phone-pad" style={[styles.formInput, { color: isDarkMode ? '#FFFFFF' : '#1E293B' }]} accessibilityLabel="Doctor's phone number" />
            {!!doctorError && <Text style={styles.formError} accessibilityRole="alert">{doctorError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveDoctor} accessibilityLabel="Save doctor"><Text style={styles.callDoctorText}>Save</Text></TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowDoctorModal(false)} accessibilityLabel="Cancel doctor form"><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showRemoveDoctorModal} animationType="fade" transparent onRequestClose={() => setShowRemoveDoctorModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.doctorModal, { backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF' }]}>
            <View style={styles.confirmationIconCircle}>
              <Ionicons name="trash-outline" size={22} color="#DC2626" />
            </View>
            <Text style={[styles.modalTitle, styles.confirmationTitle, { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary }]}>Remove Doctor?</Text>
            <Text style={[styles.confirmationMessage, { color: isDarkMode ? '#CBD5E1' : '#656F7D' }]}>This will remove the saved doctor contact from this patient’s profile.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowRemoveDoctorModal(false)} accessibilityRole="button" accessibilityLabel="Cancel remove doctor">
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.removeButton} onPress={confirmRemoveDoctor} accessibilityRole="button" accessibilityLabel="Confirm remove doctor">
                <Text style={styles.callDoctorText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  patientProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  patientTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 3,
  },
  activeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },
  activeStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: noklaiTheme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillText: {
    fontSize: 14,
  },
  thisWeekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  trendBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 3,
  },
  vitalityCard: {
    borderRadius: noklaiTheme.radii.xl,
    borderWidth: 1,
    padding: 16,
    marginTop: 10,
  },
  vitalityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  vitalityIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0ECF9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  vitalityTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  vitalitySub: {
    fontSize: 12,
    color: '#656F7D',
    marginTop: 1,
  },
  vitalityScore: {
    fontSize: 16,
    fontWeight: '800',
    color: noklaiTheme.colors.primary,
    marginLeft: 6,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8EAE3',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: noklaiTheme.colors.primary,
  },
  doctorCard: {
    borderRadius: noklaiTheme.radii.xl,
    borderWidth: 1,
    padding: 16,
    marginTop: 14,
  },
  doctorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  doctorIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  doctorTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  doctorSub: {
    fontSize: 12,
    color: '#656F7D',
    marginTop: 1,
  },
  savedDoctor: {
    paddingLeft: 46,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '700',
  },
  doctorPhone: {
    fontSize: 14,
    color: '#656F7D',
    marginTop: 3,
  },
  doctorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  callDoctorButton: {
    flex: 1,
    minWidth: 140,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  callDoctorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 7,
  },
  doctorSmallButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EAE3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  doctorSmallText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  doctorModal: {
    borderRadius: 20,
    padding: 18,
  },
  confirmationIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmationTitle: {
    marginBottom: 6,
  },
  confirmationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  formInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D8DEE8',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 14,
  },
  formError: {
    color: '#DC2626',
    fontSize: 12,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  saveButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
