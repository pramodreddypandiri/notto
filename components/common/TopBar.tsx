/**
 * TopBar - Common header component across tabs
 *
 * Features:
 * - Time-based greeting (Good morning/afternoon/evening)
 * - Profile icon on the right
 * - Dark mode support
 * - Consistent across all tabs
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AnimatedPressable from '../ui/AnimatedPressable';
import { colors, typography, spacing, layout, getThemedColors } from '../../theme';
import { supabase } from '../../config/supabase';

interface TopBarProps {
  themedColors: ReturnType<typeof getThemedColors>;
  userName?: string;
}

export function TopBar({ themedColors, userName: userNameProp }: TopBarProps) {
  const [userName, setUserName] = useState<string | null>(userNameProp || null);

  useEffect(() => {
    if (userNameProp) return;
    const fetchName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const fullName = user?.user_metadata?.full_name;
      if (fullName) {
        setUserName(fullName.split(' ')[0]);
      }
    };
    fetchName();
  }, [userNameProp]);
  // Get time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'Good morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Good afternoon';
    } else if (hour >= 17 && hour < 21) {
      return 'Good evening';
    } else {
      return 'Good night';
    }
  }, []);

  // Get greeting icon based on time
  const greetingIcon = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'sunny-outline';
    } else if (hour >= 12 && hour < 17) {
      return 'sunny';
    } else if (hour >= 17 && hour < 21) {
      return 'moon-outline';
    } else {
      return 'moon';
    }
  }, []);

  const handleSettingsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/profile');
  };

  return (
    <View style={[styles.container, { backgroundColor: themedColors.background.primary }]}>
      {/* Left side - Greeting */}
      <View style={styles.greetingContainer}>
        <Ionicons
          name={greetingIcon as any}
          size={24}
          color={colors.primary[500]}
          style={styles.greetingIcon}
        />
        <View>
          <Text style={[styles.greeting, { color: themedColors.text.primary }]}>
            {greeting}{userName ? `, ${userName}` : ''}
          </Text>
        </View>
      </View>

      {/* Right side - Settings icon */}
      <AnimatedPressable
        onPress={handleSettingsPress}
        style={[styles.settingsButton, { backgroundColor: themedColors.surface.secondary }]}
        hapticType="light"
        scaleIntensity="subtle"
      >
        <Ionicons name="settings-outline" size={22} color={themedColors.text.primary} />
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: layout.statusBarOffset + spacing[2],
    paddingBottom: spacing[3],
  },
  greetingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingIcon: {
    marginRight: spacing[2],
  },
  greeting: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TopBar;
