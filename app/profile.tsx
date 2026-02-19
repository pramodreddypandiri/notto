/**
 * Profile/ Settings Screen - Combined settings and profile management
 *
 * Features:
 * - User account info
 * - Personalization settings
 * - App settings (notifications, theme, sound)
 * - Location settings
 * - About section
 * - Sign out
 */

import React, { useState, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Theme
import { colors, typography, spacing, borderRadius, shadows, getThemedColors } from '../theme';

// Components
import AnimatedPressable from '../components/ui/AnimatedPressable';
import PremiumButton from '../components/ui/PremiumButton';
import WheelTimePicker from '../components/ui/WheelTimePicker';

// Services
import { supabase } from '../config/supabase';
import soundService from '../services/soundService';
import { getUserProfile, UserProfile } from '../services/profileService';
import authService, { validatePasswordStrength } from '../services/authService';
import preferencesService, { UserPreferences, NotificationTone } from '../services/preferencesService';
import { autocompleteAddress, getPlaceDetailsById, AddressSuggestion } from '../services/googlePlacesService';

// Context
import { useTheme } from '../context/ThemeContext';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  // Account management state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);

  // Location modal state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if user signed in with email/password (not OAuth)
  const isEmailUser = user?.app_metadata?.provider === 'email' ||
    user?.identities?.some((identity: any) => identity.provider === 'email');

  // Preferences state
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('22:00');
  const [notificationTone, setNotificationTone] = useState<NotificationTone>('friendly');

  // Time picker modal state
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [editingTimeType, setEditingTimeType] = useState<'wake' | 'sleep'>('wake');

  // Theme
  const { isDark, themeMode, setThemeMode } = useTheme();
  const themedColors = getThemedColors(isDark);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
      loadProfile();
      loadPreferences();
    }, [])
  );

  const loadProfile = async () => {
    try {
      const userProfile = await getUserProfile();
      setProfile(userProfile);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const prefs = await preferencesService.getPreferences();
      if (prefs) {
        setPreferences(prefs);
        setWakeTime(prefs.wake_time);
        setSleepTime(prefs.sleep_time);
        setNotificationTone(prefs.notification_tone);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }

    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      Alert.alert('Error', validation.error);
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setAccountLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await authService.changePassword(oldPassword, newPassword);

    setAccountLoading(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Password changed successfully. A confirmation email has been sent to your inbox.');
      setShowPasswordModal(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      Alert.alert('Error', result.error || 'Failed to change password');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            const result = await authService.deleteAccount();
            if (result.success) {
              Alert.alert('Account Deleted', 'Your account and all data have been deleted.');
            } else {
              Alert.alert('Error', result.error || 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  const openTimePicker = (type: 'wake' | 'sleep') => {
    setEditingTimeType(type);
    setTimePickerVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleTimeSelected = async (time: string) => {
    if (editingTimeType === 'wake') {
      await handleUpdatePreference('wake_time', time);
    } else {
      await handleUpdatePreference('sleep_time', time);
    }
  };

  // Format time for display (24h to 12h)
  const formatTimeDisplay = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  };

  const handleUpdatePreference = async (key: string, value: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const updates = { [key]: value };
    const result = await preferencesService.updatePreferences(updates);

    if (result) {
      setPreferences(result);
      if (key === 'wake_time') setWakeTime(value);
      if (key === 'sleep_time') setSleepTime(value);
      if (key === 'notification_tone') setNotificationTone(value);
    }
  };

  const loadUserData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (prefs?.location_city) {
          setCity(prefs.location_city);
        }
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const handleSaveLocation = async (locationCity: string) => {
    if (!locationCity.trim()) {
      Alert.alert('Error', 'Please enter your city');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in');
        return;
      }

      const { error } = await supabase.from('user_preferences').upsert(
        {
          user_id: user.id,
          location_city: locationCity,
          location_lat: 0,
          location_lng: 0,
        },
        { onConflict: 'user_id' }
      );

      if (error) throw error;

      setCity(locationCity);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await soundService.playSuccess();
      setShowLocationModal(false);
      setLocationSearch('');
    } catch (error) {
      console.error('Failed to save location:', error);
      Alert.alert('Error', 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  const handleGetCurrentLocation = async () => {
    setLocationLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location permissions in your device settings.');
        setLocationLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address) {
        const cityName = address.city || address.subregion || address.region || '';
        const fullAddress = [cityName, address.region, address.country]
          .filter(Boolean)
          .join(', ');

        setLocationSearch(fullAddress);
        setSuggestions([]);
        await handleSaveLocation(fullAddress);
      }
    } catch (error) {
      console.error('Failed to get current location:', error);
      Alert.alert('Error', 'Failed to get your current location. Please try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  // Debounced address search
  const handleAddressChange = useCallback(
    (text: string) => {
      console.log('[Profile] handleAddressChange called with:', text);
      setLocationSearch(text);

      // Clear existing timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Don't search if less than 3 characters
      if (text.trim().length < 3) {
        setSuggestions([]);
        setSuggestionsLoading(false);
        return;
      }

      setSuggestionsLoading(true);

      // Debounce the search by 300ms
      debounceRef.current = setTimeout(async () => {
        try {
          console.log('[Profile] Calling autocompleteAddress for:', text);
          const results = await autocompleteAddress(text);
          console.log('[Profile] Got suggestions:', results.length, results);
          setSuggestions(results);
        } catch (error) {
          console.error('[Profile] Failed to get address suggestions:', error);
          setSuggestions([]);
        } finally {
          setSuggestionsLoading(false);
        }
      }, 300);
    },
    []
  );

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback(async (suggestion: AddressSuggestion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocationSearch(suggestion.fullText);
    setSuggestions([]);

    // Get full place details and save
    const details = await getPlaceDetailsById(suggestion.placeId);
    if (details) {
      await handleSaveLocation(details.address || suggestion.fullText);
    } else {
      await handleSaveLocation(suggestion.fullText);
    }
  }, []);


  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await supabase.auth.signOut();
            Alert.alert('Success', 'Signed out successfully');
          } catch (error) {
            console.error('Failed to sign out:', error);
            Alert.alert('Error', 'Failed to sign out');
          }
        },
      },
    ]);
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: themedColors.background.primary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <AnimatedPressable
          onPress={handleBack}
          style={[styles.backButton, { backgroundColor: themedColors.surface.secondary }]}
          hapticType="light"
        >
          <Ionicons name="chevron-back" size={24} color={themedColors.text.primary} />
        </AnimatedPressable>
        <Text style={[styles.headerTitle, { color: themedColors.text.primary }]}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        {user && (
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            style={styles.section}
          >
            <Text style={[styles.sectionTitle, { color: themedColors.text.tertiary }]}>Account</Text>
            <View style={[styles.card, shadows.md, { backgroundColor: themedColors.surface.primary }]}>
              <View style={styles.accountRow}>
                <View style={styles.avatarContainer}>
                  <LinearGradient
                    colors={colors.gradients.primary as [string, string]}
                    style={styles.avatar}
                  >
                    <Text style={styles.avatarText}>
                      {user.user_metadata?.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                  </LinearGradient>
                </View>
                <View style={styles.accountInfo}>
                  <Text style={[styles.accountEmail, { color: themedColors.text.primary }]}>
                    {user.user_metadata?.full_name || user.email}
                  </Text>
                  <Text style={[styles.accountLabel, { color: themedColors.text.tertiary }]}>{user.email}</Text>
                </View>
              </View>

              {/* Only show password change for email/password users, not OAuth */}
              {isEmailUser && (
                <>
                  <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />

                  <SettingsRow
                    icon="lock-closed-outline"
                    title="Change Password"
                    description="Update your password"
                    themedColors={themedColors}
                    trailing={
                      <Ionicons name="chevron-forward" size={20} color={themedColors.text.muted} />
                    }
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowPasswordModal(true);
                    }}
                  />
                </>
              )}

              <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />

              <SettingsRow
                icon="trash-outline"
                title="Delete Account"
                description="Permanently delete your account"
                themedColors={themedColors}
                trailing={
                  <Ionicons name="chevron-forward" size={20} color={colors.semantic.error} />
                }
                onPress={handleDeleteAccount}
              />
            </View>
          </Animated.View>
        )}

        {/* Personalization Section */}
        <Animated.View
          entering={FadeInDown.delay(150).springify()}
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: themedColors.text.tertiary }]}>Personalization</Text>
          <View style={[styles.card, shadows.md, { backgroundColor: themedColors.surface.primary }]}>
            {profileLoading ? (
              <View style={styles.profileSummary}>
                <View style={[styles.skeletonLine, { width: '60%', backgroundColor: themedColors.surface.secondary }]} />
                <View style={[styles.skeletonLine, { width: '90%', marginTop: spacing[2], backgroundColor: themedColors.surface.secondary }]} />
              </View>
            ) : profile?.onboarding_completed ? (
              <>
                <View style={styles.profileSummary}>
                  <View style={styles.profileSummaryRow}>
                    <Text style={[styles.profileLabel, { color: themedColors.text.primary }]}>About You</Text>
                    <View style={styles.profileBadge}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.semantic.success} />
                      <Text style={styles.profileBadgeText}>Complete</Text>
                    </View>
                  </View>
                  <Text style={[styles.profileHint, { color: themedColors.text.tertiary }]}>
                    Your preferences help us create better plans for you.
                  </Text>
                </View>
                <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />
                <SettingsRow
                  icon="refresh-outline"
                  title="Retake Quiz"
                  description="Update your preferences"
                  themedColors={themedColors}
                  trailing={
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={themedColors.text.muted}
                    />
                  }
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/onboarding', params: { retake: 'true' } } as any);
                  }}
                />
              </>
            ) : (
              <>
                <View style={styles.profileSummary}>
                  <Text style={[styles.profileLabel, { color: themedColors.text.primary }]}>Get Personalized Plans</Text>
                  <Text style={[styles.profileHint, { color: themedColors.text.tertiary }]}>
                    Take a quick quiz so we can tailor recommendations to your personality and preferences.
                  </Text>
                </View>
                <PremiumButton
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/onboarding' as any);
                  }}
                  gradient
                  fullWidth
                  icon={
                    <Ionicons
                      name="sparkles"
                      size={18}
                      color={colors.neutral[0]}
                    />
                  }
                >
                  Take the Quiz
                </PremiumButton>
              </>
            )}
          </View>
        </Animated.View>

        {/* Location Section */}
        <Animated.View
          entering={FadeInDown.delay(200).springify()}
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: themedColors.text.tertiary }]}>Location</Text>
          <View style={[styles.card, shadows.md, { backgroundColor: themedColors.surface.primary }]}>
            <SettingsRow
              icon="location-outline"
              title="Your Location"
              description={city || 'Not set'}
              themedColors={themedColors}
              trailing={
                <AnimatedPressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setLocationSearch(city);
                    setShowLocationModal(true);
                  }}
                  style={[styles.editButton, { backgroundColor: themedColors.surface.secondary }]}
                  hapticType="light"
                >
                  <Text style={[styles.editButtonText, { color: colors.primary[500] }]}>Edit</Text>
                </AnimatedPressable>
              }
            />

            <Text style={[styles.hint, { color: themedColors.text.tertiary, marginTop: spacing[3] }]}>
              We use your location to find nearby activities and places for your
              weekend plans.
            </Text>
          </View>
        </Animated.View>

        {/* User Preferences Section */}
        <Animated.View
          entering={FadeInDown.delay(250).springify()}
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: themedColors.text.tertiary }]}>Preferences</Text>
          <View style={[styles.card, shadows.md, { backgroundColor: themedColors.surface.primary }]}>
            <AnimatedPressable
              onPress={() => openTimePicker('wake')}
              hapticType="light"
            >
              <SettingsRow
                icon="sunny-outline"
                title="Wake Time"
                description="When your day starts"
                themedColors={themedColors}
                trailing={
                  <View style={styles.timePickerTrailing}>
                    <View style={[styles.timeDisplay, { backgroundColor: themedColors.surface.secondary, borderColor: themedColors.surface.border }]}>
                      <Text style={[styles.timeDisplayText, { color: themedColors.text.primary }]}>
                        {formatTimeDisplay(wakeTime)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={themedColors.text.muted} />
                  </View>
                }
              />
            </AnimatedPressable>

            <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />

            <AnimatedPressable
              onPress={() => openTimePicker('sleep')}
              hapticType="light"
            >
              <SettingsRow
                icon="moon-outline"
                title="Sleep Time"
                description="When your day ends"
                themedColors={themedColors}
                trailing={
                  <View style={styles.timePickerTrailing}>
                    <View style={[styles.timeDisplay, { backgroundColor: themedColors.surface.secondary, borderColor: themedColors.surface.border }]}>
                      <Text style={[styles.timeDisplayText, { color: themedColors.text.primary }]}>
                        {formatTimeDisplay(sleepTime)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={themedColors.text.muted} />
                  </View>
                }
              />
            </AnimatedPressable>

            <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />

            <View style={styles.toneSection}>
              <View style={styles.toneLabelRow}>
                <View style={styles.settingsRowIcon}>
                  <Ionicons name="chatbubble-outline" size={22} color={colors.primary[500]} />
                </View>
                <View style={styles.settingsRowContent}>
                  <Text style={[styles.settingsRowTitle, { color: themedColors.text.primary }]}>Notification Tone</Text>
                  <Text style={[styles.settingsRowDescription, { color: themedColors.text.tertiary }]}>
                    How reminders sound
                  </Text>
                </View>
              </View>
              <View style={styles.toneOptions}>
                {([
                  { value: 'friendly', label: 'Friendly', icon: 'happy-outline' },
                  { value: 'neutral', label: 'Neutral', icon: 'remove-outline' },
                  { value: 'motivational', label: 'Motivational', icon: 'flame-outline' },
                ] as const).map((tone) => (
                  <AnimatedPressable
                    key={tone.value}
                    onPress={() => handleUpdatePreference('notification_tone', tone.value)}
                    style={[
                      styles.toneOption,
                      notificationTone === tone.value && styles.toneOptionActive,
                      {
                        borderColor: notificationTone === tone.value ? colors.primary[500] : themedColors.surface.border,
                        backgroundColor: notificationTone === tone.value ? colors.primary[50] : 'transparent',
                      },
                    ]}
                    hapticType="light"
                  >
                    <Ionicons
                      name={tone.icon as any}
                      size={20}
                      color={notificationTone === tone.value ? colors.primary[500] : themedColors.text.tertiary}
                    />
                    <Text
                      style={[
                        styles.toneOptionText,
                        { color: notificationTone === tone.value ? colors.primary[500] : themedColors.text.secondary },
                      ]}
                    >
                      {tone.label}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* App Settings Section */}
        <Animated.View
          entering={FadeInDown.delay(300).springify()}
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: themedColors.text.tertiary }]}>App Settings</Text>
          <View style={[styles.card, shadows.md, { backgroundColor: themedColors.surface.primary }]}>
            <SettingsRow
              icon="moon-outline"
              title="Theme"
              description={themeMode === 'system' ? 'Following system setting' : isDark ? 'Dark theme' : 'Light theme'}
              themedColors={themedColors}
              trailing={
                <View style={styles.themeSwitcher}>
                  {(['light', 'dark', 'system'] as const).map((mode) => (
                    <AnimatedPressable
                      key={mode}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setThemeMode(mode);
                      }}
                      style={[
                        styles.themeOption,
                        themeMode === mode && styles.themeOptionActive,
                        { borderColor: themeMode === mode ? colors.primary[500] : themedColors.surface.border },
                      ]}
                      hapticType="light"
                    >
                      <Ionicons
                        name={mode === 'light' ? 'sunny' : mode === 'dark' ? 'moon' : 'phone-portrait-outline'}
                        size={16}
                        color={themeMode === mode ? colors.primary[500] : themedColors.text.tertiary}
                      />
                    </AnimatedPressable>
                  ))}
                </View>
              }
            />

            <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />

            <SettingsRow
              icon="location-outline"
              title="Location Reminders"
              description="Get notified at the right place"
              themedColors={themedColors}
              trailing={
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={themedColors.text.muted}
                />
              }
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/locations' as any);
              }}
            />
          </View>
        </Animated.View>

        {/* About Section */}
        <Animated.View
          entering={FadeInDown.delay(300).springify()}
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: themedColors.text.tertiary }]}>About</Text>
          <View style={[styles.card, shadows.md, { backgroundColor: themedColors.surface.primary }]}>
            <SettingsRow
              icon="information-circle-outline"
              title="App Version"
              themedColors={themedColors}
              trailing={<Text style={[styles.versionText, { color: themedColors.text.tertiary }]}>1.0.0</Text>}
            />

            <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />

            <SettingsRow
              icon="construct-outline"
              title="Build"
              themedColors={themedColors}
              trailing={<Text style={[styles.versionText, { color: themedColors.text.tertiary }]}>Development</Text>}
            />

            <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />

            <SettingsRow
              icon="heart-outline"
              title="Made with"
              themedColors={themedColors}
              trailing={
                <View style={styles.madeWithRow}>
                  <Text style={[styles.madeWithText, { color: themedColors.text.tertiary }]}>React Native + Expo</Text>
                </View>
              }
            />
          </View>
        </Animated.View>

        {/* Sign Out */}
        {user && (
          <Animated.View
            entering={FadeInDown.delay(350).springify()}
            style={styles.section}
          >
            <PremiumButton
              onPress={handleSignOut}
              variant="danger"
              fullWidth
              icon={
                <Ionicons
                  name="log-out-outline"
                  size={18}
                  color={colors.neutral[0]}
                />
              }
            >
              Sign Out
            </PremiumButton>
          </Animated.View>
        )}

        {/* Bottom spacing */}
        <View style={[styles.bottomSpacer, { paddingBottom: insets.bottom }]} />
      </ScrollView>

      {/* Change Password Modal - Bottom Sheet */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={() => setShowPasswordModal(false)}>
            <View style={styles.bottomSheetOverlay}>
              <TouchableWithoutFeedback>
                <View style={[styles.bottomSheetContent, { backgroundColor: themedColors.surface.primary }]}>
                  {/* Handle bar */}
                  <View style={styles.bottomSheetHandle}>
                    <View style={[styles.bottomSheetHandleBar, { backgroundColor: themedColors.text.muted + '40' }]} />
                  </View>

                  <Text style={[styles.modalTitle, { color: themedColors.text.primary }]}>
                    Change Password
                  </Text>

                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: themedColors.input.background,
                        borderColor: themedColors.input.border,
                        color: themedColors.text.primary,
                      },
                    ]}
                    placeholder="Current password"
                    placeholderTextColor={themedColors.input.placeholder}
                    secureTextEntry
                    value={oldPassword}
                    onChangeText={setOldPassword}
                    autoFocus={false}
                  />

                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: themedColors.input.background,
                        borderColor: themedColors.input.border,
                        color: themedColors.text.primary,
                      },
                    ]}
                    placeholder="New password"
                    placeholderTextColor={themedColors.input.placeholder}
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />

                  <Text style={[styles.passwordHint, { color: themedColors.text.tertiary }]}>
                    Must be 8+ characters with a letter, number, and special character
                  </Text>

                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: themedColors.input.background,
                        borderColor: themedColors.input.border,
                        color: themedColors.text.primary,
                      },
                    ]}
                    placeholder="Confirm new password"
                    placeholderTextColor={themedColors.input.placeholder}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />

                  <View style={styles.bottomSheetButtons}>
                    <PremiumButton
                      onPress={handleChangePassword}
                      loading={accountLoading}
                      fullWidth
                    >
                      Save Password
                    </PremiumButton>
                    <PremiumButton
                      onPress={() => {
                        setShowPasswordModal(false);
                        setOldPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      variant="secondary"
                      fullWidth
                    >
                      Cancel
                    </PremiumButton>
                  </View>

                  {/* Extra bottom padding for safe area */}
                  <View style={{ height: insets.bottom + spacing[2] }} />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Location Search Modal */}
      <Modal
        visible={showLocationModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowLocationModal(false);
          setSuggestions([]);
        }}
      >
        <TouchableWithoutFeedback onPress={() => {
          setShowLocationModal(false);
          setSuggestions([]);
        }}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.locationModalContainer}
              >
                <View style={[styles.locationModalContent, { backgroundColor: themedColors.surface.primary }]}>
                  <View style={styles.locationSearchRow}>
                    <View style={[styles.locationSearchInputContainer, { backgroundColor: themedColors.input.background }]}>
                      <TextInput
                        style={[styles.locationSearchInput, { color: themedColors.text.primary }]}
                        value={locationSearch}
                        onChangeText={handleAddressChange}
                        placeholder="Search for an address"
                        placeholderTextColor={themedColors.input.placeholder}
                        autoFocus
                        returnKeyType="search"
                      />
                    </View>
                    <AnimatedPressable
                      onPress={handleGetCurrentLocation}
                      style={styles.currentLocationButton}
                      hapticType="medium"
                      disabled={locationLoading}
                    >
                      {locationLoading ? (
                        <ActivityIndicator size="small" color={colors.neutral[0]} />
                      ) : (
                        <Ionicons name="locate" size={24} color={colors.neutral[0]} />
                      )}
                    </AnimatedPressable>
                  </View>

                  <Text style={[styles.locationHintText, { color: themedColors.text.tertiary }]}>
                    Type to search or tap the location button for current location
                  </Text>

                  {/* Suggestions List */}
                  {(suggestions.length > 0 || suggestionsLoading) && (
                    <View style={[styles.suggestionsContainer, { backgroundColor: themedColors.surface.secondary }]}>
                      {suggestionsLoading ? (
                        <View style={styles.suggestionsLoading}>
                          <ActivityIndicator size="small" color={colors.primary[500]} />
                        </View>
                      ) : (
                        suggestions.map((suggestion) => (
                          <AnimatedPressable
                            key={suggestion.placeId}
                            onPress={() => handleSelectSuggestion(suggestion)}
                            style={styles.suggestionItem}
                            hapticType="light"
                          >
                            <Ionicons
                              name="location-outline"
                              size={20}
                              color={themedColors.text.tertiary}
                              style={styles.suggestionIcon}
                            />
                            <View style={styles.suggestionTextContainer}>
                              <Text style={[styles.suggestionMainText, { color: themedColors.text.primary }]}>
                                {suggestion.mainText}
                              </Text>
                              <Text style={[styles.suggestionSecondaryText, { color: themedColors.text.tertiary }]}>
                                {suggestion.secondaryText}
                              </Text>
                            </View>
                          </AnimatedPressable>
                        ))
                      )}
                    </View>
                  )}

                  {/* Cancel button */}
                  <View style={styles.locationModalButtons}>
                    <PremiumButton
                      onPress={() => {
                        setShowLocationModal(false);
                        setLocationSearch('');
                        setSuggestions([]);
                      }}
                      variant="secondary"
                      fullWidth
                    >
                      Cancel
                    </PremiumButton>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Time Picker Modal */}
      <WheelTimePicker
        visible={timePickerVisible}
        onClose={() => setTimePickerVisible(false)}
        onConfirm={handleTimeSelected}
        initialTime={editingTimeType === 'wake' ? wakeTime : sleepTime}
        title={editingTimeType === 'wake' ? 'Wake Time' : 'Sleep Time'}
      />
    </View>
  );
}

