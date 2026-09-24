import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { noklaiTheme } from '../../theme/noklaiTheme';
import { useTheme } from '../../../context/ThemeContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useNoklai } from '../../context/NoklaiContext';
import NoklaiCard from '../../components/NoklaiCard';
import QuoteCard from '../../components/QuoteCard';
import NoklaiButton from '../../components/NoklaiButton';
import {
  REMINDER_CATEGORIES,
  getCategoryMeta,
  getReminderStatus,
  sortReminders,
} from '../../../modules/remindersHelper';

export default function PatientHomeScreen({
  onNavigateToGames,
  onContinueActivity,
  onOpenAI,
  onNavigateToProgress,
}) {
  const { isDarkMode } = useTheme();
  const { t } = useLanguage();
  const {
    activePatientName,
    patientAvatar,
    reminders,
    loadingReminders,
    addReminder,
    deleteReminder,
    toggleRoutineItem,
    setAiModalVisible,
  } = useNoklai();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderTime, setReminderTime] = useState('08:30 AM');
  const [reminderCategory, setReminderCategory] = useState('Medication');

  const sortedReminders = useMemo(() => {
    if (!Array.isArray(reminders)) return [];
    return sortReminders(reminders);
  }, [reminders]);

  const handleSaveReminder = () => {
    if (!reminderTitle.trim()) {
      Alert.alert(
        t('noklai.patientHome.missingTitle', 'Missing Title'),
        t('noklai.patientHome.missingTitleAlert', 'Please enter a reminder name (e.g. Blood Pressure medicine).')
      );
      return;
    }
    addReminder({
      title: reminderTitle.trim(),
      time: reminderTime.trim() || '12:00 PM',
      category: reminderCategory,
      created_by: 'patient',
    });
    setReminderTitle('');
    setReminderTime('08:30 AM');
    setReminderCategory('Medication');
    setAddModalVisible(false);
  };

  const handleDeleteReminder = (item) => {
    Alert.alert(
      t('noklai.caregiverHome.deleteReminderTitle', 'Delete Reminder'),
      t('noklai.caregiverHome.deleteReminderConfirm', 'Are you sure you want to remove "%{title}"?', { title: item.title }),
      [
        { text: t('noklai.patientHome.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('noklai.caregiverHome.deleteBtn', 'Delete'),
          style: 'destructive',
          onPress: () => deleteReminder(item.id),
        },
      ]
    );
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
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Welcoming Greeting & Avatar */}
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.greetingSub,
                { color: isDarkMode ? '#86EFAC' : '#15803D' },
              ]}
            >
              {activePatientName
                ? t('noklai.patientHome.greeting', 'Namaste, %{name}!', { name: activePatientName })
                : t('noklai.patientHome.greetingDefault', 'Namaste!')}
            </Text>
            <Text
              style={[
                styles.patientNameHeading,
                { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
              ]}
            >
              {t('noklai.patientHome.welcomeBack', 'Welcome back. What would you like to do today?')}
            </Text>
            <Text
              style={[
                styles.calmEncourageTag,
                { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
              ]}
            >
              {t('noklai.patientHome.encourage', 'Let’s try together • Take your time')}
            </Text>
          </View>

          <View style={[styles.avatarCircle, { backgroundColor: '#FEF3C7' }]}>
            <Text style={{ fontSize: 36 }}>{patientAvatar}</Text>
          </View>
        </View>

        {/* Daily Schedule / Reminders Section - Placed on top directly above action cards */}
        <View style={styles.sectionHeadingRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="calendar" size={22} color="#16A34A" style={{ marginRight: 8 }} />
            <Text
              style={[
                styles.sectionTitle,
                { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
              ]}
            >
              {t('noklai.patientHome.myDay', 'My Day & Reminders')}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addReminderHeaderBtn}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle" size={18} color="#16A34A" style={{ marginRight: 4 }} />
            <Text style={styles.addReminderHeaderText}>{t('noklai.patientHome.add', 'Add')}</Text>
          </TouchableOpacity>
        </View>

        <NoklaiCard style={styles.scheduleCard} padded={false}>
          {loadingReminders ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="small" color="#16A34A" />
              <Text style={[styles.emptyText, { color: isDarkMode ? '#9CA3AF' : '#656F7D' }]}>
                {t('noklai.patientHome.checkingReminders', 'Checking reminders...')}
              </Text>
            </View>
          ) : sortedReminders && sortedReminders.length > 0 ? (
            sortedReminders.map((item, index) => {
              const isDone = Boolean(item.completed || item.done);
              const catMeta = getCategoryMeta(item.category);
              const statusMeta = getReminderStatus(item);

              return (
                <View
                  key={item.id}
                  style={[
                    styles.routineRow,
                    index < sortedReminders.length - 1 && styles.routineRowBorder,
                    isDone && { backgroundColor: isDarkMode ? '#142318' : '#F6FBF7' },
                  ]}
                >
                  {/* Category Icon Badge */}
                  <View style={[styles.categoryIconBadge, { backgroundColor: catMeta.badgeBg }]}>
                    <Ionicons name={catMeta.icon} size={22} color={catMeta.color} />
                  </View>

                  {/* Reminder Content */}
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text
                      style={[
                        styles.routineTitle,
                        {
                          color: isDone
                            ? (isDarkMode ? '#9CA3AF' : '#6B7280')
                            : (isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary),
                          textDecorationLine: isDone ? 'line-through' : 'none',
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>

                    <View style={styles.routineMetaRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
                        <Ionicons name="time-outline" size={13} color={isDarkMode ? '#9CA3AF' : '#6B7280'} style={{ marginRight: 4 }} />
                        <Text style={[styles.routineTime, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                          {item.time || '12:00 PM'}
                        </Text>
                      </View>

                      {/* Status Badge */}
                      <View style={[styles.statusBadge, { backgroundColor: statusMeta.badgeBg }]}>
                        <Ionicons name={statusMeta.icon} size={11} color={statusMeta.color} style={{ marginRight: 3 }} />
                        <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>
                          {statusMeta.label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Interactive Toggle Checkbox - Large touch target for elderly */}
                  <TouchableOpacity
                    onPress={() => toggleRoutineItem(item.id)}
                    style={styles.checkboxTouchTarget}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isDone }}
                    accessibilityLabel={isDone ? "Mark incomplete" : "Mark completed"}
                  >
                    <Ionicons
                      name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
                      size={32}
                      color={isDone ? '#16A34A' : (isDarkMode ? '#4B5563' : '#9CA3AF')}
                    />
                  </TouchableOpacity>

                  {/* Delete Button */}
                  <TouchableOpacity
                    onPress={() => handleDeleteReminder(item)}
                    style={styles.deleteReminderBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Delete reminder"
                  >
                    <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={36} color="#9CA3AF" style={{ marginBottom: 6 }} />
              <Text style={[styles.emptyText, { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary }]}>
                {t('noklai.patientHome.noReminders', 'No reminders scheduled')}
              </Text>
              <Text style={[styles.emptySubText, { color: isDarkMode ? '#9CA3AF' : '#656F7D' }]}>
                {t('noklai.patientHome.noRemindersSub', 'You haven\'t added any reminders yet. Tap "Add" to set medication or routine reminders.')}
              </Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => setAddModalVisible(true)}
              >
                <Text style={styles.emptyAddBtnText}>{t('noklai.patientHome.addFirstReminder', '+ Add First Reminder')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </NoklaiCard>

        {/* 4 Large Patient Action Cards */}
        <View style={styles.fourCardsContainer}>
          {/* Card 1: Play a Memory Game */}
          <TouchableOpacity
            style={[
              styles.patientBigActionCard,
              {
                backgroundColor: isDarkMode ? '#221B36' : '#FAF5FF',
                borderColor: isDarkMode ? '#47366B' : '#E9D5FF',
              },
              !isDarkMode && noklaiTheme.shadows.card,
            ]}
            activeOpacity={0.85}
            onPress={onNavigateToGames}
            accessibilityRole="button"
            accessibilityLabel={t('noklai.patientHome.playMemoryGame', '1. Play a Memory Game')}
          >
            <View style={[styles.bigActionIconBadge, { backgroundColor: '#7C3AED' }]}>
              <Ionicons name="game-controller" size={28} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bigActionTitle, { color: isDarkMode ? '#E9D5FF' : '#4C1D95' }]}>
                {t('noklai.patientHome.playMemoryGame', '1. Play a Memory Game')}
              </Text>
              <Text style={[styles.bigActionSub, { color: isDarkMode ? '#CBD5E1' : '#6B7280' }]}>
                {t('noklai.patientHome.playMemoryGameSub', 'Suh Tah Lam, Dhopkhel, Ubilakapki & Northeast Memories')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={isDarkMode ? '#C4B5FD' : '#7C3AED'} />
          </TouchableOpacity>

          {/* Card 2: Continue Activity */}
          <TouchableOpacity
            style={[
              styles.patientBigActionCard,
              {
                backgroundColor: isDarkMode ? '#132A1C' : '#F0FDF4',
                borderColor: isDarkMode ? '#1F4B30' : '#BBF7D0',
              },
              !isDarkMode && noklaiTheme.shadows.card,
            ]}
            activeOpacity={0.85}
            onPress={() => onContinueActivity ? onContinueActivity('suhTahLam') : onNavigateToGames?.()}
            accessibilityRole="button"
            accessibilityLabel={t('noklai.patientHome.continueActivity', '2. Continue Activity')}
          >
            <View style={[styles.bigActionIconBadge, { backgroundColor: '#16A34A' }]}>
              <Ionicons name="play-circle" size={28} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bigActionTitle, { color: isDarkMode ? '#86EFAC' : '#14532D' }]}>
                {t('noklai.patientHome.continueActivity', '2. Continue Activity')}
              </Text>
              <Text style={[styles.bigActionSub, { color: isDarkMode ? '#CBD5E1' : '#6B7280' }]}>
                {t('noklai.patientHome.continueActivitySub', 'Resume gentle daily exercise — take your time, zero rush')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={isDarkMode ? '#86EFAC' : '#16A34A'} />
          </TouchableOpacity>

          {/* Card 3: Talk to NOKLAI */}
          <TouchableOpacity
            style={[
              styles.patientBigActionCard,
              {
                backgroundColor: isDarkMode ? '#142533' : '#F0F9FF',
                borderColor: isDarkMode ? '#23445F' : '#BAE6FD',
              },
              !isDarkMode && noklaiTheme.shadows.card,
            ]}
            activeOpacity={0.85}
            onPress={() => onOpenAI ? onOpenAI() : setAiModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('noklai.patientHome.talkNoklai', '3. Talk to NOKLAI')}
          >
            <View style={[styles.bigActionIconBadge, { backgroundColor: '#0284C7' }]}>
              <Ionicons name="sparkles" size={26} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bigActionTitle, { color: isDarkMode ? '#7DD3FC' : '#0369A1' }]}>
                {t('noklai.patientHome.talkNoklai', '3. Talk to NOKLAI')}
              </Text>
              <Text style={[styles.bigActionSub, { color: isDarkMode ? '#CBD5E1' : '#6B7280' }]}>
                {t('noklai.patientHome.talkNoklaiSub', 'Voice & chat companion for reminders, folklore & friendly talks')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={isDarkMode ? '#7DD3FC' : '#0284C7'} />
          </TouchableOpacity>

          {/* Card 4: View My Progress */}
          <TouchableOpacity
            style={[
              styles.patientBigActionCard,
              {
                backgroundColor: isDarkMode ? '#2B2313' : '#FFFBEB',
                borderColor: isDarkMode ? '#54421B' : '#FDE68A',
              },
              !isDarkMode && noklaiTheme.shadows.card,
            ]}
            activeOpacity={0.85}
            onPress={() => onNavigateToProgress ? onNavigateToProgress() : onNavigateToGames?.()}
            accessibilityRole="button"
            accessibilityLabel={t('noklai.patientHome.viewProgress', '4. View My Progress')}
          >
            <View style={[styles.bigActionIconBadge, { backgroundColor: '#D97706' }]}>
              <Ionicons name="stats-chart" size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bigActionTitle, { color: isDarkMode ? '#FCD34D' : '#92400E' }]}>
                {t('noklai.patientHome.viewProgress', '4. View My Progress')}
              </Text>
              <Text style={[styles.bigActionSub, { color: isDarkMode ? '#CBD5E1' : '#6B7280' }]}>
                {t('noklai.patientHome.viewProgressSub', 'See completed exercises, routine consistency & achievements')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={isDarkMode ? '#FCD34D' : '#D97706'} />
          </TouchableOpacity>
        </View>

        {/* Inspirational Quote Card */}
        <QuoteCard
          quote={t('noklai.patientHome.quote', 'Small steps make a big difference.')}
          author={t('noklai.patientHome.quoteAuthor', 'Noklai Care')}
        />

        {/* Add Reminder Modal */}
        <Modal visible={addModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF' },
              ]}
            >
              <View style={styles.modalHeaderRow}>
                <Text
                  style={[
                    styles.modalTitle,
                    { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
                  ]}
                >
                  {t('noklai.patientHome.addReminderTitle', 'Add Daily Reminder')}
                </Text>
                <TouchableOpacity
                  onPress={() => setAddModalVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={22} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                </TouchableOpacity>
              </View>

              {/* Title input */}
              <Text style={styles.inputLabel}>{t('noklai.patientHome.reminderNameLabel', 'Reminder Name')}</Text>
              <TextInput
                placeholder={t('noklai.patientHome.reminderNamePlaceholder', 'e.g. Afternoon Medication, Evening Walk')}
                placeholderTextColor="#9CA3AF"
                value={reminderTitle}
                onChangeText={setReminderTitle}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isDarkMode ? '#283142' : '#F4F5F0',
                    color: isDarkMode ? '#F3F4F6' : '#1E242B',
                  },
                ]}
              />

              {/* Category selector */}
              <Text style={styles.inputLabel}>{t('noklai.caregiverHome.categoryLabel', 'Category')}</Text>
              <View style={styles.categoriesRow}>
                {REMINDER_CATEGORIES.map((cat) => {
                  const isSelected = reminderCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.catOptionChip,
                        {
                          backgroundColor: isSelected
                            ? cat.color
                            : isDarkMode
                            ? '#262D3D'
                            : '#F3F4F6',
                          borderColor: isSelected ? cat.color : isDarkMode ? '#374151' : '#E5E7EB',
                        },
                      ]}
                      onPress={() => setReminderCategory(cat.id)}
                    >
                      <Ionicons
                        name={cat.icon}
                        size={14}
                        color={isSelected ? '#FFFFFF' : cat.color}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.catOptionText,
                          { color: isSelected ? '#FFFFFF' : isDarkMode ? '#E5E7EB' : '#374151' },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Time input */}
              <Text style={[styles.inputLabel, { marginTop: 10 }]}>{t('noklai.patientHome.timeLabel', 'Time')}</Text>
              <TextInput
                placeholder="08:30 AM"
                placeholderTextColor="#9CA3AF"
                value={reminderTime}
                onChangeText={setReminderTime}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isDarkMode ? '#283142' : '#F4F5F0',
                    color: isDarkMode ? '#F3F4F6' : '#1E242B',
                    marginBottom: 8,
                  },
                ]}
              />

              {/* Quick time chips */}
              <View style={styles.quickTimeRow}>
                {['08:30 AM', '12:30 PM', '04:00 PM', '07:30 PM', '09:00 PM'].map((tChip) => (
                  <TouchableOpacity
                    key={tChip}
                    onPress={() => setReminderTime(tChip)}
                    style={[
                      styles.quickTimeChip,
                      reminderTime === tChip && {
                        backgroundColor: '#16A34A',
                        borderColor: '#16A34A',
                      },
                      { borderColor: isDarkMode ? '#374151' : '#E5E7EB' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.quickTimeText,
                        reminderTime === tChip && { color: '#FFFFFF', fontWeight: '700' },
                        { color: reminderTime === tChip ? '#FFFFFF' : isDarkMode ? '#9CA3AF' : '#6B7280' },
                      ]}
                    >
                      {tChip}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalButtonsRow}>
                <NoklaiButton
                  title={t('noklai.patientHome.cancel', 'Cancel')}
                  variant="outline"
                  size="sm"
                  onPress={() => setAddModalVisible(false)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <NoklaiButton
                  title={t('noklai.patientHome.saveReminder', 'Save Reminder')}
                  variant="patient"
                  size="sm"
                  onPress={handleSaveReminder}
                  style={{ flex: 1, marginLeft: 8 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
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
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  greetingSub: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  patientNameHeading: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  calmEncourageTag: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },
  avatarCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginLeft: 12,
  },
  fourCardsContainer: {
    gap: 14,
    marginBottom: 22,
  },
  patientBigActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: noklaiTheme.radii.xl,
    borderWidth: 1.5,
  },
  bigActionIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  bigActionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  bigActionSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  gamesHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: noklaiTheme.radii.xl,
    borderWidth: 1.5,
    marginVertical: 10,
  },
  gamesHeroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gamesIconBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  gamesHeroTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 3,
  },
  gamesHeroSub: {
    fontSize: 12,
    color: '#656F7D',
    lineHeight: 16,
  },
  playArrowBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5B409E',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  addReminderHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: noklaiTheme.radii.full,
  },
  addReminderHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  scheduleCard: {
    borderRadius: noklaiTheme.radii.xl,
    overflow: 'hidden',
    marginBottom: 20,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  routineRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  categoryIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  routineTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  routineMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  routineTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  checkboxTouchTarget: {
    padding: 6,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteReminderBtn: {
    padding: 8,
    marginLeft: 4,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: '85%',
    marginBottom: 14,
  },
  emptyAddBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: noklaiTheme.radii.full,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: noklaiTheme.radii.xxl,
    padding: 22,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#656F7D',
    marginBottom: 6,
  },
  textInput: {
    borderRadius: noklaiTheme.radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  catOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: noklaiTheme.radii.full,
    borderWidth: 1,
  },
  catOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  quickTimeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickTimeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
});
