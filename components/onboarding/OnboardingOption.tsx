/**
 * OnboardingOption - Animated selectable option card
 *
 * Features:
 * - Smooth selection animation
 * - Haptic feedback
 * - Beautiful highlight when selected
 * - Icon and description support
 */

import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';

// Smooth timing config
const SMOOTH_TIMING = {
  duration: 150,
  easing: Easing.out(Easing.cubic),
};

interface OnboardingOptionProps {
  label: string;
  description?: string;
  emoji?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onSelect: () => void;
  multiSelect?: boolean;
}

export function OnboardingOption({
  label,
  description,
  emoji,
  icon,
  selected,
  onSelect,
  multiSelect = false,
}: OnboardingOptionProps) {
  const scale = useSharedValue(1);
  const selectedAnim = useSharedValue(selected ? 1 : 0);

  React.useEffect(() => {
    selectedAnim.value = withTiming(selected ? 1 : 0, SMOOTH_TIMING);
  }, [selected]);

  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect();
  };

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(
      selectedAnim.value,
      [0, 1],
      [colors.neutral[0], colors.primary[50]]
    ),
    borderColor: interpolateColor(
      selectedAnim.value,
      [0, 1],
      [colors.neutral[200], colors.primary[400]]
    ),
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: selectedAnim.value,
    transform: [{ scale: selectedAnim.value }],
  }));

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
    >
      <Animated.View style={[styles.container, containerStyle]}>
        <View style={styles.content}>
          {/* Icon/Emoji */}
          {(emoji || icon) && (
            <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
              {emoji ? (
                <Text style={styles.emoji}>{emoji}</Text>
              ) : icon ? (
                <Ionicons
                  name={icon}
                  size={24}
                  color={selected ? colors.primary[600] : colors.neutral[500]}
                />
              ) : null}
            </View>
          )}

          {/* Text */}
          <View style={styles.textContainer}>
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {label}
            </Text>
            {description && (
              <Text style={styles.description}>{description}</Text>
            )}
          </View>
        </View>

        {/* Selection indicator */}
        <Animated.View style={[styles.checkContainer, checkStyle]}>
          {multiSelect ? (
            <View style={styles.checkbox}>
              <Ionicons name="checkmark" size={16} color={colors.neutral[0]} />
            </View>
          ) : (
            <View style={styles.radio}>
              <View style={styles.radioInner} />
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
    borderWidth: 1.5,
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  iconContainerSelected: {
    backgroundColor: colors.primary[100],
  },
  emoji: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[800],
  },
  labelSelected: {
    color: colors.primary[700],
  },
  description: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  checkContainer: {
    marginLeft: spacing[3],
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[0],
  },
});

export default OnboardingOption;
