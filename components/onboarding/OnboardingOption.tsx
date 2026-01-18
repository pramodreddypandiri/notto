/**
 * OnboardingOption - Animated selectable option card
 *
 * Features:
 * - Spring-based selection animation
 * - Haptic feedback
 * - Beautiful gradient when selected
 * - Icon and description support
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolateColor,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows, animation } from '../../theme';

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
  const pressed = useSharedValue(0);
  const selectedAnim = useSharedValue(selected ? 1 : 0);

  React.useEffect(() => {
    selectedAnim.value = withSpring(selected ? 1 : 0, animation.spring.snappy);
  }, [selected]);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const gesture = Gesture.Tap()
    .onBegin(() => {
      'worklet';
      scale.value = withSpring(0.97, animation.spring.snappy);
      pressed.value = withTiming(1, { duration: animation.duration.fast });
    })
    .onFinalize((_, success) => {
      'worklet';
      scale.value = withSpring(1, animation.spring.snappy);
      pressed.value = withTiming(0, { duration: animation.duration.fast });
      if (success) {
        runOnJS(triggerHaptic)();
        runOnJS(onSelect)();
      }
    });

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
    borderWidth: selectedAnim.value > 0.5 ? 2 : 1.5,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: selectedAnim.value,
    transform: [
      { scale: selectedAnim.value },
      { rotate: `${(1 - selectedAnim.value) * -90}deg` },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.container, containerStyle]}>
        <View style={styles.content}>
          {/* Icon/Emoji */}
          {(emoji || icon) && (
            <View style={styles.iconContainer}>
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
    </GestureDetector>
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
