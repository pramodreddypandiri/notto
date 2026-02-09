/**
 * InsightsView - AI-generated insights from photo journal
 *
 * Features:
 * - Category tabs (Food / You / Other)
 * - AI understanding summary
 * - Actionable suggestions
 * - Pull to refresh
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AnimatedPressable from '../ui/AnimatedPressable';
import { colors, typography, spacing, borderRadius, shadows, getThemedColors } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { Insight, InsightCategory, generateInsights } from '../../services/journalInsightsService';

const CATEGORY_TABS: { key: InsightCategory; label: string; icon: string }[] = [
  { key: 'food', label: 'Food', icon: 'restaurant-outline' },
  { key: 'you', label: 'You', icon: 'person-outline' },
  { key: 'other', label: 'Other', icon: 'heart-outline' },
];

interface InsightsViewProps {
  onRefresh?: () => void;
}

export function InsightsView({ onRefresh }: InsightsViewProps) {
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  const [selectedCategory, setSelectedCategory] = useState<InsightCategory>('food');
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInsights = async (forceRefresh: boolean = false) => {
    try {
      const data = await generateInsights(forceRefresh);
      setInsights(data);
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadInsights(true);
    onRefresh?.();
  };

  const handleCategoryChange = (category: InsightCategory) => {
    if (category !== selectedCategory) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedCategory(category);
    }
  };

  const currentInsight = insights.find(i => i.category === selectedCategory);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themedColors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={[styles.loadingText, { color: themedColors.text.tertiary }]}>
          Analyzing your journal...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themedColors.background.primary }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary[500]}
          colors={[colors.primary[500]]}
        />
      }
    >
      {/* Category Tabs */}
      <View style={styles.tabsContainer}>
        {CATEGORY_TABS.map((tab) => {
          const isSelected = selectedCategory === tab.key;
          return (
            <AnimatedPressable
              key={tab.key}
              onPress={() => handleCategoryChange(tab.key)}
              style={[
                styles.tab,
                {
                  borderBottomColor: isSelected
                    ? colors.primary[500]
                    : 'transparent',
                },
              ]}
              hapticType="light"
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: isSelected
                      ? colors.primary[500]
                      : themedColors.text.tertiary,
                    fontWeight: isSelected
                      ? typography.fontWeight.semibold
                      : typography.fontWeight.regular,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {/* Insight Content */}
      {currentInsight ? (
        <Animated.View entering={FadeIn} style={styles.insightContainer}>
          {/* Understanding Section */}
          <Animated.View
            entering={FadeInDown.delay(100)}
            style={[styles.card, shadows.sm, { backgroundColor: themedColors.surface.primary }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primary[50] }]}>
                <Ionicons name="bulb-outline" size={20} color={colors.primary[500]} />
              </View>
              <Text style={[styles.cardTitle, { color: themedColors.text.primary }]}>
                AI Understanding
              </Text>
            </View>
            <Text style={[styles.understandingText, { color: themedColors.text.secondary }]}>
              {currentInsight.understanding}
            </Text>
          </Animated.View>

          {/* Suggestions Section */}
          <Animated.View
            entering={FadeInDown.delay(200)}
            style={[styles.card, shadows.sm, { backgroundColor: themedColors.surface.primary }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: colors.accent.emerald.light }]}>
                <Ionicons name="sparkles" size={20} color={colors.accent.emerald.base} />
              </View>
              <Text style={[styles.cardTitle, { color: themedColors.text.primary }]}>
                Suggestions for Well-being
              </Text>
            </View>
            <View style={styles.suggestionsList}>
              {currentInsight.suggestions.map((suggestion, index) => (
                <View key={index} style={styles.suggestionItem}>
                  <View style={[styles.suggestionBullet, { backgroundColor: colors.accent.emerald.base }]} />
                  <Text style={[styles.suggestionText, { color: themedColors.text.secondary }]}>
                    {suggestion}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Last Updated */}
          <Text style={[styles.lastUpdated, { color: themedColors.text.tertiary }]}>
            Last updated: {new Date(currentInsight.updatedAt).toLocaleString()}
          </Text>
        </Animated.View>
      ) : (
        <View style={styles.emptyInsight}>
          <Ionicons name="analytics-outline" size={48} color={themedColors.text.tertiary} />
          <Text style={[styles.emptyText, { color: themedColors.text.tertiary }]}>
            Add more photos to get personalized insights
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[4],
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: typography.fontSize.base,
  },
  insightContainer: {
    gap: spacing[4],
  },
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing[4],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
    gap: spacing[3],
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  understandingText: {
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
  },
  suggestionsList: {
    gap: spacing[3],
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  suggestionBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  suggestionText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
  },
  lastUpdated: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  emptyInsight: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[12],
    gap: spacing[3],
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
});

export default InsightsView;
