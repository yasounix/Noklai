import { supabase } from './supabaseClient';

// Clean initial empty arrays for reminders and family members
export const familyMembers = [];

export const reminders = [];

// Fetch family members from Supabase
export const getFamilyMembers = async (patientId) => {
  if (!patientId) return [];
  try {
    const { data, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('patient_id', patientId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching family members from Supabase:', error.message);
    return [];
  }
};

// Helper function to look up family member by name
export const getFamilyMemberByName = (name) => {
  return familyMembers.find((member) =>
    member.name.toLowerCase().includes(name.toLowerCase())
  );
};