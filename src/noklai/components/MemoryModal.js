import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { noklaiTheme } from '../theme/noklaiTheme';
import { useTheme } from '../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MemoryService, RELATION_OPTIONS } from '../../services/MemoryService';

export default function MemoryModal({
  visible,
  onClose,
  onSuccess,
  patientId,
  editMemory = null,
}) {
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [photoUri, setPhotoUri] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [photoMime, setPhotoMime] = useState('image/jpeg');
  const [personName, setPersonName] = useState('');
  const [relation, setRelation] = useState('Son');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isEdit = Boolean(editMemory);

  useEffect(() => {
    if (editMemory) {
      setPersonName(editMemory.person_name || '');
      setRelation(editMemory.relation || 'Son');
      setNotes(editMemory.notes || '');
      setPhotoUri(editMemory.signed_url || null);
      setPhotoBase64(null);
    } else {
      setPhotoUri(null);
      setPhotoBase64(null);
      setPersonName('');
      setRelation('Son');
      setNotes('');
    }
    setErrorMessage('');
  }, [editMemory, visible]);

  const handlePickImage = async () => {
    setErrorMessage('');
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Needed',
          'Permission to access photos is needed to upload family pictures.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 4],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        // Enforce client-side 5MB preview guard
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          setErrorMessage('Photo exceeds 5MB limit. Please choose a smaller image.');
          return;
        }

        setPhotoUri(asset.uri);
        setPhotoBase64(asset.base64 || null);
        setPhotoMime(asset.mimeType || (asset.uri.endsWith('.png') ? 'image/png' : 'image/jpeg'));
        setErrorMessage('');
      }
    } catch (err) {
      console.warn('Image picker error:', err);
      setErrorMessage('Could not open image picker.');
    }
  };

  const handleSave = async () => {
    if (!personName.trim()) {
      setErrorMessage("Please enter the person's name.");
      return;
    }

    if (!isEdit && !photoUri) {
      setErrorMessage('Please select a photo of the person.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      if (isEdit) {
        const updateRes = await MemoryService.updateMemory({
          memoryId: editMemory.id,
          personName: personName.trim(),
          relation,
          notes: notes.trim(),
        });

        if (!updateRes.success) {
          setErrorMessage(updateRes.error || 'Failed to update memory.');
          setLoading(false);
          return;
        }

        if (onSuccess) onSuccess(updateRes.memory);
        onClose();
      } else {
        const uploadRes = await MemoryService.uploadMemoryPhoto({
          photoUri,
          base64: photoBase64,
          patientId,
          personName: personName.trim(),
          relation,
          notes: notes.trim(),
          mimeType: photoMime,
        });

        if (!uploadRes.success) {
          setErrorMessage(uploadRes.error || 'Failed to save memory.');
          setLoading(false);
          return;
        }

        if (onSuccess) onSuccess(uploadRes.memory);
        onClose();
      }
    } catch (err) {
      console.error('Save memory exception:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: isDarkMode
                ? (noklaiTheme.colors.cardBackgroundDark || '#1E232E')
                : (noklaiTheme.colors.cardBackground || '#FFFFFF'),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="images" size={20} color="#5B409E" />
              </View>
              <Text
                style={[
                  styles.title,
                  { color: isDarkMode ? noklaiTheme.colors.textDark : noklaiTheme.colors.text },
                ]}
              >
                {isEdit ? 'Edit Memory Details' : 'Add Family Memory'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#C0392B" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.formContainer,
              { paddingBottom: Math.max(insets.bottom + 20, 32) },
            ]}
          >
            {/* Photo Picker */}
            {!isEdit && (
              <View style={styles.photoPickerContainer}>
                {photoUri ? (
                  <View style={styles.previewWrapper}>
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                    <TouchableOpacity style={styles.changePhotoBtn} onPress={handlePickImage}>
                      <Ionicons name="camera" size={16} color="#FFF" />
                      <Text style={styles.changePhotoText}>Change Photo</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.uploadPlaceholder} onPress={handlePickImage}>
                    <Ionicons name="cloud-upload-outline" size={38} color="#5B409E" />
                    <Text style={styles.uploadTitle}>Select Family Photo</Text>
                    <Text style={styles.uploadSub}>JPEG or PNG up to 5MB</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Person Name */}
            <Text style={styles.label}>Person's Name *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: isDarkMode ? '#FFF' : '#333',
                  borderColor: isDarkMode ? '#444' : '#DDD',
                },
              ]}
              placeholder="e.g. Raj, Maya, Grandson Neil"
              placeholderTextColor="#999"
              value={personName}
              onChangeText={setPersonName}
            />

            {/* Relation Picker Chips */}
            <Text style={styles.label}>Relation to Patient *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relationScroll}>
              <View style={styles.relationChipRow}>
                {RELATION_OPTIONS.map((item) => {
                  const isSelected = relation === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.relationChip, isSelected && styles.relationChipSelected]}
                      onPress={() => setRelation(item)}
                    >
                      <Text
                        style={[
                          styles.relationChipText,
                          isSelected && styles.relationChipTextSelected,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Optional Short Note */}
            <Text style={styles.label}>Helpful Memory / Note (Optional)</Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  color: isDarkMode ? '#FFF' : '#333',
                  borderColor: isDarkMode ? '#444' : '#DDD',
                },
              ]}
              placeholder="e.g. Lives in Guwahati, visits on Sundays, likes Assamese tea"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />

            {/* Save / Upload Button */}
            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {isEdit ? 'Save Changes' : 'Upload to Family Memories'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: '92%',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDE7F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDEDEC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#C0392B',
    fontSize: 13,
    flex: 1,
  },
  formContainer: {
    paddingBottom: 28,
  },
  photoPickerContainer: {
    marginVertical: 8,
    alignItems: 'center',
  },
  uploadPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#D1C4E9',
    borderStyle: 'dashed',
    backgroundColor: '#FAF8FC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#5B409E',
    marginTop: 8,
  },
  uploadSub: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  previewWrapper: {
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#EEE',
  },
  changePhotoBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changePhotoText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  relationScroll: {
    marginVertical: 4,
  },
  relationChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  relationChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#F9F9FB',
  },
  relationChipSelected: {
    borderColor: '#5B409E',
    backgroundColor: '#EDE7F6',
  },
  relationChipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  relationChipTextSelected: {
    color: '#5B409E',
    fontWeight: 'bold',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  saveBtn: {
    backgroundColor: '#5B409E',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 22,
    shadowColor: '#5B409E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

