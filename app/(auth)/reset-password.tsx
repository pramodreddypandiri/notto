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
import { supabase } from '../../config/supabase';
import { useTheme } from '../../context/ThemeContext';
import { getThemedColors } from '../../theme';
import { validatePasswordStrength } from '../../services/authService';

export default function ResetPasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  const handleResetPassword = async () => {
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      Alert.alert('Error', validation.error);
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Your password has been reset successfully.', [
        {
          text: 'OK',
          // @ts-ignore
          onPress: () => router.replace('/(tabs)'),
        },
      ]);
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
        <Text style={[styles.title, { color: themedColors.text.primary }]}>Reset Password</Text>
        <Text style={[styles.subtitle, { color: themedColors.text.tertiary }]}>
          Enter your new password below.
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
          placeholder="New password"
          placeholderTextColor={themedColors.input.placeholder}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoFocus
        />

        <Text style={[styles.hint, { color: themedColors.text.tertiary }]}>
          Must be 8+ characters with a letter, number, and special character
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
          placeholder="Confirm new password"
          placeholderTextColor={themedColors.input.placeholder}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleResetPassword} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Set New Password'}</Text>
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  input: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  hint: {
    fontSize: 13,
    marginTop: -8,
    marginBottom: 16,
    lineHeight: 18,
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
});
