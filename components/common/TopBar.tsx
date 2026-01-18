/**
 * TopBar - Common header component across tabs
 *
 * Features:
 * - Time-based greeting (Good morning/afternoon/evening)
 * - Profile icon on the right
 * - Dark mode support
 * - Consistent across all tabs
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AnimatedPressable from '../ui/AnimatedPressable';
import { colors, typography, spacing, layout, getThemedColors } from '../../theme';

interface TopBarProps {
  themedColors: ReturnType<typeof getThemedColors>;
  userName?: string;
}

export function TopBar({ themedColors, userName }: TopBarProps) {
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

  const handleProfilePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/profile');
  };

  return (
    <View style={[styles.container, { backgroundColor: themedColors.background.primary }]}>
      {/* Left side - Greeting */}
      <View style={styles.greetingContainer}>
        <Ionicons
          name={greetingIcon as any}
          size={20}
          color={colors.primary[500]}
          style={styles.greetingIcon}
        />
        <View>
          <Text style={[styles.greeting, { color: themedColors.text.secondary }]}>
            {greeting}
          </Text>
          {userName && (
            <Text style={[styles.userName, { color: themedColors.text.primary }]}>
              {userName}
            </Text>
          )}
        </View>
      </View>

      {/* Right side - Profile icon */}
      <AnimatedPressable
        onPress={handleProfilePress}
        style={styles.profileButton}
        hapticType="light"
        scaleIntensity="subtle"
      >
        <LinearGradient
          colors={colors.gradients.primary as [string, string]}
          style={styles.profileGradient}
        >
          <Ionicons name="person" size={18} color={colors.neutral[0]} />
        </LinearGradient>
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
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  userName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing[1],
  },
  profileButton: {
    borderRadius: 20,
  },
  profileGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TopBar;
