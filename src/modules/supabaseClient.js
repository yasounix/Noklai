import { createClient } from '@supabase/supabase-js';

// Replace with your actual values
const supabaseUrl = 'https://gkaouygxlspirlsjorrm.supabase.co';  // Your project URL
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrYW91eWd4bHNwaXJsc2pvcnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NDQ0MDMsImV4cCI6MjEwNDAyMDQwM30.I7KOrhrD-isEOsVUn4lvQ2oPnFPfNjm6dnPBvHIlYxI';  // Copy the FULL anon key

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
    console.log('Supabase connected successfully!', data);
    return true;
  } catch (err) {
    console.error('Connection failed:', err);
    return false;
  }
}