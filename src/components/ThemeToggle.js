import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <TouchableOpacity
      onPress={toggleTheme}
      accessibilityRole="button"
      accessibilityLabel="Toggle light and dark mode"
      accessibilityHint="Switches the app between light and dark theme"
      style={[
        styles.toggleButton,
        { backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' },
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.7}
    >
      <Ionicons
        name={isDarkMode ? 'moon' : 'sunny'}
        size={22}
        color={isDarkMode ? '#fbbf24' : '#f59e0b'}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    marginRight: 16,
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});