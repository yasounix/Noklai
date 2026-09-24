import { createClient } from '@supabase/supabase-js';

// Replace with your actual values
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to test connection
export async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('family_members')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error);
      return false;
    }
    if (__DEV__) {
      console.log('Supabase connected successfully!', data);
    }
    return true;
  } catch (err) {
    console.error('Connection failed:', err);
    return false;
  }
}