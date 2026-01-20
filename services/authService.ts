import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
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
   * Check if Apple Sign-In is available on this device
   */
  async isAppleSignInAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }
    return await AppleAuthentication.isAvailableAsync();
  }

  /**
   * Sign in with Apple
   * Only available on iOS
   */
  async signInWithApple(): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if Apple Sign-In is available
      const isAvailable = await this.isAppleSignInAvailable();
      if (!isAvailable) {
        return { success: false, error: 'Apple Sign In is not available on this device' };
      }

      // Generate a random nonce for security
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      // Request Apple Sign-In
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (credential.identityToken) {
        // Sign in to Supabase with the Apple ID token
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          nonce: rawNonce,
        });

        if (error) {
          console.error('Supabase Apple sign-in error:', error);
          return { success: false, error: error.message };
        }

        // If this is a new user and we have their name, update the profile
        if (credential.fullName?.givenName && data.user) {
          const fullName = [credential.fullName.givenName, credential.fullName.familyName]
            .filter(Boolean)
            .join(' ');

          // Update user metadata with name
          await supabase.auth.updateUser({
            data: { full_name: fullName },
          });
        }

        return { success: true };
      } else {
        return { success: false, error: 'No identity token received from Apple' };
      }
    } catch (error: any) {
      // Handle specific Apple Sign-In errors
      if (error.code === 'ERR_REQUEST_CANCELED') {
        return { success: false, error: 'Sign in was cancelled' };
      }
      console.error('Apple sign-in error:', error);
      return { success: false, error: error.message || 'Failed to sign in with Apple' };
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
}

export default new AuthService();
