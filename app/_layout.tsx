import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { supabase } from '../config/supabase';
import { ThemeProvider } from '../context/ThemeContext';
import reminderService from '../services/reminderService';
import locationService from '../services/locationService';
import { rescheduleSmartNotifications, cancelAllSmartNotifications } from '../services/smartNotificationEngine';
import { scheduleOnboardingNotifications } from '../services/onboardingNotificationService';
import './globals.css';

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsAuthenticated(!!session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Clean up stale notifications and re-schedule active reminders on login
  const hasRescheduled = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !hasRescheduled.current) {
      hasRescheduled.current = true;
      reminderService.rescheduleAllReminders();
      rescheduleSmartNotifications();
      scheduleOnboardingNotifications();
    }
    if (!isAuthenticated) {
      hasRescheduled.current = false;
      cancelAllSmartNotifications();
    }
  }, [isAuthenticated]);

  // Handle notification taps — deep-link to the relevant tab
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (data?.targetTab && isAuthenticated) {
        // @ts-ignore
        router.push(data.targetTab);
      }
    });
    return () => subscription.remove();
  }, [isAuthenticated]);

  // Initialize location service and start geofencing/background monitoring on login
  const hasInitializedLocation = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !hasInitializedLocation.current) {
      hasInitializedLocation.current = true;
      // Initialize location service and start monitoring if enabled
      (async () => {
        try {
          await locationService.initialize();
          const settings = await locationService.getSettings();
          if (settings.enabled) {
            // Start geofencing for saved locations
            await locationService.updateGeofencing();
            // Start background location monitoring for auto store detection
            if (settings.autoDetectStores) {
              await locationService.startBackgroundLocationMonitoring();
            }
          }
          console.log('[App] Location service initialized');
        } catch (error) {
          console.error('[App] Failed to initialize location service:', error);
        }
      })();
    }
    if (!isAuthenticated) {
      hasInitializedLocation.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated === null) return; // Still loading

    const inAuthGroup = segments[0] === '(auth)';
    // auth/callback handles deep links (password reset, OAuth) — always accessible
    const isDeepLinkCallback = segments[0] === 'auth';
    // reset-password is reached after a password reset deep link while authenticated
    const isResetPassword = segments[1] === 'reset-password';

    if (!isAuthenticated && !inAuthGroup && !isDeepLinkCallback) {
      // Not authenticated, redirect to login
      // @ts-ignore
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup && !isResetPassword) {
      // Authenticated but in auth screens (except reset-password), redirect to tabs
      // @ts-ignore
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments]);

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.container}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth/callback" />
            <Stack.Screen
              name="onboarding"
              options={{
                headerShown: false,
                gestureEnabled: false,
                animation: 'fade',
              }}
            />
          </Stack>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});