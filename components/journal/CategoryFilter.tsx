/**
 * CategoryFilter - Filter chips for photo categories
 *
 * Features:
 * - All / Food / Selfie / Other filter options
 * - Animated selection state
 * - Haptic feedback
 */

import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import AnimatedPressable from '../ui/AnimatedPressable';
import { colors, typography, spacing, borderRadius, getThemedColors } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { PhotoCategory } from '../../services/journalService';

export type FilterOption = 'all' | PhotoCategory;

interface FilterConfig {
  label: string;
  icon?: string;
}

const FILTER_OPTIONS: Record<FilterOption, FilterConfig> = {
  all: { label: 'All' },
  food: { label: 'Food' },
  selfie: { label: 'Selfie' },
  other: { label: 'Other' },
};

interface CategoryFilterProps {
  selected: FilterOption;
  onSelect: (filter: FilterOption) => void;
  counts?: Record<FilterOption, number>;
}

export function CategoryFilter({ selected, onSelect, counts }: CategoryFilterProps) {
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  const handleSelect = (filter: FilterOption) => {
    if (filter !== selected) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(filter);
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {(Object.keys(FILTER_OPTIONS) as FilterOption[]).map((filter) => {
        const isSelected = selected === filter;
        const config = FILTER_OPTIONS[filter];
        const count = counts?.[filter];

        return (
          <AnimatedPressable
            key={filter}
            onPress={() => handleSelect(filter)}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected
                  ? colors.primary[500]
                  : themedColors.surface.secondary,
                borderColor: isSelected
                  ? colors.primary[500]
                  : themedColors.surface.border,
              },
            ]}
            hapticType="light"
            scaleIntensity="subtle"
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: isSelected
                    ? colors.neutral[0]
                    : themedColors.text.secondary,
                },
              ]}
            >
              {config.label}
            </Text>
            {count !== undefined && count > 0 && (
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: isSelected
                      ? 'rgba(255,255,255,0.2)'
                      : themedColors.surface.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    {
                      color: isSelected
                        ? colors.neutral[0]
                        : themedColors.text.tertiary,
                    },
                  ]}
                >
                  {count}
                </Text>
              </View>
            )}
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: spacing[2],
  },
  chipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  countBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    minWidth: 20,
    alignItems: 'center',
  },
  countText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default CategoryFilter;
