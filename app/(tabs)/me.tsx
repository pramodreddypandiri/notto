/**
 * Me Tab - Personal productivity metrics and AI insights
 *
 * Features:
 * - Productivity metrics (streak, completion rate, tasks)
 * - Weekly trends and patterns
 * - AI-powered suggestions for improvement
 * - Inferred interests and preferences
 */

import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// Theme
import { colors, typography, spacing, borderRadius, shadows, getThemedColors } from '../../theme';

// Components
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import TopBar from '../../components/common/TopBar';

// Services
import productivityService, { ProductivityMetrics, WeeklyTrend } from '../../services/productivityService';
import patternsService, { Pattern } from '../../services/patternsService';
import { getUserProfile, UserProfile } from '../../services/profileService';

// Context
import { useTheme } from '../../context/ThemeContext';

export default function MeScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  const [refreshing, setRefreshing] = useState(false);
  const [todayMetrics, setTodayMetrics] = useState<ProductivityMetrics | null>(null);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrend | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentMetrics, setRecentMetrics] = useState<ProductivityMetrics[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [metrics, trend, streak, suggestablePatterns, userProfile, recent] = await Promise.all([
        productivityService.calculateDailyMetrics(),
        productivityService.getWeeklyTrend(),
        productivityService.getCurrentStreak(),
        patternsService.getSuggestablePatterns(),
        getUserProfile(),
        productivityService.getRecentMetrics(7),
      ]);

      setTodayMetrics(metrics);
      setWeeklyTrend(trend);
      setCurrentStreak(streak);
      setPatterns(suggestablePatterns);
      setProfile(userProfile);
      setRecentMetrics(recent);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadData();
    setRefreshing(false);
  }, []);

  const handlePatternDismiss = async (patternId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await patternsService.dismissSuggestion(patternId);
    setPatterns(patterns.filter(p => p.id !== patternId));
  };

  const getProductivityLevel = (rate: number | null): { label: string; color: string; icon: string } => {
    if (rate === null) return { label: 'No data', color: themedColors.text.tertiary, icon: 'remove-circle-outline' };
    if (rate >= 80) return { label: 'Excellent', color: colors.semantic.success, icon: 'trophy' };
    if (rate >= 60) return { label: 'Good', color: colors.accent.emerald.base, icon: 'thumbs-up' };
    if (rate >= 40) return { label: 'Fair', color: colors.semantic.warning, icon: 'trending-up' };
    return { label: 'Needs Work', color: colors.semantic.error, icon: 'fitness' };
  };

  const formatHour = (hour: number | null): string => {
    if (hour === null) return '--';
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour} ${period}`;
  };

  const productivity = getProductivityLevel(todayMetrics?.completion_rate ?? null);

  // Generate AI suggestions based on patterns and metrics
  const generateSuggestions = (): { icon: string; title: string; description: string }[] => {
    const suggestions: { icon: string; title: string; description: string }[] = [];

    // Streak-based suggestions
    if (currentStreak === 0) {
      suggestions.push({
        icon: 'flame-outline',
        title: 'Start a Streak',
        description: 'Complete at least 50% of your tasks today to begin building a productivity streak.',
      });
    } else if (currentStreak >= 7) {
      suggestions.push({
        icon: 'trophy',
        title: 'Amazing Streak!',
        description: `You're on a ${currentStreak}-day streak! Keep up the momentum.`,
      });
    }

    // Time-based suggestions
    if (todayMetrics?.most_productive_hour !== null && todayMetrics?.most_productive_hour !== undefined) {
      suggestions.push({
        icon: 'time-outline',
        title: 'Peak Performance Time',
        description: `You're most productive around ${formatHour(todayMetrics.most_productive_hour)}. Schedule important tasks then.`,
      });
    }

    // Weekly trend suggestions
    if (weeklyTrend) {
      if (weeklyTrend.avgCompletionRate < 50) {
        suggestions.push({
          icon: 'bulb-outline',
          title: 'Break Down Tasks',
          description: 'Try breaking larger tasks into smaller, manageable steps to boost completion rates.',
        });
      }
      if (weeklyTrend.mostProductiveDay) {
        suggestions.push({
          icon: 'calendar-outline',
          title: 'Best Day Pattern',
          description: `${weeklyTrend.mostProductiveDay} tends to be your most productive day. Plan important work accordingly.`,
        });
      }
    }

    // Voice vs text insights
    if (todayMetrics) {
      const total = todayMetrics.voice_notes_count + todayMetrics.text_notes_count;
      if (total > 0 && todayMetrics.voice_notes_count > todayMetrics.text_notes_count * 2) {
        suggestions.push({
          icon: 'mic-outline',
          title: 'Voice Power User',
          description: 'You prefer voice notes. Quick tip: speak clearly and mention due dates for better parsing.',
        });
      }
    }

    // Inferred interests from profile
    if (profile?.inferred_interests && profile.inferred_interests.length > 0) {
      suggestions.push({
        icon: 'heart-outline',
        title: 'Your Interests',
        description: `Based on your notes, you seem interested in: ${profile.inferred_interests.slice(0, 3).join(', ')}.`,
      });
    }

    return suggestions.slice(0, 4); // Limit to 4 suggestions
  };

  const suggestions = generateSuggestions();

  return (
    <View style={[styles.container, { backgroundColor: themedColors.background.primary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Shared TopBar */}
      <TopBar themedColors={themedColors} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
        }
      >
        {/* Streak & Overview Card */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <LinearGradient
            colors={colors.gradients.primary as [string, string]}
            style={styles.overviewCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.overviewRow}>
              <View style={styles.streakSection}>
                <View style={styles.streakIcon}>
                  <Ionicons name="flame" size={28} color={colors.neutral[0]} />
                </View>
                <View>
                  <Text style={styles.streakNumber}>{currentStreak}</Text>
                  <Text style={styles.streakLabel}>Day Streak</Text>
                </View>
              </View>

              <View style={styles.overviewDivider} />

              <View style={styles.todaySection}>
                <Text style={styles.todayLabel}>Today</Text>
                <Text style={styles.todayStats}>
                  {todayMetrics?.tasks_completed ?? 0}/{todayMetrics?.tasks_created ?? 0}
                </Text>
                <Text style={styles.todaySubLabel}>tasks done</Text>
              </View>
            </View>

            <View style={styles.completionBar}>
              <View
                style={[
                  styles.completionProgress,
                  { width: `${Math.min(todayMetrics?.completion_rate ?? 0, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.completionText}>
              {todayMetrics?.completion_rate?.toFixed(0) ?? 0}% completion rate
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* Quick Stats */}
        <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themedColors.text.tertiary }]}>This Week</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: themedColors.surface.primary }]}>
              <Ionicons name="checkmark-done" size={24} color={colors.accent.emerald.base} />
              <Text style={[styles.statNumber, { color: themedColors.text.primary }]}>
                {weeklyTrend?.totalTasksCompleted ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: themedColors.text.tertiary }]}>Completed</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: themedColors.surface.primary }]}>
              <Ionicons name="add-circle" size={24} color={colors.primary[500]} />
              <Text style={[styles.statNumber, { color: themedColors.text.primary }]}>
                {weeklyTrend?.totalTasksCreated ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: themedColors.text.tertiary }]}>Created</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: themedColors.surface.primary }]}>
              <Ionicons name={productivity.icon as any} size={24} color={productivity.color} />
              <Text style={[styles.statNumber, { color: themedColors.text.primary }]}>
                {weeklyTrend?.avgCompletionRate?.toFixed(0) ?? 0}%
              </Text>
              <Text style={[styles.statLabel, { color: themedColors.text.tertiary }]}>Avg Rate</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: themedColors.surface.primary }]}>
              <Ionicons name="star" size={24} color={colors.semantic.warning} />
              <Text style={[styles.statNumber, { color: themedColors.text.primary }]}>
                {weeklyTrend?.mostProductiveDay?.slice(0, 3) ?? '--'}
              </Text>
              <Text style={[styles.statLabel, { color: themedColors.text.tertiary }]}>Best Day</Text>
            </View>
          </View>
        </Animated.View>

        {/* AI Suggestions */}
        {suggestions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: themedColors.text.tertiary }]}>AI Insights</Text>
              <Ionicons name="sparkles" size={16} color={colors.primary[500]} />
            </View>

            <View style={[styles.suggestionsCard, { backgroundColor: themedColors.surface.primary }]}>
              {suggestions.map((suggestion, index) => (
                <View key={index}>
                  {index > 0 && <View style={[styles.divider, { backgroundColor: themedColors.surface.border }]} />}
                  <View style={styles.suggestionRow}>
                    <View style={[styles.suggestionIcon, { backgroundColor: colors.primary[50] }]}>
                      <Ionicons name={suggestion.icon as any} size={20} color={colors.primary[500]} />
                    </View>
                    <View style={styles.suggestionContent}>
                      <Text style={[styles.suggestionTitle, { color: themedColors.text.primary }]}>
                        {suggestion.title}
                      </Text>
                      <Text style={[styles.suggestionDescription, { color: themedColors.text.secondary }]}>
                        {suggestion.description}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Detected Patterns */}
        {patterns.length > 0 && (
          <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themedColors.text.tertiary }]}>Detected Patterns</Text>

            {patterns.slice(0, 3).map((pattern) => (
              <View
                key={pattern.id}
                style={[styles.patternCard, { backgroundColor: themedColors.surface.primary }]}
              >
                <View style={styles.patternHeader}>
                  <View style={[styles.patternIcon, { backgroundColor: colors.accent.violet.light }]}>
                    <Ionicons
                      name={
                        pattern.pattern_type === 'recurring_activity'
                          ? 'repeat'
                          : pattern.pattern_type === 'time_preference'
                          ? 'time'
                          : 'location'
                      }
                      size={18}
                      color={colors.accent.violet.dark}
                    />
                  </View>
                  <View style={styles.patternContent}>
                    <Text style={[styles.patternActivity, { color: themedColors.text.primary }]}>
                      {pattern.activity}
                    </Text>
                    <Text style={[styles.patternMeta, { color: themedColors.text.tertiary }]}>
                      {pattern.occurrences} times
                      {pattern.typical_time ? ` around ${pattern.typical_time}` : ''}
                    </Text>
                  </View>
                  <AnimatedPressable
                    onPress={() => handlePatternDismiss(pattern.id)}
                    style={styles.dismissButton}
                    hapticType="light"
                  >
                    <Ionicons name="close" size={18} color={themedColors.text.muted} />
                  </AnimatedPressable>
                </View>
                {pattern.suggestion && (
                  <Text style={[styles.patternSuggestion, { color: themedColors.text.secondary }]}>
                    {pattern.suggestion}
                  </Text>
                )}
              </View>
            ))}
          </Animated.View>
        )}

        {/* Weekly Activity Chart (Simple) */}
        {recentMetrics.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themedColors.text.tertiary }]}>Last 7 Days</Text>
            <View style={[styles.chartCard, { backgroundColor: themedColors.surface.primary }]}>
              <View style={styles.chartBars}>
                {Array.from({ length: 7 }).map((_, index) => {
                  const date = new Date();
                  date.setDate(date.getDate() - (6 - index));
                  const dateStr = date.toISOString().split('T')[0];
                  const metric = recentMetrics.find(m => m.date === dateStr);
                  const rate = metric?.completion_rate ?? 0;
                  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);

                  return (
                    <View key={index} style={styles.chartBarContainer}>
                      <View style={styles.chartBarWrapper}>
                        <View
                          style={[
                            styles.chartBar,
                            {
                              height: `${Math.max(rate, 5)}%`,
                              backgroundColor: rate >= 50 ? colors.primary[500] : colors.neutral[300],
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.chartLabel, { color: themedColors.text.tertiary }]}>{dayName}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[5],
  },
  overviewCard: {
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    marginBottom: spacing[5],
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  streakSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  streakIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakNumber: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  streakLabel: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  overviewDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: spacing[4],
  },
  todaySection: {
    alignItems: 'center',
  },
  todayLabel: {
    fontSize: typography.fontSize.xs,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: spacing[1],
  },
  todayStats: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  todaySubLabel: {
    fontSize: typography.fontSize.xs,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  completionBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing[2],
  },
  completionProgress: {
    height: '100%',
    backgroundColor: colors.neutral[0],
    borderRadius: 4,
  },
  completionText: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  statNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing[2],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing[1],
  },
  suggestionsCard: {
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    ...shadows.sm,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[2],
  },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing[1],
  },
  suggestionDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * 1.5,
  },
  divider: {
    height: 1,
    marginVertical: spacing[2],
  },
  patternCard: {
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  patternHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patternIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  patternContent: {
    flex: 1,
  },
  patternActivity: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  patternMeta: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing[1],
  },
  dismissButton: {
    padding: spacing[2],
  },
  patternSuggestion: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing[3],
    paddingLeft: 48,
    fontStyle: 'italic',
  },
  chartCard: {
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    ...shadows.sm,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarWrapper: {
    height: 80,
    width: 24,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  chartLabel: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing[2],
  },
});
