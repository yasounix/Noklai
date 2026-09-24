import { supabase } from '../modules/supabaseClient';

/**
 * AuthService
 * Handles client-side authentication interactions, including server-side auto-confirmation
 * for environments where email confirmation is enforced by Supabase dashboard settings.
 */
export const AuthService = {
  /**
   * Invokes the backend Edge Function `auto-confirm-user` to confirm the user's email
   * server-side using the privileged Supabase Service Role Key.
   *
   * @param {string} userId - The newly created user's UUID.
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async autoConfirmUser(userId) {
    if (!userId) {
      return { success: false, error: 'User ID is required' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('auto-confirm-user', {
        body: { userId },
      });

      if (error) {
        console.warn('[AuthService] auto-confirm-user Edge Function error:', error.message);
        return { success: false, error: error.message };
      }

      if (data?.success) {
        return { success: true };
      }

      return { success: false, error: data?.error || 'Unknown response from confirmation service' };
    } catch (err) {
      console.warn('[AuthService] Failed to invoke auto-confirm-user:', err);
      return { success: false, error: err.message || 'Network error invoking confirmation function' };
    }
  },

  /**
   * Signs in a user with email and password, establishing an active session.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ data: any, error: any }>}
   */
  async signInWithPassword(email, password) {
    return await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
  },
};

export default AuthService;

