/**
 * OnboardingTextInput - Text input component for onboarding
 *
 * Features:
 * - Character limit with counter
 * - Smooth animations
 * - Multiline support
 * - Haptic feedback on focus
 */

import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface OnboardingTextInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  maxLength?: number;
  multiline?: boolean;
  numberOfLines?: number;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function OnboardingTextInput({
  label,
  placeholder,
  value,
  onChange,
  maxLength,
  multiline = false,
  numberOfLines = 1,
  hint,
  icon,
}: OnboardingTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  const handleFocus = () => {
    setIsFocused(true);
    focusAnim.value = withTiming(1, { duration: 200 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusAnim.value = withTiming(0, { duration: 200 });
  };

  const containerStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusAnim.value,
      [0, 1],
      [value ? colors.primary[300] : colors.neutral[200], colors.primary[500]]
    ),
    backgroundColor: interpolateColor(
      focusAnim.value,
      [0, 1],
      [value ? colors.primary[50] : colors.neutral[0], colors.neutral[0]]
    ),
  }));

  const hasContent = value.length > 0;
  const isNearLimit = maxLength && value.length > maxLength * 0.8;
  const isAtLimit = maxLength && value.length >= maxLength;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}

      <Animated.View style={[styles.container, containerStyle]}>
        {icon && (
          <View style={[styles.iconContainer, (isFocused || hasContent) && styles.iconContainerActive]}>
            <Ionicons
              name={icon}
              size={22}
              color={isFocused || hasContent ? colors.primary[600] : colors.neutral[500]}
            />
          </View>
        )}

        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            !icon && styles.inputNoIcon,
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.neutral[400]}
          value={value}
          onChangeText={onChange}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={handleFocus}
          onBlur={handleBlur}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </Animated.View>

      {maxLength && (
        <View style={styles.footer}>
          <View style={styles.characterCountContainer}>
            <Text
              style={[
                styles.characterCount,
                isNearLimit && styles.characterCountWarning,
                isAtLimit && styles.characterCountLimit,
              ]}
            >
              {value.length}/{maxLength}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing[4],
  },
  label: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  hint: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    marginBottom: spacing[3],
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    backgroundColor: colors.neutral[0],
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  iconContainerActive: {
    backgroundColor: colors.primary[100],
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.neutral[900],
    paddingVertical: spacing[2],
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: spacing[2],
  },
  inputNoIcon: {
    paddingLeft: spacing[1],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing[2],
  },
  characterCountContainer: {
    paddingHorizontal: spacing[2],
  },
  characterCount: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
  },
  characterCountWarning: {
    color: colors.semantic.warning,
  },
  characterCountLimit: {
    color: colors.semantic.error,
  },
});

export default OnboardingTextInput;
