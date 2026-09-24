import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { noklaiTheme } from '../../theme/noklaiTheme';
import { useTheme } from '../../../context/ThemeContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useNoklai } from '../../context/NoklaiContext';
import { MemoryService } from '../../../services/MemoryService';
import MemoryModal from '../../components/MemoryModal';
import InlineAuthCard from '../../components/InlineAuthCard';

const { width } = Dimensions.get('window');

export default function CaregiverMemoryScreen() {
  const { isDarkMode } = useTheme();
  const { currentLanguage } = useLanguage();
  const { activePatientId, activePatientName } = useNoklai();

  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isLinkedCaregiver, setIsLinkedCaregiver] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { supabase } = await import('../../../modules/supabaseClient');
      const { data: authData } = await supabase.auth.getSession();
      const user = authData?.session?.user;
      const hasAuth = Boolean(user);
      setIsAuthenticated(hasAuth);

      if (hasAuth) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        const userIsAdmin = profile?.role === 'admin';
        setIsAdmin(userIsAdmin);

        if (activePatientId) {
          const link = await MemoryService.getCaregiverLink(activePatientId, user.id);
          setIsLinkedCaregiver(Boolean(link) || userIsAdmin);
          const result = await MemoryService.fetchMemories(activePatientId);
          if (result.memories) {
            setMemories(result.memories);
          }
        }
      } else {
        setMemories([]);
      }
    } catch (err) {
      console.warn('CaregiverMemoryScreen load error:', err);
    } finally {
      setLoading(false);
    }
  }, [activePatientId]);

  useEffect(() => {
    loadData();
  }, [activePatientId]);

  const handleDelete = (item) => {
    const isUploader = item.uploaded_by === currentUserId;
    const canDelete = isUploader || isLinkedCaregiver || isAdmin;

    if (!canDelete) {
      Alert.alert(
        'Permission Restricted',
        'Only linked caregivers or the original uploader can delete memories.'
      );
      return;
    }

    Alert.alert(
      'Remove Photo from Memories?',
      `Are you sure you want to remove "${item.person_name}"? To protect against accidental loss of emotional photos, this memory will be archived for 30 days before permanent deletion.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive / Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await MemoryService.softDeleteMemory(item.id);
            if (res.success) {
              Alert.alert('Archived', 'Photo has been removed from patient viewing.');
              loadData();
            } else {
              Alert.alert('Error', res.error || 'Could not delete memory.');
            }
          },
        },
      ]
    );
  };

  const renderMemoryCard = ({ item }) => {
    const isUploader = item.uploaded_by === currentUserId;
    const canDelete = isUploader || isLinkedCaregiver || isAdmin;

    let uploadDateStr = 'Recently';
    try {
      uploadDateStr = new Date(item.created_at).toLocaleDateString();
    } catch {}

    return (
      <View
        style={[
          styles.memoryCard,
          {
            backgroundColor: isDarkMode ? noklaiTheme.colors.cardDark : '#FFF',
            borderColor: isDarkMode ? '#444' : '#E8E4DF',
          },
        ]}
      >
        <Image
          source={{ uri: item.signed_url }}
          style={styles.thumbnail}
          resizeMode="cover"
        />

        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text
              style={[
                styles.cardName,
                { color: isDarkMode ? noklaiTheme.colors.textDark : noklaiTheme.colors.text },
              ]}
              numberOfLines={1}
            >
              {item.person_name}
            </Text>
            <View style={styles.relationBadge}>
              <Text style={styles.relationBadgeText}>{item.relation}</Text>
            </View>
          </View>

          {item.notes ? (
            <Text style={styles.notesSnippet} numberOfLines={2}>
              "{item.notes}"
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.uploaderTag}>
              <Ionicons
                name={isUploader ? 'person' : 'people'}
                size={12}
                color="#666"
              />
              <Text style={styles.uploaderText}>
                {isUploader ? 'Uploaded by you' : 'Family member'} • {uploadDateStr}
              </Text>
            </View>
          </View>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => {
                setEditItem(item);
                setShowAddModal(true);
              }}
            >
              <Ionicons name="pencil" size={14} color="#5B409E" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteBtn, !canDelete && styles.deleteBtnDisabled]}
              onPress={() => handleDelete(item)}
            >
              <Ionicons
                name="trash-outline"
                size={14}
                color={canDelete ? '#C0392B' : '#AAA'}
              />
              <Text style={[styles.deleteBtnText, !canDelete && { color: '#AAA' }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text
            style={[
              styles.headerTitle,
              { color: isDarkMode ? noklaiTheme.colors.textDark : noklaiTheme.colors.text },
            ]}
          >
            Family Memory Album
          </Text>
          <Text style={styles.headerSubtitle}>
            Managing photos for {activePatientName || 'Patient'}
          </Text>
        </View>

        {isAuthenticated && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              setEditItem(null);
              setShowAddModal(true);
            }}
          >
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={styles.addBtnText}>Add Photo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Caregiver / Admin Status Indicator */}
      {isAuthenticated && isAdmin && (
        <View style={[styles.primaryBadge, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
          <Ionicons name="shield" size={14} color="#B45309" />
          <Text style={[styles.primaryBadgeText, { color: '#92400E' }]}>
            Administrator Access: Full cross-patient view and edit privileges.
          </Text>
        </View>
      )}

      {isAuthenticated && !isAdmin && isLinkedCaregiver && (
        <View style={styles.primaryBadge}>
          <Ionicons name="shield-checkmark" size={14} color="#2E7D32" />
          <Text style={styles.primaryBadgeText}>
            Linked Caregiver: You have access to manage family memories for this patient.
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#5B409E" />
        </View>
      ) : !isAuthenticated ? (
        /* Embedded Sign-In Card */
        <InlineAuthCard
          initialRole="caregiver"
          title="Sign In to Manage Family Memories"
          subtitle="Memory photos are protected with strict row-level security. Sign in to upload photos, edit descriptions, or link family members."
          onSuccess={() => {
            loadData();
          }}
        />
      ) : memories.length === 0 ? (
        /* Empty State */
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: isDarkMode ? noklaiTheme.colors.cardDark : '#FFF' },
          ]}
        >
          <Text style={styles.emptyEmoji}>📸</Text>
          <Text
            style={[
              styles.emptyTitle,
              { color: isDarkMode ? noklaiTheme.colors.textDark : noklaiTheme.colors.text },
            ]}
          >
            No Family Photos Yet
          </Text>
          <Text style={styles.emptyDesc}>
            Upload photos of sons, daughters, grandchildren, and friends. The patient can view them in a calm, dementia-friendly format with spoken names.
          </Text>
          <TouchableOpacity
            style={styles.addFirstBtn}
            onPress={() => {
              setEditItem(null);
              setShowAddModal(true);
            }}
          >
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={styles.addFirstBtnText}>Upload First Photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* List of Memories */
        <FlatList
          data={memories}
          keyExtractor={(item) => item.id}
          renderItem={renderMemoryCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add / Edit Modal */}
      <MemoryModal
        visible={showAddModal}
        patientId={activePatientId}
        editMemory={editItem}
        onClose={() => {
          setShowAddModal(false);
          setEditItem(null);
        }}
        onSuccess={() => {
          loadData();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#5B409E',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryBadgeText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  centerContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 18,
    paddingBottom: 40,
    gap: 14,
  },
  memoryCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  thumbnail: {
    width: 110,
    height: 125,
    backgroundColor: '#EEE',
  },
  cardBody: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    fontSize: 17,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 6,
  },
  relationBadge: {
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  relationBadgeText: {
    color: '#5B409E',
    fontSize: 11,
    fontWeight: 'bold',
  },
  notesSnippet: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  uploaderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  uploaderText: {
    fontSize: 11,
    color: '#888',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F3E5F5',
  },
  editBtnText: {
    color: '#5B409E',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FDEDEC',
  },
  deleteBtnDisabled: {
    backgroundColor: '#F5F5F5',
  },
  deleteBtnText: {
    color: '#C0392B',
    fontSize: 12,
    fontWeight: '600',
  },
  authCard: {
    margin: 20,
    padding: 24,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E4DF',
  },
  lockIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EDE7F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  authTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  authDesc: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  signInBtn: {
    backgroundColor: '#5B409E',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  signInBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyCard: {
    margin: 20,
    padding: 30,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E4DF',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  addFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#5B409E',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addFirstBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

