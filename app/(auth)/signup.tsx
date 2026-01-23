import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { useTheme } from '../../context/ThemeContext';
import { getThemedColors } from '../../theme';
import authService from '../../services/authService';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleSignInAvailable, setAppleSignInAvailable] = useState(false);
  const router = useRouter();

  // Theme
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  // Check Apple Sign In availability on mount
  useEffect(() => {
    const checkAppleSignIn = async () => {
      const available = await authService.isAppleSignInAvailable();
      setAppleSignInAvailable(available);
    };
    checkAppleSignIn();
  }, []);

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      Alert.alert('Success', 'Account created! Please check your email to verify.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await authService.signInWithGoogleOAuth();
      if (result.success) {
        // @ts-ignore
        router.replace('/(tabs)');
      } else if (result.error && result.error !== 'Sign in was cancelled') {
        Alert.alert('Error', result.error);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign in with Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      const result = await authService.signInWithApple();
      if (result.success) {
        // @ts-ignore
        router.replace('/(tabs)');
      } else if (result.error && result.error !== 'Sign in was cancelled') {
        Alert.alert('Error', result.error);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign in with Apple');
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themedColors.background.primary }]}>
      <Text style={[styles.title, { color: themedColors.text.primary }]}>Create Account</Text>
      <Text style={[styles.subtitle, { color: themedColors.text.tertiary }]}>
        Sign up to get started
      </Text>

      {/* Apple Sign-In Button (iOS only) */}
      {appleSignInAvailable && (
        <TouchableOpacity
          style={[
            styles.socialButton,
            styles.appleButton,
          ]}
          onPress={handleAppleSignIn}
          disabled={appleLoading}
        >
          {appleLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="logo-apple" size={20} color="#fff" style={styles.appleIcon} />
              <Text style={[styles.socialButtonText, styles.appleButtonText]}>
                Continue with Apple
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Google Sign-In Button */}
      <TouchableOpacity
        style={[
          styles.socialButton,
          {
            backgroundColor: themedColors.surface.primary,
            borderColor: themedColors.input.border,
          },
        ]}
        onPress={handleGoogleSignIn}
        disabled={googleLoading}
      >
        {googleLoading ? (
          <ActivityIndicator size="small" color={themedColors.text.primary} />
        ) : (
          <>
            <View style={styles.googleIcon}>
              <Text style={styles.googleIconText}>G</Text>
            </View>
            <Text style={[styles.socialButtonText, { color: themedColors.text.primary }]}>
              Continue with Google
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.dividerContainer}>
        <View style={[styles.divider, { backgroundColor: themedColors.input.border }]} />
        <Text style={[styles.dividerText, { color: themedColors.text.tertiary }]}>or</Text>
        <View style={[styles.divider, { backgroundColor: themedColors.input.border }]} />
      </View>

      {/* Email/Password Fields */}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: themedColors.input.background,
            borderColor: themedColors.input.border,
            color: themedColors.text.primary,
          },
        ]}
        placeholder="Email"
        placeholderTextColor={themedColors.input.placeholder}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: themedColors.input.background,
            borderColor: themedColors.input.border,
            color: themedColors.text.primary,
          },
        ]}
        placeholder="Password"
        placeholderTextColor={themedColors.input.placeholder}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: themedColors.input.background,
            borderColor: themedColors.input.border,
            color: themedColors.text.primary,
          },
        ]}
        placeholder="Confirm Password"
        placeholderTextColor={themedColors.input.placeholder}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Creating account...' : 'Sign Up'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={[styles.link, { color: themedColors.text.tertiary }]}>
          Already have an account? <Text style={styles.linkBold}>Sign In</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  appleButton: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  appleIcon: {
    marginRight: 12,
  },
  appleButtonText: {
    color: '#fff',
  },
  googleIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  googleIconText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
  },
  input: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  linkBold: {
    color: '#6366f1',
    fontWeight: '600',
  },
});
