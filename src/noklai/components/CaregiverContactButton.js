import React, { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '../../context/LanguageContext';
import { useNoklai } from '../context/NoklaiContext';
import { callPhone, getCallNumber } from '../../utils/callService';
import { noklaiTheme } from '../theme/noklaiTheme';

export default function CaregiverContactButton({ doctor, onAddDoctor, onCallDoctor }) {
  const [visible, setVisible] = useState(false);
  const { role, patientPhone, caregiverPhone } = useNoklai();
  const { t } = useLanguage();
  const patientNumber = getCallNumber(role, patientPhone, caregiverPhone);

  const handleCallPatient = () => {
    setVisible(false);
    if (patientNumber) {
      callPhone(patientNumber);
    } else {
      Alert.alert(t('callUnavailable'), t('callNumberMissing'));
    }
  };

  const handleDoctorAction = () => {
    setVisible(false);
    if (doctor) {
      onCallDoctor?.();
    } else {
      onAddDoctor?.();
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={styles.button}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Open caregiver calls"
      >
        <Ionicons name="call-outline" size={17} color={noklaiTheme.colors.primary} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.menu}>
            <Text style={styles.title}>Calls</Text>
            <TouchableOpacity style={styles.menuItem} onPress={handleCallPatient} activeOpacity={0.75}>
              <Ionicons name="person-outline" size={20} color={noklaiTheme.colors.primary} />
              <Text style={styles.menuText}>Call Patient</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleDoctorAction} activeOpacity={0.75}>
              <Ionicons name={doctor ? 'call-outline' : 'person-add-outline'} size={20} color={noklaiTheme.colors.primary} />
              <Text style={styles.menuText}>{doctor ? 'Call Doctor' : 'Add Doctor'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noklaiTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  overlay: {
    flex: 1,
    alignItems: 'flex-end',
    paddingTop: 68,
    paddingRight: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
  },
  menu: {
    width: 210,
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  title: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  menuItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  menuText: {
    marginLeft: 12,
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '600',
  },
});