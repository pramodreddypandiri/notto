import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../config/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleDeepLink = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (!url) {
          // @ts-ignore
          router.replace('/(auth)/login');
          return;
        }

        const parsed = Linking.parse(url);
        const params = parsed.queryParams || {};
        const token_hash = params.token_hash as string | undefined;
        const type = params.type as string | undefined;
        const access_token = params.access_token as string | undefined;
        const refresh_token = params.refresh_token as string | undefined;

        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any,
          });
          if (!error) {
            if (type === 'recovery') {
              // @ts-ignore
              router.replace('/(auth)/reset-password');
            } else {
              // @ts-ignore
              router.replace('/(tabs)');
            }
            return;
          }
          setErrorMessage(
            error.message.toLowerCase().includes('expired')
              ? 'This verification link has expired. Please request a new one.'
              : 'This verification link is invalid or has already been used.'
          );
          return;
        } else if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (!error) {
            // @ts-ignore
            router.replace('/(tabs)');
            return;
          }
        }
      } catch {
        // fall through to login
      }

      // @ts-ignore
      router.replace('/(auth)/login');
    };

    handleDeepLink();
  }, []);

  if (errorMessage) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Verification Failed</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity
          style={styles.button}
          // @ts-ignore
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.buttonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6366f1" />
      <Text style={styles.text}>Verifying your email...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
