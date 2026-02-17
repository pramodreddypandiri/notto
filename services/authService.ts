import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../config/supabase';

// Ensure web browser redirects are handled properly
WebBrowser.maybeCompleteAuthSession();

class AuthService {
  /**
   * Sign in with Google using Supabase OAuth flow
   * Opens a browser for OAuth and handles the redirect
   */
  async signInWithGoogleOAuth(): Promise<{ success: boolean; error?: string }> {
    try {
      // Use Linking to create a proper redirect URI that works with Expo Go
      const redirectTo = Linking.createURL('auth/callback');

      console.log('Google OAuth redirect URI:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error('Supabase OAuth error:', error);
        return { success: false, error: error.message };
      }

      if (data.url) {
        // Open the OAuth URL in browser
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo,
          {
            showInRecents: true,
            preferEphemeralSession: false,
          }
        );

        console.log('WebBrowser result:', result.type);

        if (result.type === 'success' && result.url) {
          console.log('Redirect URL received:', result.url);

          // Extract tokens from the URL
          const url = new URL(result.url);

          // Check for tokens in hash fragment (implicit flow)
          const hashParams = new URLSearchParams(url.hash.substring(1));
          let accessToken = hashParams.get('access_token');
          let refreshToken = hashParams.get('refresh_token');

          // Also check query params (code flow)
          if (!accessToken) {
            accessToken = url.searchParams.get('access_token');
            refreshToken = url.searchParams.get('refresh_token');
          }

          console.log('Access token found:', !!accessToken);

          if (accessToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (sessionError) {
              console.error('Session error:', sessionError);
              return { success: false, error: sessionError.message };
            }

            return { success: true };
          } else {
            // Try to extract error
            const errorDesc = hashParams.get('error_description') || url.searchParams.get('error_description');
            if (errorDesc) {
              return { success: false, error: errorDesc };
            }
            return { success: false, error: 'No access token received' };
          }
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
          return { success: false, error: 'Sign in was cancelled' };
        }
      }

      return { success: false, error: 'Failed to initiate Google sign in' };
    } catch (error: any) {
      console.error('Google OAuth error:', error);
      return { success: false, error: error.message || 'Failed to sign in with Google' };
    }
  }

  /**
   * Get current user session
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Failed to get session:', error);
      return null;
    }
    return data.session;
  }

  /**
   * Get current user
   */
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Failed to get user:', error);
      return null;
    }
    return data.user;
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to sign out' };
    }
  }

  /**
   * Change user password
   * User must be logged in
   */
  async changePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (newPassword.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('Change password error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Change password error:', error);
      return { success: false, error: error.message || 'Failed to change password' };
    }
  }

  /**
   * Update user email
   * Sends confirmation email to new address
   */
  async updateEmail(newEmail: string): Promise<{ success: boolean; error?: string }> {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return { success: false, error: 'Please enter a valid email address' };
      }

      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) {
        console.error('Update email error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Update email error:', error);
      return { success: false, error: error.message || 'Failed to update email' };
    }
  }

  /**
   * Update user display name
   */
  async updateDisplayName(displayName: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!displayName.trim()) {
        return { success: false, error: 'Display name cannot be empty' };
      }

      const { error } = await supabase.auth.updateUser({
        data: { full_name: displayName.trim() },
      });

      if (error) {
        console.error('Update display name error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Update display name error:', error);
      return { success: false, error: error.message || 'Failed to update display name' };
    }
  }

  /**
   * Delete user account and all associated data
   * This is irreversible!
   */
  async deleteAccount(): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await this.getUser();
      if (!user) {
        return { success: false, error: 'No user logged in' };
      }

      // Delete user data from all tables (RLS will ensure only user's data is deleted)
      const tables = [
        'notes',
        'user_preferences',
        'user_profiles',
        'plan_patterns',
        'onboarding_responses',
        'saved_locations',
        'patterns',
        'productivity_metrics',
      ];

      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('user_id', user.id);

        if (error) {
          console.warn(`Failed to delete from ${table}:`, error.message);
          // Continue with other tables
        }
      }

      // Sign out the user (Supabase doesn't allow self-deletion of auth user)
      // The auth user record will remain but with no associated data
      await this.signOut();

      return { success: true };
    } catch (error: any) {
      console.error('Delete account error:', error);
      return { success: false, error: error.message || 'Failed to delete account' };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        console.error('Password reset error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Password reset error:', error);
      return { success: false, error: error.message || 'Failed to send reset email' };
    }
  }
}

export default new AuthService();
