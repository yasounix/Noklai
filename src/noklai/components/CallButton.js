import React from 'react';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '../../context/LanguageContext';
import { useNoklai } from '../context/NoklaiContext';
import { noklaiTheme } from '../theme/noklaiTheme';
import { callPhone, getCallNumber } from '../../utils/callService';

export default function CallButton({ style, onLongPress }) {
  const { role, patientPhone, caregiverPhone } = useNoklai();
  const { t } = useLanguage();
  const isCaregiver = role === 'caregiver';
  const label = isCaregiver ? t('callPatient') : t('callCaregiver');
  const callNumber = getCallNumber(role, patientPhone, caregiverPhone);

  return (
    <TouchableOpacity
      onPress={() => {
        if (callNumber) {
          callPhone(callNumber);
        } else {
          Alert.alert(t('callUnavailable'), t('callNumberMissing'));
        }
      }}
      onLongPress={onLongPress}
      style={[styles.button, !callNumber && styles.disabled, style]}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: false }}
    >
      <Ionicons
        name="call-outline"
        size={17}
        color={callNumber ? noklaiTheme.colors.primary : noklaiTheme.colors.textSecondary}
      />
    </TouchableOpacity>
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
    marginLeft: 0,
  },
  disabled: {
    opacity: 0.5,
  },
});
