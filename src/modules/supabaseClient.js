import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabaseUrl = 'https://gkaouygxlspirlsjorrm.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrYW91eWd4bHNwaXJsc2pvcnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NDQ0MDMsImV4cCI6MjEwNDAyMDQwM30.I7KOrhrD-isEOsVUn4lvQ2oPnFPfNjm6dnPBvHIlYxI';

// Safe cross-platform storage adapter (supports React Native runtime & Node test environments)
const authStorage = {
  getItem: async (key) => {
    try {
      if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
        return await AsyncStorage.getItem(key);
      }
      if (AsyncStorage?.default && typeof AsyncStorage.default.getItem === 'function') {
        return await AsyncStorage.default.getItem(key);
      }
    } catch {
      // ignore
    }
    return null;
  },
  setItem: async (key, val) => {
    try {
      if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        await AsyncStorage.setItem(key, val);
      } else if (AsyncStorage?.default && typeof AsyncStorage.default.setItem === 'function') {
        await AsyncStorage.default.setItem(key, val);
      }
    } catch {
      // ignore
    }
  },
  removeItem: async (key) => {
    try {
      if (AsyncStorage && typeof AsyncStorage.removeItem === 'function') {
        await AsyncStorage.removeItem(key);
      } else if (AsyncStorage?.default && typeof AsyncStorage.default.removeItem === 'function') {
        await AsyncStorage.default.removeItem(key);
      }
    } catch {
      // ignore
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper function to test connection
export async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') {
      console.log('Supabase connection test note:', error.message);
    }
    return true;
  } catch (err) {
    console.error('Connection failed:', err);
    return false;
  }
}