// Settings Row Component
function SettingsRow({
  icon,
  title,
  description,
  trailing,
  onPress,
  themedColors,
}: {
  icon: string;
  title: string;
  description?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  themedColors: ReturnType<typeof getThemedColors>;
}) {
  const content = (
    <View style={styles.settingsRow}>
      <View style={styles.settingsRowIcon}>
        <Ionicons name={icon as any} size={22} color={colors.primary[500]} />
      </View>
      <View style={styles.settingsRowContent}>
        <Text style={[styles.settingsRowTitle, { color: themedColors.text.primary }]}>{title}</Text>
        {description && (
          <Text style={[styles.settingsRowDescription, { color: themedColors.text.tertiary }]}>{description}</Text>
        )}
      </View>
      {trailing}
    </View>
  );

  if (onPress) {
    return (
      <AnimatedPressable onPress={onPress} hapticType="light" scaleIntensity="subtle">
        {content}
      </AnimatedPressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[5],
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
    marginLeft: spacing[1],
  },
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing[4],
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: spacing[4],
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  accountInfo: {
    flex: 1,
  },
  accountEmail: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing[1],
  },
  accountLabel: {
    fontSize: typography.fontSize.sm,
  },
  inputGroup: {
    marginBottom: spacing[4],
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing[2],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
  },
  inputIcon: {
    marginRight: spacing[2],
  },
  input: {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: typography.fontSize.base,
  },
  hint: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing[3],
    lineHeight: typography.fontSize.xs * typography.lineHeight.relaxed,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  settingsRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  settingsRowContent: {
    flex: 1,
  },
  settingsRowTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  settingsRowDescription: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing[1],
  },
  divider: {
    height: 1,
    marginVertical: spacing[3],
  },
  versionText: {
    fontSize: typography.fontSize.sm,
  },
  madeWithRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  madeWithText: {
    fontSize: typography.fontSize.sm,
  },
  bottomSpacer: {
    height: spacing[10],
  },
  profileSummary: {
    marginBottom: spacing[3],
  },
  profileSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  profileLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.emerald.light,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    gap: spacing[1],
  },
  profileBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.accent.emerald.dark,
  },
  profileHint: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
  },
  skeletonLine: {
    height: 16,
    borderRadius: borderRadius.sm,
  },
  themeSwitcher: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  themeOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  themeOptionActive: {
    backgroundColor: colors.primary[50],
  },
  timePickerTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  timeDisplay: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minWidth: 90,
    alignItems: 'center',
  },
  timeDisplayText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  toneSection: {
    paddingVertical: spacing[2],
  },
  toneLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  toneOptions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginLeft: 52,
  },
  toneOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
  },
  toneOptionActive: {
    borderWidth: 1.5,
  },
  toneOptionText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing[4],
    textAlign: 'center',
  },
  modalInput: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: typography.fontSize.base,
    marginBottom: spacing[3],
  },
  passwordHint: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing[3],
    marginTop: -spacing[2],
    lineHeight: typography.fontSize.xs * typography.lineHeight.relaxed,
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  bottomSheetHandle: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  bottomSheetHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  bottomSheetButtons: {
    gap: spacing[3],
    marginTop: spacing[4],
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  modalButton: {
    flex: 1,
  },
  editButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
  },
  editButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  locationModalContainer: {
    width: '100%',
    paddingHorizontal: spacing[5],
  },
  locationModalContent: {
    width: '100%',
    borderRadius: borderRadius.xl,
    padding: spacing[5],
  },
  locationSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  locationSearchInputContainer: {
    flex: 1,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  locationSearchInput: {
    fontSize: typography.fontSize.lg,
  },
  currentLocationButton: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationHintText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing[3],
    marginBottom: spacing[4],
  },
  locationModalButtons: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  suggestionsContainer: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
    overflow: 'hidden',
  },
  suggestionsLoading: {
    padding: spacing[4],
    alignItems: 'center',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  suggestionIcon: {
    marginRight: spacing[3],
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionMainText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing[1],
  },
  suggestionSecondaryText: {
    fontSize: typography.fontSize.sm,
  },
});
