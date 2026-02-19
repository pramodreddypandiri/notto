import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useTheme } from '../../context/ThemeContext';
import { getThemedColors } from '../../theme';
import authService from '../../services/authService';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  const handleSendReset = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    const redirectTo = Linking.createURL('auth/callback');
    const result = await authService.sendPasswordResetEmail(email.trim(), redirectTo);
    setLoading(false);

    if (result.success) {
      setSent(true);
    } else {
      Alert.alert('Error', result.error || 'Failed to send reset email');
    }
  };

  if (sent) {
    return (
      <View style={[styles.container, { backgroundColor: themedColors.background.primary }]}>
        <View style={styles.sentContainer}>
          <Text style={styles.sentIcon}>✉️</Text>
          <Text style={[styles.title, { color: themedColors.text.primary }]}>Check your email</Text>
          <Text style={[styles.subtitle, { color: themedColors.text.tertiary }]}>
            We sent a password reset link to{'\n'}
            <Text style={{ fontWeight: '600', color: themedColors.text.primary }}>{email}</Text>
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Back to Sign In</Text>
          </TouchableOpacity>
          <Text style={[styles.spamNote, { color: themedColors.text.tertiary }]}>
            Please check your spam or junk folder if you don't see it in your inbox.
          </Text>
          <TouchableOpacity onPress={() => setSent(false)}>
            <Text style={[styles.link, { color: themedColors.text.tertiary }]}>
              Still not there? <Text style={styles.linkBold}>Resend</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: '#6366f1' }]}>← Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: themedColors.text.primary }]}>Forgot Password?</Text>
        <Text style={[styles.subtitle, { color: themedColors.text.tertiary }]}>
          Enter your email and we'll send you a link to reset your password.
        </Text>

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
          autoFocus
        />

        <TouchableOpacity style={styles.button} onPress={handleSendReset} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send Reset Link'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  backButton: {
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    lineHeight: 24,
  },
  input: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sentIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  spamNote: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  link: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 8,
  },
  linkBold: {
    color: '#6366f1',
    fontWeight: '600',
  },
});
