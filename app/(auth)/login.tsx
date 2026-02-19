import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../config/supabase';
import { useTheme } from '../../context/ThemeContext';
import { getThemedColors } from '../../theme';
import authService from '../../services/authService';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();

  // Theme
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // @ts-ignore
      router.replace('/(tabs)');
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

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themedColors.background.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: themedColors.text.primary }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: themedColors.text.tertiary }]}>
          Sign in to your account
        </Text>

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

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.forgotButton}
          // @ts-ignore
          onPress={() => router.push('/(auth)/forgot-password')}
        >
          <Text style={[styles.forgotText, { color: themedColors.text.tertiary }]}>
            Forgot password? <Text style={styles.linkBold}>Reset it</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          // @ts-ignore
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={[styles.link, { color: themedColors.text.tertiary }]}>
            Don't have an account? <Text style={styles.linkBold}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
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
  forgotButton: {
    alignItems: 'center',
    marginBottom: 12,
  },
  forgotText: {
    fontSize: 14,
    textAlign: 'center',
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
