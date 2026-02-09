/**
 * EmptyJournalState - Empty state for photo journal
 *
 * Features:
 * - Friendly illustration
 * - Onboarding prompt
 * - Add photo CTA
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import AnimatedPressable from '../ui/AnimatedPressable';
import { colors, typography, spacing, borderRadius, getThemedColors } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

interface EmptyJournalStateProps {
  onAddPhoto: () => void;
}

export function EmptyJournalState({ onAddPhoto }: EmptyJournalStateProps) {
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  return (
    <Animated.View
      entering={FadeIn.delay(200)}
      style={[styles.container, { backgroundColor: themedColors.background.primary }]}
    >
      {/* Illustration */}
      <View style={[styles.iconContainer, { backgroundColor: colors.primary[50] }]}>
        <Ionicons name="images-outline" size={64} color={colors.primary[400]} />
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: themedColors.text.primary }]}>
        Start Your Photo Journal
      </Text>

      {/* Description */}
      <Text style={[styles.description, { color: themedColors.text.tertiary }]}>
        Share photos of your meals, selfies, and things that make you happy.{'\n\n'}
        We'll help you understand your patterns and suggest ways to improve your well-being.
      </Text>

      {/* Categories hint */}
      <View style={styles.categoriesHint}>
        <View style={styles.categoryHint}>
          <View style={[styles.categoryIcon, { backgroundColor: colors.accent.amber.light }]}>
            <Ionicons name="restaurant-outline" size={20} color={colors.accent.amber.base} />
          </View>
          <Text style={[styles.categoryText, { color: themedColors.text.secondary }]}>
            Food
          </Text>
        </View>

        <View style={styles.categoryHint}>
          <View style={[styles.categoryIcon, { backgroundColor: colors.accent.rose.light }]}>
            <Ionicons name="person-circle-outline" size={20} color={colors.accent.rose.base} />
          </View>
          <Text style={[styles.categoryText, { color: themedColors.text.secondary }]}>
            Selfies
          </Text>
        </View>

        <View style={styles.categoryHint}>
          <View style={[styles.categoryIcon, { backgroundColor: colors.accent.violet.light }]}>
            <Ionicons name="heart-outline" size={20} color={colors.accent.violet.base} />
          </View>
          <Text style={[styles.categoryText, { color: themedColors.text.secondary }]}>
            Places & Things
          </Text>
        </View>
      </View>

      {/* CTA Button */}
      <AnimatedPressable
        onPress={onAddPhoto}
        style={[styles.addButton, { backgroundColor: colors.primary[500] }]}
        hapticType="medium"
      >
        <Ionicons name="add" size={24} color={colors.neutral[0]} />
        <Text style={styles.addButtonText}>Add Your First Photo</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  description: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
    marginBottom: spacing[6],
  },
  categoriesHint: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[6],
    marginBottom: spacing[8],
  },
  categoryHint: {
    alignItems: 'center',
    gap: spacing[2],
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: borderRadius.lg,
    gap: spacing[2],
  },
  addButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default EmptyJournalState;
