import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../config/supabase';

export default function AuthCallback() {
  const router = useRouter();

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
            // @ts-ignore
            router.replace('/(tabs)');
            return;
          }
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
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
