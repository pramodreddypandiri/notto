/**
 * Settings Screen - Premium settings interface
 *
 * Features:
 * - Animated section cards
 * - Premium input styling
 * - Toggle switches with haptic feedback
 * - Sound settings control
 * - Clean, modern design
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import Animated, {
  FadeInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Theme
import { colors, typography, spacing, borderRadius, shadows, layout, getThemedColors } from '../../theme';

// Components
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import PremiumButton from '../../components/ui/PremiumButton';
import WheelTimePicker from '../../components/ui/WheelTimePicker';

// Services
import { supabase } from '../../config/supabase';
import soundService from '../../services/soundService';
import { getUserProfile, UserProfile } from '../../services/profileService';
import preferencesService from '../../services/preferencesService';

// Context
import { useTheme } from '../../context/ThemeContext';

// Router
import { router } from 'expo-router';

// Notification tone options
const NOTIFICATION_TONES = [
  { id: 'default', label: 'Default', icon: 'notifications' },
  { id: 'gentle', label: 'Gentle', icon: 'water' },
  { id: 'chime', label: 'Chime', icon: 'musical-note' },
  { id: 'alert', label: 'Alert', icon: 'alert-circle' },
] as const;

export default function SettingsScreen() {
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Active hours preferences
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('22:00');
  const [notificationTone, setNotificationTone] = useState('default');
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Time picker modal state
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [editingTimeType, setEditingTimeType] = useState<'wake' | 'sleep'>('wake');

  // Theme
  const { isDark, themeMode, setThemeMode } = useTheme();
  const themedColors = getThemedColors(isDark);

  useEffect(() => {
    loadUserData();
    loadProfile();
    loadActiveHoursPreferences();
  }, []);

  const loadActiveHoursPreferences = async () => {
    try {
      const prefs = await preferencesService.getPreferences();
      if (prefs) {
        setWakeTime(prefs.wake_time || '07:00');
        setSleepTime(prefs.sleep_time || '22:00');
        setNotificationTone(prefs.notification_tone || 'default');
      }
    } catch (error) {
      console.error('Failed to load active hours preferences:', error);
    }
  };

  const openTimePicker = (type: 'wake' | 'sleep') => {
    setEditingTimeType(type);
    setTimePickerVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleTimeSelected = (time: string) => {
    if (editingTimeType === 'wake') {
      setWakeTime(time);
    } else {
      setSleepTime(time);
    }
  };

  // Format time for display (24h to 12h)
  const formatTimeDisplay = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  };

  const handleSaveActiveHours = async () => {
    setSavingPreferences(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await preferencesService.updatePreferences({
        wake_time: wakeTime,
        sleep_time: sleepTime,
        notification_tone: notificationTone,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await soundService.playSuccess();
      Alert.alert('Success', 'Preferences saved successfully');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      Alert.alert('Error', 'Failed to save preferences');
    } finally {
      setSavingPreferences(false);
    }
  };

  const loadProfile = async () => {
    try {
      const userProfile = await getUserProfile();
      setProfile(userProfile);
    } catch (error) {
      console.error('Failed to load profile:', error);
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

  const handleSaveLocation = async () => {
    if (!city.trim()) {
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

      const { error } = await supabase.from('user_preferences').upsert({
        user_id: user.id,
        location_city: city,
        location_lat: 0,
        location_lng: 0,
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await soundService.playSuccess();
      Alert.alert('Success', 'Location saved successfully');
    } catch (error) {
      console.error('Failed to save location:', error);
      Alert.alert('Error', 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <View style={[styles.container, { backgroundColor: themedColors.background.primary }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={colors.gradients.primary as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Animated.View entering={FadeInDown.duration(500)}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Customize your experience</Text>
        </Animated.View>
      </LinearGradient>

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
                      {user.email?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                  </LinearGradient>
                </View>
                <View style={styles.accountInfo}>
                  <Text style={[styles.accountEmail, { color: themedColors.text.primary }]}>{user.email}</Text>
                  <Text style={[styles.accountLabel, { color: themedColors.text.tertiary }]}>Signed in</Text>
                </View>
              </View>
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
            {profile?.onboarding_completed ? (
              <>
                <View style={styles.profileSummary}>
                  <View style={styles.profileSummaryRow}>
                    <Text style={[styles.profileLabel, { color: themedColors.text.primary }]}>Profile</Text>
                    <View style={styles.profileBadge}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.semantic.success} />
                      <Text style={styles.profileBadgeText}>Personalized</Text>
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
          entering={FadeInDown.delay(250).springify()}
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: themedColors.text.tertiary }]}>Location</Text>
          <View style={[styles.card, shadows.md, { backgroundColor: themedColors.surface.primary }]}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: themedColors.text.secondary }]}>Your City</Text>
              <View style={[styles.inputContainer, { backgroundColor: themedColors.input.background, borderColor: themedColors.input.border }]}>
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={themedColors.input.placeholder}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: themedColors.text.primary }]}
                  value={city}
                  onChangeText={setCity}
                  placeholder="Enter your city (e.g., San Francisco)"
                  placeholderTextColor={themedColors.input.placeholder}
                />
              </View>
            </View>

            <PremiumButton
              onPress={handleSaveLocation}
              loading={loading}
              fullWidth
              icon={
                !loading ? (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={colors.neutral[0]}
                  />
                ) : undefined
              }
            >
              Save Location
            </PremiumButton>

            <Text style={[styles.hint, { color: themedColors.text.tertiary }]}>
              We use your location to find nearby activities and places for your
              weekend plans.
            </Text>
          </View>
        </Animated.View>

        {/* Preferences Section */}
        <Animated.View
          entering={FadeInDown.delay(300).springify()}
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: themedColors.text.tertiary }]}>Preferences</Text>
          <View style={[styles.card, shadows.md, { backgroundColor: themedColors.surface.primary }]}>
            <SettingsRow
              icon="moon-outline"
              title="Dark Mode"
              description={themeMode === 'system' ? 'Following system setting' : isDark ? 'Dark theme active' : 'Light theme active'}
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

        {/* Active Hours Section */}
        <Animated.View
          entering={FadeInDown.delay(350).springify()}
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: themedColors.text.tertiary }]}>Active Hours</Text>
          <View style={[styles.card, shadows.md, { backgroundColor: themedColors.surface.primary }]}>
            <Text style={[styles.activeHoursDescription, { color: themedColors.text.secondary }]}>
              Set your typical wake and sleep times. We'll only send notifications during these hours.
            </Text>

            {/* Wake Time */}
            <AnimatedPressable
              onPress={() => openTimePicker('wake')}
              style={styles.timePickerRow}
              hapticType="light"
            >
              <View style={styles.timePickerLabel}>
                <View style={[styles.timeIconContainer, { backgroundColor: colors.accent.amber.light }]}>
                  <Ionicons name="sunny" size={18} color={colors.accent.amber.base} />
                </View>
                <Text style={[styles.timePickerTitle, { color: themedColors.text.primary }]}>Wake Time</Text>
              </View>
              <View style={styles.timePickerControls}>
                <View style={[styles.timeDisplay, { backgroundColor: themedColors.input.background, borderColor: themedColors.input.border }]}>
                  <Text style={[styles.timeText, { color: themedColors.text.primary }]}>
                    {formatTimeDisplay(wakeTime)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={themedColors.text.muted} />
              </View>
            </AnimatedPressable>

            <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />

            {/* Sleep Time */}
            <AnimatedPressable
              onPress={() => openTimePicker('sleep')}
              style={styles.timePickerRow}
              hapticType="light"
            >
              <View style={styles.timePickerLabel}>
                <View style={[styles.timeIconContainer, { backgroundColor: colors.accent.violet.light }]}>
                  <Ionicons name="moon" size={18} color={colors.accent.violet.base} />
                </View>
                <Text style={[styles.timePickerTitle, { color: themedColors.text.primary }]}>Sleep Time</Text>
              </View>
              <View style={styles.timePickerControls}>
                <View style={[styles.timeDisplay, { backgroundColor: themedColors.input.background, borderColor: themedColors.input.border }]}>
                  <Text style={[styles.timeText, { color: themedColors.text.primary }]}>
                    {formatTimeDisplay(sleepTime)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={themedColors.text.muted} />
              </View>
            </AnimatedPressable>

            <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />

            {/* Notification Tone */}
            <View style={styles.toneSection}>
              <Text style={[styles.toneSectionTitle, { color: themedColors.text.primary }]}>Notification Tone</Text>
              <View style={styles.toneOptions}>
                {NOTIFICATION_TONES.map((tone) => (
                  <AnimatedPressable
                    key={tone.id}
                    onPress={() => {
                      setNotificationTone(tone.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[
                      styles.toneOption,
                      {
                        backgroundColor: notificationTone === tone.id
                          ? colors.primary[50]
                          : themedColors.surface.secondary,
                        borderColor: notificationTone === tone.id
                          ? colors.primary[500]
                          : themedColors.surface.border,
                      },
                    ]}
                    hapticType="light"
                  >
                    <Ionicons
                      name={tone.icon as any}
                      size={20}
                      color={notificationTone === tone.id ? colors.primary[500] : themedColors.text.tertiary}
                    />
                    <Text
                      style={[
                        styles.toneLabel,
                        {
                          color: notificationTone === tone.id
                            ? colors.primary[600]
                            : themedColors.text.secondary,
                        },
                      ]}
                    >
                      {tone.label}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>

            <PremiumButton
              onPress={handleSaveActiveHours}
              loading={savingPreferences}
              fullWidth
              icon={
                !savingPreferences ? (
                  <Ionicons name="checkmark" size={18} color={colors.neutral[0]} />
                ) : undefined
              }
            >
              Save Preferences
            </PremiumButton>
          </View>
        </Animated.View>

        {/* About Section */}
        <Animated.View
          entering={FadeInDown.delay(400).springify()}
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
            entering={FadeInDown.delay(500).springify()}
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
        <View style={styles.bottomSpacer} />
      </ScrollView>

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
  themedColors?: ReturnType<typeof getThemedColors>;
}) {
  const textColor = themedColors?.text.primary || colors.neutral[900];
  const descColor = themedColors?.text.tertiary || colors.neutral[500];

  const content = (
    <View style={styles.settingsRow}>
      <View style={styles.settingsRowIcon}>
        <Ionicons name={icon as any} size={22} color={colors.primary[500]} />
      </View>
      <View style={styles.settingsRowContent}>
        <Text style={[styles.settingsRowTitle, { color: textColor }]}>{title}</Text>
        {description && (
          <Text style={[styles.settingsRowDescription, { color: descColor }]}>{description}</Text>
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
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingTop: layout.statusBarOffset + spacing[4],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: 'rgba(255,255,255,0.8)',
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
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
    marginLeft: spacing[1],
  },
  card: {
    backgroundColor: colors.neutral[0],
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
    color: colors.neutral[900],
    marginBottom: spacing[1],
  },
  accountLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
  },
  inputGroup: {
    marginBottom: spacing[4],
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[700],
    marginBottom: spacing[2],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: spacing[3],
  },
  inputIcon: {
    marginRight: spacing[2],
  },
  input: {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: typography.fontSize.base,
    color: colors.neutral[900],
  },
  hint: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
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
    color: colors.neutral[900],
  },
  settingsRowDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginVertical: spacing[3],
  },
  versionText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
  },
  madeWithRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  madeWithText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
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
    color: colors.neutral[900],
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
    color: colors.neutral[500],
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
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
  // Active Hours styles
  activeHoursDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
    marginBottom: spacing[4],
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  timePickerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  timeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  timePickerControls: {
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
  timeText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  toneSection: {
    marginBottom: spacing[4],
  },
  toneSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing[3],
  },
  toneOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  toneOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
  },
  toneLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
});
