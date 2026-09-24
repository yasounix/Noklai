import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { noklaiTheme } from '../../theme/noklaiTheme';
import { useTheme } from '../../../context/ThemeContext';
import { useNoklai } from '../../context/NoklaiContext';
import NoklaiHeader from '../../components/NoklaiHeader';
import QuoteCard from '../../components/QuoteCard';
import { getFamilyMembers } from '../../../modules/database';

export default function PatientMemoriesScreen() {
  const { isDarkMode } = useTheme();
  const { activePatient } = useNoklai();

  const [family, setFamily] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFamily() {
      if (!activePatient?.id) {
        setFamily([]);
        setLoading(false);
        return;
      }
      try {
        const data = await getFamilyMembers(activePatient.id);
        setFamily(Array.isArray(data) ? data : []);
      } catch (e) {
        setFamily([]);
      } finally {
        setLoading(false);
      }
    }
    loadFamily();
  }, [activePatient?.id]);

  const handleCallMember = (member) => {
    Alert.alert('Call Loved One', `Dialing ${member.name} (${member.relation || member.relationship || 'Loved One'})...`, [{ text: 'OK' }]);
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
      <NoklaiHeader title="Family & Memories" />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerBox}>
          <Text
            style={[
              styles.screenTitle,
              { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
            ]}
          >
            Your Loved Ones
          </Text>
          <Text
            style={[
              styles.screenSubtitle,
              { color: isDarkMode ? noklaiTheme.colors.textSecondaryDark : noklaiTheme.colors.textSecondary },
            ]}
          >
            People who love and care for you. Tap to call or remember cherished stories.
          </Text>
        </View>

        {/* Family Cards or Empty State */}
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ color: isDarkMode ? '#9CA3AF' : '#656F7D' }}>Loading family memories...</Text>
          </View>
        ) : family && family.length > 0 ? (
          <View style={styles.familyList}>
            {family.map((member) => (
              <View
                key={member.id}
                style={[
                  styles.memberCard,
                  {
                    backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF',
                    borderColor: isDarkMode ? '#2D3545' : '#E8EAE3',
                  },
                  !isDarkMode && noklaiTheme.shadows.card,
                ]}
              >
                <View style={styles.topRow}>
                  <View style={[styles.avatarCircle, { backgroundColor: '#EDE9FE' }]}>
                    <Text style={{ fontSize: 32 }}>{member.avatar || '👤'}</Text>
                  </View>

                  <View style={styles.memberInfoCol}>
                    <Text
                      style={[
                        styles.memberName,
                        { color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary },
                      ]}
                    >
                      {member.name}
                    </Text>
                    <View style={styles.relationBadge}>
                      <Text style={styles.relationText}>{member.relation || member.relationship || 'Loved One'}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.callCircleButton}
                    onPress={() => handleCallMember(member)}
                    accessibilityLabel={`Call ${member.name}`}
                  >
                    <Ionicons name="call" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {member.notes && (
                  <View
                    style={[
                      styles.memoryNoteBox,
                      {
                        backgroundColor: isDarkMode ? '#18241D' : '#F2FAF4',
                        borderColor: isDarkMode ? '#23442E' : '#D1EAD8',
                      },
                    ]}
                  >
                    <Ionicons name="heart" size={16} color="#16A34A" style={{ marginRight: 8, marginTop: 1 }} />
                    <Text
                      style={[
                        styles.memoryNoteText,
                        { color: isDarkMode ? '#A7F3D0' : '#14532D' },
                      ]}
                    >
                      {member.notes}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.memberCard,
              {
                backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF',
                borderColor: isDarkMode ? '#2D3545' : '#E8EAE3',
                alignItems: 'center',
                paddingVertical: 36,
                paddingHorizontal: 20,
              },
            ]}
          >
            <Ionicons name="people-outline" size={44} color="#9CA3AF" style={{ marginBottom: 12 }} />
            <Text
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: isDarkMode ? noklaiTheme.colors.textPrimaryDark : noklaiTheme.colors.textPrimary,
                marginBottom: 6,
                textAlign: 'center',
              }}
            >
              No family members added yet
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: isDarkMode ? '#9CA3AF' : '#656F7D',
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              Ask your caregiver to add family members and photos in your profile.
            </Text>
          </View>
        )}

        <QuoteCard
          quote="Every smile remembers love."
          author="Noklai Family"
        />
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
  headerBox: {
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  screenSubtitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  familyList: {
    gap: 14,
  },
  memberCard: {
    borderRadius: noklaiTheme.radii.xl,
    borderWidth: 1,
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  memberInfoCol: {
    flex: 1,
  },
  memberName: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 3,
  },
  relationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0ECF9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  relationText: {
    color: '#5B409E',
    fontWeight: '700',
    fontSize: 12,
  },
  callCircleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: noklaiTheme.radii.lg,
    borderWidth: 1,
    marginTop: 12,
  },
  memoryNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});

