import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { noklaiTheme } from '../../theme/noklaiTheme';
import { useTheme } from '../../../context/ThemeContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useNoklai } from '../../context/NoklaiContext';
import { StatSummaryRow } from '../../components/StatTile';
import NoklaiButton from '../../components/NoklaiButton';
import NoklaiCard from '../../components/NoklaiCard';
import AIButton from '../../components/AIButton';
import {
  REMINDER_CATEGORIES,
  getCategoryMeta,
  getReminderStatus,
  getReminderStats,
  sortReminders,
} from '../../../modules/remindersHelper';

export default function CaregiverHomeScreen({ onNavigateToProgress, onNavigateToAI, onNavigateToLinked }) {
  const { isDarkMode } = useTheme();
  const { t } = useLanguage();
  const {
    caregiverName,
    caregiverAvatar,
    activePatientId,
    activePatientName,
    patientAvatar,
    setAiModalVisible,
    setActiveCaregiverSubScreen,
    computedStats,
    realRecentActivity,
    analyticsData,
    reminders = [],
    loadingReminders,
    addReminder,
    deleteReminder,
    toggleRoutineItem,
  } = useNoklai();

  // Reminder UI state
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'due_now' | 'upcoming' | 'overdue' | 'completed'
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('08:30 AM');
  const [newCategory, setNewCategory] = useState('Medication');
  const [isSubmittingReminder, setIsSubmittingReminder] = useState(false);

  const stats = useMemo(() => getReminderStats(reminders), [reminders]);

  const filteredReminders = useMemo(() => {
    if (!Array.isArray(reminders)) return [];
    const sorted = sortReminders(reminders);
    if (activeFilter === 'all') return sorted;
    return sorted.filter((r) => {
      const { status } = getReminderStatus(r);
      return status === activeFilter;
    });
  }, [reminders, activeFilter]);

  const handleSaveReminder = async () => {
    if (!newTitle.trim()) {
      Alert.alert(
        t('noklai.patientHome.missingTitle', 'Missing Title'),
        t('noklai.patientHome.missingTitleAlert', 'Please enter a reminder name.')
      );
      return;
    }
    setIsSubmittingReminder(true);
    try {
      await addReminder({
        patient_id: activePatientId,
        title: newTitle.trim(),
        time: newTime.trim() || '12:00 PM',
        category: newCategory,
        created_by: 'caregiver',
      });
      setNewTitle('');
      setNewTime('08:30 AM');
      setNewCategory('Medication');
      setAddModalVisible(false);
    } catch (e) {
      console.warn('Error adding caregiver reminder:', e);
    } finally {
      setIsSubmittingReminder(false);
    }
  };

  const handleDeleteReminder = (item) => {
    Alert.alert(
      'Delete Reminder',
      `Are you sure you want to remove "${item.title}"?`,
      [
        { text: t('noklai.patientHome.cancel', 'Cancel'), style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteReminder(item.id),
        },
      ]
    );
  };

  const handleViewProgress = () => {
    if (onNavigateToProgress) {
      onNavigateToProgress();
    } else {
      setActiveCaregiverSubScreen('progress');
    }
  };

  const handleOpenAI = () => {
    if (onNavigateToAI) {
      onNavigateToAI();
    } else {
      setAiModalVisible(true);
    }
  };

  const handleOpenLinked = () => {
    if (onNavigateToLinked) {
      onNavigateToLinked();
    } else {
      setActiveCaregiverSubScreen('linked');
    }
  };

  const hasActivity = realRecentActivity && realRecentActivity.length > 0;

  const currentHour = new Date().getHours();
  const timeGreeting = currentHour < 12
    ? t('noklai.caregiverHome.greetingMorning', 'Good morning,')
    : currentHour < 17
    ? t('noklai.caregiverHome.greetingAfternoon', 'Good afternoon,')
    : t('noklai.caregiverHome.greetingEvening', 'Good evening,');

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
        {/* Header greeting */}
        <View style={styles.headerRow}>
          <View>
            <Text
              style={[
                styles.greetingText,
                { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
              ]}
            >
              {timeGreeting}{'\n'}{caregiverName || 'Caregiver'}!
            </Text>
            <Text
              style={[
                styles.subGreetingText,
                { color: isDarkMode ? noklaiTheme.colors.textSecondaryDark : noklaiTheme.colors.textSecondary },
              ]}
            >
              {t('noklai.caregiverHome.subGreeting', "Here's how your loved ones are doing today.")}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleOpenLinked}
            style={styles.profileAvatarButton}
            accessibilityLabel="View linked loved ones"
          >
            <View style={styles.profileAvatarCircle}>
              <Text style={{ fontSize: 22 }}>{caregiverAvatar}</Text>
            </View>
            <View style={styles.profileBadgeDot} />
          </TouchableOpacity>
        </View>

        {/* Active Patient Card / Link Prompt */}
        {!activePatientId ? (
          <View
            style={[
              styles.patientCard,
              {
                backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF',
                borderColor: isDarkMode ? '#2D3545' : '#E8EAE3',
                alignItems: 'center',
                paddingVertical: 28,
                paddingHorizontal: 20,
              },
              !isDarkMode && noklaiTheme.shadows.card,
            ]}
          >
            <View style={[styles.avatarCircle, { backgroundColor: isDarkMode ? '#232938' : '#F1F5F9', marginBottom: 12 }]}>
              <Ionicons name="person-add-outline" size={26} color={noklaiTheme.colors.primary} />
            </View>
            <Text
              style={[
                styles.patientName,
                { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary, textAlign: 'center', marginBottom: 6 },
              ]}
            >
              No loved one connected yet
            </Text>
            <Text
              style={[
                styles.scheduleSubText,
                { color: isDarkMode ? noklaiTheme.colors.textSecondaryDark : noklaiTheme.colors.textSecondary, textAlign: 'center', marginBottom: 16 },
              ]}
            >
              Connect your loved one using their connection code to monitor schedules, game scores, and cognitive vitality in real time.
            </Text>
            <NoklaiButton
              title="Connect Loved One"
              variant="primary"
              size="md"
              iconRight="link-outline"
              onPress={handleOpenLinked}
              style={{ width: '100%' }}
            />
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handleViewProgress}
            style={[
              styles.patientCard,
              {
                backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF',
                borderColor: isDarkMode ? '#2D3545' : '#E8EAE3',
              },
              !isDarkMode && noklaiTheme.shadows.card,
            ]}
          >
            <View style={styles.patientCardTop}>
              <View style={styles.patientInfoRow}>
                <View style={[styles.avatarCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={{ fontSize: 26 }}>{patientAvatar}</Text>
                </View>
                <View style={styles.patientNameCol}>
                  <Text
                    style={[
                      styles.patientName,
                      { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
                    ]}
                  >
                    {activePatientName}
                  </Text>
                  <View style={styles.statusIndicatorRow}>
                    <View style={[styles.greenActiveDot, { backgroundColor: hasActivity ? '#16A34A' : '#9CA3AF' }]} />
                    <Text style={[styles.statusText, { color: hasActivity ? '#16A34A' : '#656F7D' }]}>
                      {hasActivity
                        ? t('noklai.caregiverHome.activeToday', 'Active today')
                        : t('noklai.caregiverHome.readyForExercises', 'Ready for exercises')}
                    </Text>
                    {analyticsData && analyticsData.vitalityIndex !== null && analyticsData.vitalityIndex !== undefined && (
                      <View style={styles.cviMiniBadge}>
                        <Text style={styles.cviMiniBadgeText}>CVI: {analyticsData.vitalityIndex}%</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={22}
                color={isDarkMode ? '#9CA3AF' : '#656F7D'}
              />
            </View>

            {/* REAL STATS ROW - No fake defaults */}
            <StatSummaryRow
              gamesToday={computedStats.gamesToday}
              avgAccuracy={computedStats.avgAccuracy !== null ? computedStats.avgAccuracy : '--'}
              playTimeMinutes={computedStats.totalPlayTimeMinutes}
            />

            {/* View Detailed Progress CTA Button */}
            <NoklaiButton
              title={t('noklai.caregiverHome.viewDetailedProgress', 'View Detailed Progress')}
              variant="primary"
              size="md"
              iconRight="arrow-forward"
              onPress={handleViewProgress}
              style={styles.ctaButton}
            />
          </TouchableOpacity>
        )}

        {/* Daily Care Schedule & Reminders Section */}
        <View style={styles.scheduleSectionHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
                ]}
              >
                {t('noklai.caregiverHome.scheduleTitle', 'Daily Schedule & Reminders')}
              </Text>
              {stats.dueNow > 0 && (
                <View style={styles.dueNowBadge}>
                  <Text style={styles.dueNowBadgeText}>{stats.dueNow} Due</Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.scheduleSubText,
                { color: isDarkMode ? noklaiTheme.colors.textSecondaryDark : noklaiTheme.colors.textSecondary },
              ]}
            >
              {activePatientName}&apos;s medication, routines & activities
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addReminderHeaderBtn}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.8}
            accessibilityLabel="Add care reminder"
          >
            <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.addReminderHeaderBtnText}>{t('noklai.patientHome.add', 'Add')}</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {[
            { key: 'all', label: `${t('noklai.caregiverHome.tabAll', 'All')} (${stats.total})` },
            { key: 'due_now', label: `⏰ ${t('noklai.caregiverHome.tabDueNow', 'Due Now')} (${stats.dueNow})`, alert: stats.dueNow > 0 },
            { key: 'upcoming', label: `${t('noklai.caregiverHome.tabUpcoming', 'Upcoming')} (${stats.upcoming})` },
            { key: 'overdue', label: `⚠️ ${t('noklai.caregiverHome.tabOverdue', 'Overdue')} (${stats.overdue})`, warn: stats.overdue > 0 },
            { key: 'completed', label: `✓ ${t('noklai.caregiverHome.tabCompleted', 'Completed')} (${stats.completed})` },
          ].map((tab) => {
            const isSelected = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveFilter(tab.key)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected
                      ? noklaiTheme.colors.primary
                      : isDarkMode
                      ? '#222836'
                      : '#F1F3F5',
                    borderColor: isSelected
                      ? noklaiTheme.colors.primary
                      : tab.alert
                      ? '#F97316'
                      : tab.warn
                      ? '#EF4444'
                      : isDarkMode
                      ? '#333D50'
                      : '#E5E7EB',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    {
                      color: isSelected
                        ? '#FFFFFF'
                        : tab.alert
                        ? '#EA580C'
                        : tab.warn
                        ? '#DC2626'
                        : isDarkMode
                        ? '#CBD5E1'
                        : '#4B5563',
                      fontWeight: isSelected ? '700' : '600',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <NoklaiCard style={styles.scheduleCard} padded={false}>
          {loadingReminders ? (
            <View style={styles.emptyScheduleContainer}>
              <ActivityIndicator size="small" color={noklaiTheme.colors.primary} />
              <Text style={[styles.emptyScheduleText, { color: isDarkMode ? '#9CA3AF' : '#656F7D' }]}>
                {t('noklai.patientHome.checkingReminders', 'Checking schedule...')}
              </Text>
            </View>
          ) : filteredReminders.length > 0 ? (
            filteredReminders.map((item, index) => {
              const statusMeta = getReminderStatus(item);
              const catMeta = getCategoryMeta(item.category);
              const isDone = item.completed || item.done;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.reminderItemRow,
                    index < filteredReminders.length - 1 && styles.reminderRowBorder,
                    isDone && { backgroundColor: isDarkMode ? '#142318' : '#F6FBF7' },
                  ]}
                >
                  {/* Category Icon Badge */}
                  <View style={[styles.categoryIconBadge, { backgroundColor: catMeta.badgeBg }]}>
                    <Ionicons name={catMeta.icon} size={20} color={catMeta.color} />
                  </View>

                  {/* Main Info */}
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text
                      style={[
                        styles.reminderTitleText,
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

                    <View style={styles.reminderMetaRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
                        <Ionicons name="time-outline" size={13} color={isDarkMode ? '#9CA3AF' : '#6B7280'} style={{ marginRight: 4 }} />
                        <Text style={[styles.reminderTimeText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                          {item.time}
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

                  {/* Interactive Toggle Checkbox */}
                  <TouchableOpacity
                    onPress={() => toggleRoutineItem(item.id)}
                    style={styles.toggleBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={isDone ? "Mark incomplete" : "Mark completed"}
                  >
                    <Ionicons
                      name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
                      size={28}
                      color={isDone ? '#16A34A' : (isDarkMode ? '#4B5563' : '#9CA3AF')}
                    />
                  </TouchableOpacity>

                  {/* Delete Button */}
                  <TouchableOpacity
                    onPress={() => handleDeleteReminder(item)}
                    style={styles.deleteBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Delete reminder"
                  >
                    <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyScheduleContainer}>
              <Ionicons name="calendar-outline" size={36} color="#9CA3AF" style={{ marginBottom: 6 }} />
              <Text style={[styles.emptyScheduleText, { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary }]}>
                {t('noklai.caregiverHome.noRemindersTitle', 'No reminders in this view')}
              </Text>
              <Text style={[styles.emptyScheduleSubText, { color: isDarkMode ? '#9CA3AF' : '#656F7D' }]}>
                {t('noklai.caregiverHome.noRemindersSub', "Keep your loved one on track. Set medication, meals, or gentle exercises.")}
              </Text>
              <TouchableOpacity
                style={styles.addFirstBtn}
                onPress={() => setAddModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.addFirstBtnText}>
                  {t('noklai.caregiverHome.addFirstReminder', '+ Add First Reminder')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </NoklaiCard>

        {/* AI Assistant Quick Banner */}
        <AIButton
          label={t('noklai.caregiverHome.aiBannerTitle', 'Noklai AI Assistant')}
          sublabel={t('noklai.caregiverHome.aiBannerSub', 'Ask about %{name}\'s cognitive progress & daily routine', { name: activePatientName })}
          onPress={handleOpenAI}
        />

        {/* Quick Insights Highlight - Real Data Aware */}
        <View style={styles.sectionHeaderRow}>
          <Text
            style={[
              styles.sectionTitle,
              { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
            ]}
          >
            {t('noklai.caregiverHome.highlights', "Today's Highlights")}
          </Text>
          <TouchableOpacity onPress={() => setActiveCaregiverSubScreen('insights')}>
            <Text style={styles.seeAllText}>{t('noklai.caregiverHome.viewInsights', 'View Insights')}</Text>
          </TouchableOpacity>
        </View>

        <NoklaiCard style={styles.insightHighlightCard}>
          <View style={styles.insightHighlightRow}>
            <View style={[styles.insightIconBadge, { backgroundColor: hasActivity ? '#DCFCE7' : '#EFF6FF' }]}>
              <Ionicons
                name={hasActivity ? 'trending-up' : 'game-controller-outline'}
                size={20}
                color={hasActivity ? '#16A34A' : '#2563EB'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.insightHighlightTitle,
                  { color: isDarkMode ? (hasActivity ? '#86EFAC' : '#93C5FD') : (hasActivity ? '#15803D' : '#1E40AF') },
                ]}
              >
                {hasActivity
                  ? t('noklai.caregiverHome.engagingTitle', '%{name} is engaging with games!', { name: activePatientName })
                  : t('noklai.caregiverHome.readyTitle', 'Ready for first session')}
              </Text>
              <Text
                style={[
                  styles.insightHighlightBody,
                  { color: isDarkMode ? '#D1D5DB' : '#374151' },
                ]}
              >
                {hasActivity
                  ? t('noklai.caregiverHome.engagingBody', 'Completed %{sessions} session(s) today with %{accuracy}% overall accuracy.', { sessions: computedStats.gamesToday, accuracy: computedStats.avgAccuracy ?? 0 })
                  : t('noklai.caregiverHome.readyBody', "No gameplay recorded yet today. Suggesting Suh Tah Lam (Bamboo Rhythm) to start the day's cognitive routine.")}
              </Text>
            </View>
          </View>
        </NoklaiCard>

        {/* Recent Activity List - REAL SESSIONS ONLY */}
        <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
          <Text
            style={[
              styles.sectionTitle,
              { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
            ]}
          >
            {t('noklai.caregiverHome.recentActivity', 'Recent Activity')}
          </Text>
          {hasActivity && (
            <TouchableOpacity onPress={() => setActiveCaregiverSubScreen('history')}>
              <Text style={styles.seeAllText}>{t('noklai.caregiverHome.seeAll', 'See all')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {hasActivity ? (
          <View style={styles.activityList}>
            {realRecentActivity.slice(0, 3).map((item) => (
              <View
                key={item.id}
                style={[
                  styles.activityItem,
                  {
                    backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF',
                    borderColor: isDarkMode ? '#2D3545' : '#E8EAE3',
                  },
                ]}
              >
                <View style={[styles.activityIconCircle, { backgroundColor: '#F0ECF9' }]}>
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.activityTitle,
                      { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
                    ]}
                  >
                    {t('noklai.caregiverHome.playedGame', 'Played %{game}', { game: item.game })}
                  </Text>
                  <Text style={styles.activityTime}>{item.day} • {item.time}</Text>
                </View>
                <View style={styles.activityScoreBadge}>
                  <Text style={styles.activityScoreText}>{item.score}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <NoklaiCard style={styles.emptyActivityCard}>
            <Ionicons name="game-controller-outline" size={28} color="#9CA3AF" style={{ marginBottom: 6 }} />
            <Text style={[styles.emptyActivityTitle, { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary }]}>
              {t('noklai.caregiverHome.noSessionsTitle', 'No gameplay sessions yet')}
            </Text>
            <Text style={[styles.emptyActivitySub, { color: isDarkMode ? '#9CA3AF' : '#656F7D' }]}>
              {t('noklai.caregiverHome.noSessionsSub', 'Once %{name} completes brain exercises, authentic session accuracy and scores will appear here.', { name: activePatientName })}
            </Text>
          </NoklaiCard>
        )}

        {/* Cognitive Focus Areas (In Simple Terms) */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <Text
            style={[
              styles.sectionTitle,
              { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
            ]}
          >
            {t('noklai.caregiverHome.cognitiveAreas', 'Cognitive Areas Practiced')}
          </Text>
        </View>

        <View style={styles.domainsGrid}>
          <View
            style={[
              styles.domainCard,
              {
                backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF',
                borderColor: isDarkMode ? '#2D3545' : '#E5E7EB',
              },
              !isDarkMode && noklaiTheme.shadows.card,
            ]}
          >
            <View style={[styles.domainIconCircle, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="bulb-outline" size={20} color="#7C3AED" />
            </View>
            <Text style={[styles.domainTitle, { color: isDarkMode ? '#E9D5FF' : '#4C1D95' }]}>
              Memory
            </Text>
            <Text style={[styles.domainDesc, { color: isDarkMode ? '#9CA3AF' : '#656F7D' }]}>
              Recalling traditional patterns, scenic landmarks & folklore
            </Text>
          </View>

          <View
            style={[
              styles.domainCard,
              {
                backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF',
                borderColor: isDarkMode ? '#2D3545' : '#E5E7EB',
              },
              !isDarkMode && noklaiTheme.shadows.card,
            ]}
          >
            <View style={[styles.domainIconCircle, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="eye-outline" size={20} color="#15803D" />
            </View>
            <Text style={[styles.domainTitle, { color: isDarkMode ? '#86EFAC' : '#15803D' }]}>
              Focus & Attention
            </Text>
            <Text style={[styles.domainDesc, { color: isDarkMode ? '#9CA3AF' : '#656F7D' }]}>
              Tracking movements, rhythm steps & visual attention
            </Text>
          </View>

          <View
            style={[
              styles.domainCard,
              {
                backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF',
                borderColor: isDarkMode ? '#2D3545' : '#E5E7EB',
              },
              !isDarkMode && noklaiTheme.shadows.card,
            ]}
          >
            <View style={[styles.domainIconCircle, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="hand-left-outline" size={20} color="#1D4ED8" />
            </View>
            <Text style={[styles.domainTitle, { color: isDarkMode ? '#93C5FD' : '#1E40AF' }]}>
              Reaction & Coordination
            </Text>
            <Text style={[styles.domainDesc, { color: isDarkMode ? '#9CA3AF' : '#656F7D' }]}>
              Gentle hand-eye rhythm and spatial decision timing
            </Text>
          </View>
        </View>


        {/* Clear Non-Medical Disclaimer */}
        <View
          style={[
            styles.disclaimerBox,
            {
              backgroundColor: isDarkMode ? '#17202A' : '#F8FAFC',
              borderColor: isDarkMode ? '#2E3D4F' : '#E2E8F0',
            },
          ]}
        >
          <Ionicons name="information-circle" size={20} color="#64748B" style={{ marginRight: 8, marginTop: 1 }} />
          <Text style={[styles.disclaimerText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            NOKLAI provides supportive cognitive activities and progress insights. It does not diagnose dementia or replace professional medical advice.
          </Text>
        </View>
      </ScrollView>

      {/* Modal for Adding Reminder */}
      <Modal
        visible={addModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF',
                borderColor: isDarkMode ? '#2D3545' : '#E5E7EB',
              },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.modalTitle,
                    { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
                  ]}
                >
                  {t('noklai.caregiverHome.addModalTitle', 'Add Reminder for %{name}', { name: activePatientName })}
                </Text>
                <Text style={[styles.modalSubTitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                  {t('noklai.caregiverHome.addModalSub', 'This schedule syncs live with %{name}\'s tablet/phone.', { name: activePatientName })}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setAddModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>
            </View>

            {/* Title Input */}
            <Text style={[styles.inputLabel, { color: isDarkMode ? '#D1D5DB' : '#374151' }]}>
              {t('noklai.caregiverHome.reminderTitleLabel', 'Reminder Title *')}
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDarkMode ? '#111827' : '#F9FAFB',
                  color: isDarkMode ? '#FFFFFF' : '#111827',
                  borderColor: isDarkMode ? '#374151' : '#D1D5DB',
                },
              ]}
              placeholder={t('noklai.caregiverHome.titlePlaceholder', 'e.g., Morning Blood Pressure, Lunch')}
              placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            {/* Category Selector */}
            <Text style={[styles.inputLabel, { color: isDarkMode ? '#D1D5DB' : '#374151' }]}>
              {t('noklai.caregiverHome.categoryLabel', 'Category')}
            </Text>
            <View style={styles.categoriesRow}>
              {REMINDER_CATEGORIES.map((cat) => {
                const isSelected = newCategory === cat.id;
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
                    onPress={() => setNewCategory(cat.id)}
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

            {/* Time Input & Quick presets */}
            <Text style={[styles.inputLabel, { color: isDarkMode ? '#D1D5DB' : '#374151', marginTop: 10 }]}>
              {t('noklai.caregiverHome.timeLabel', 'Scheduled Time')}
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDarkMode ? '#111827' : '#F9FAFB',
                  color: isDarkMode ? '#FFFFFF' : '#111827',
                  borderColor: isDarkMode ? '#374151' : '#D1D5DB',
                  marginBottom: 8,
                },
              ]}
              placeholder="08:30 AM"
              placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
              value={newTime}
              onChangeText={setNewTime}
            />

            <View style={styles.quickTimeRow}>
              {['08:30 AM', '12:30 PM', '04:00 PM', '07:30 PM', '09:00 PM'].map((tChip) => (
                <TouchableOpacity
                  key={tChip}
                  onPress={() => setNewTime(tChip)}
                  style={[
                    styles.quickTimeChip,
                    newTime === tChip && {
                      backgroundColor: noklaiTheme.colors.primary,
                      borderColor: noklaiTheme.colors.primary,
                    },
                    { borderColor: isDarkMode ? '#374151' : '#E5E7EB' },
                  ]}
                >
                  <Text
                    style={[
                      styles.quickTimeText,
                      newTime === tChip && { color: '#FFFFFF', fontWeight: '700' },
                      { color: newTime === tChip ? '#FFFFFF' : isDarkMode ? '#9CA3AF' : '#6B7280' },
                    ]}
                  >
                    {tChip}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}
                onPress={() => setAddModalVisible(false)}
                disabled={isSubmittingReminder}
              >
                <Text style={[styles.modalCancelText, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                  {t('noklai.patientHome.cancel', 'Cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, isSubmittingReminder && { opacity: 0.7 }]}
                onPress={handleSaveReminder}
                disabled={isSubmittingReminder}
              >
                {isSubmittingReminder ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>
                    {t('noklai.caregiverHome.saveReminder', 'Save Reminder')}
                  </Text>
                )}
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
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  subGreetingText: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 18,
  },
  profileAvatarButton: {
    position: 'relative',
    marginTop: 4,
  },
  profileAvatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileBadgeDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  patientCard: {
    borderRadius: noklaiTheme.radii.xxl,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  patientCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  patientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  patientNameCol: {},
  patientName: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 2,
  },
  statusIndicatorRow: {
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
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ctaButton: {
    marginTop: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: noklaiTheme.colors.primary,
  },
  insightHighlightCard: {
    padding: 14,
    borderRadius: noklaiTheme.radii.xl,
  },
  insightHighlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  insightIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  insightHighlightTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  insightHighlightBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  activityList: {
    gap: 10,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: noklaiTheme.radii.lg,
    borderWidth: 1,
  },
  activityIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  activityTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  activityScoreBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activityScoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
  },
  emptyActivityCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: noklaiTheme.radii.xl,
  },
  emptyActivityTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyActivitySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  cviMiniBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  cviMiniBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  domainsGrid: {
    gap: 10,
    marginBottom: 8,
  },
  domainCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: noklaiTheme.radii.lg,
    borderWidth: 1,
  },
  domainIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  domainTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  domainDesc: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },

  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: noklaiTheme.radii.lg,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 10,
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },

  /* Reminder Schedule Styles */
  scheduleCard: {
    borderRadius: noklaiTheme.radii.xxl,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  scheduleSectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  scheduleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  scheduleSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  scheduleHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dueNowBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dueNowBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  addScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: noklaiTheme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: noklaiTheme.radii.full,
  },
  addScheduleBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
    paddingBottom: 4,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: noklaiTheme.radii.full,
    borderWidth: 1,
  },
  filterPillActive: {
    backgroundColor: noklaiTheme.colors.primary,
    borderColor: noklaiTheme.colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  reminderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  reminderRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  categoryIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reminderTitleText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  reminderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reminderTimeText: {
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
  toggleBtn: {
    padding: 6,
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 2,
  },
  emptyScheduleContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyScheduleText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyScheduleSubText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: '85%',
    marginBottom: 14,
  },
  addFirstBtn: {
    backgroundColor: noklaiTheme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: noklaiTheme.radii.full,
  },
  addFirstBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: noklaiTheme.radii.xxl,
    borderWidth: 1,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  modalSubTitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  modalCloseBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
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
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: noklaiTheme.radii.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    flex: 2,
    backgroundColor: noklaiTheme.colors.primary,
    paddingVertical: 12,
    borderRadius: noklaiTheme.radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
