/**
 * Plans Screen - Premium weekend plans with magic generation experience
 *
 * Features:
 * - Engaging plan generation loading animation
 * - Animated plan cards with timeline visualization
 * - Interactive feedback system
 * - Pull-to-refresh
 * - Empty state with call-to-action
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  StatusBar,
  Alert,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Theme
import { colors, typography, spacing, borderRadius, shadows, getThemedColors } from '../../theme';

// Context
import { useTheme } from '../../context/ThemeContext';

// Components
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import PremiumButton from '../../components/ui/PremiumButton';
import PlanCard from '../../components/plans/PlanCard';
import { PlanGenerationLoader } from '../../components/plans/PlanGenerationLoader';
import TopBar from '../../components/common/TopBar';

// Services
import { createWeekendPlans, submitFeedback } from '../../services/plansService';
import { supabase } from '../../config/supabase';
import soundService from '../../services/soundService';

// Demo mode
const DEMO_MODE = false;

interface Activity {
  time: string;
  name: string;
  address: string;
  duration: string;
  type?: string;
}

interface Plan {
  id: string;
  plan_data: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    activities: Activity[];
    reasoning: string;
    totalDistance?: string;
  };
}

const DEMO_PLANS: Plan[] = [
  {
    id: '1',
    plan_data: {
      title: 'Saturday Evening Adventure',
      date: 'Saturday',
      startTime: '6:00 PM',
      endTime: '10:00 PM',
      activities: [
        {
          time: '6:00 PM',
          name: 'Lucky Strike Bowling',
          address: '123 Main St, Downtown',
          duration: '1.5 hours',
          type: 'activity',
        },
        {
          time: '7:45 PM',
          name: 'Casa Luna Mexican Restaurant',
          address: '456 Oak Ave',
          duration: '1.5 hours',
          type: 'dining',
        },
        {
          time: '9:30 PM',
          name: 'Sweet Treats Dessert Bar',
          address: '789 Park Blvd',
          duration: '30 minutes',
          type: 'dessert',
        },
      ],
      reasoning:
        'Based on your interest in bowling and Mexican food, I\'ve crafted an evening that combines active fun with delicious dining. The timeline allows for a relaxed pace with short drives between venues.',
      totalDistance: '2.3 miles',
    },
  },
  {
    id: '2',
    plan_data: {
      title: 'Sunday Afternoon Chill',
      date: 'Sunday',
      startTime: '2:00 PM',
      endTime: '6:00 PM',
      activities: [
        {
          time: '2:00 PM',
          name: 'Retro Lanes Bowling',
          address: '321 Center St',
          duration: '2 hours',
          type: 'activity',
        },
        {
          time: '4:15 PM',
          name: 'Taco Paradise',
          address: '654 Elm St',
          duration: '1.5 hours',
          type: 'dining',
        },
      ],
      reasoning:
        'A more relaxed Sunday option with your favorite activities. This plan gives you extra bowling time and ends earlier so you\'re refreshed for the week ahead.',
      totalDistance: '1.8 miles',
    },
  },
];

export default function PlansScreen() {
  // Theme
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);

  const handleGeneratePlans = async () => {
    setShowGenerator(true);
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (DEMO_MODE) {
        // The loader handles its own timing, we just wait
        await new Promise((resolve) => setTimeout(resolve, 7000));
        setPlans(DEMO_PLANS);
        await soundService.playPlanReady();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        // Get user location from preferences
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user?.id)
          .single();

        if (!prefs?.location_city) {
          Alert.alert(
            'Location Required',
            'Please set your location in Settings first'
          );
          setShowGenerator(false);
          setLoading(false);
          return;
        }

        const userLocation = {
          lat: prefs.location_lat,
          lng: prefs.location_lng,
          city: prefs.location_city,
        };

        const newPlans = await createWeekendPlans(userLocation);
        setPlans(newPlans);
        await soundService.playPlanReady();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Failed to generate plans:', error);
      await soundService.playError();
      Alert.alert('Error', 'Failed to generate plans. Please try again.');
    } finally {
      setShowGenerator(false);
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (plans.length === 0) return;

    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Simulate refresh
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, [plans]);

  const handleFeedback = async (planId: string, rating: 'up' | 'down') => {
    try {
      if (DEMO_MODE) {
        // Just show confirmation in demo mode
        return;
      }
      await submitFeedback(planId, rating);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const handleRegenerate = () => {
    setPlans([]);
    handleGeneratePlans();
  };

  return (
    <View style={[styles.container, { backgroundColor: themedColors.background.primary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Bar with greeting and profile */}
      <TopBar themedColors={themedColors} />

      {/* Page Title */}
      <View style={styles.pageTitleContainer}>
        <Text style={[styles.pageTitle, { color: themedColors.text.primary }]}>Weekend Plans</Text>
        <Text style={[styles.pageSubtitle, { color: themedColors.text.tertiary }]}>
          {plans.length > 0
            ? `${plans.length} plans ready for you`
            : 'Let\'s plan something amazing'}
        </Text>
      </View>

      {/* Content */}
      {showGenerator ? (
        <PlanGenerationLoader
          isLoading={loading}
          onComplete={() => setShowGenerator(false)}
        />
      ) : plans.length === 0 ? (
        <EmptyState onGenerate={handleGeneratePlans} loading={loading} themedColors={themedColors} />
      ) : (
        <Animated.ScrollView
          entering={FadeIn.delay(300)}
          style={styles.plansContainer}
          contentContainerStyle={styles.plansContent}
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
          {/* Plans header */}
          <View style={styles.plansHeader}>
            <View>
              <Text style={[styles.plansTitle, { color: themedColors.text.primary }]}>Your Plans</Text>
              <Text style={[styles.plansSubtitle, { color: themedColors.text.tertiary }]}>
                Tap a plan to see details
              </Text>
            </View>
            <AnimatedPressable
              onPress={handleRegenerate}
              style={[styles.regenerateButton, { backgroundColor: isDark ? colors.primary[900] : colors.primary[50] }]}
              hapticType="light"
            >
              <Ionicons
                name="refresh"
                size={18}
                color={colors.primary[500]}
              />
              <Text style={styles.regenerateText}>New Plans</Text>
            </AnimatedPressable>
          </View>

          {/* Plan cards */}
          {plans.map((plan, index) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              index={index}
              onFeedback={handleFeedback}
            />
          ))}

          {/* Bottom spacing */}
          <View style={styles.bottomSpacer} />
        </Animated.ScrollView>
      )}
    </View>
  );
}

// Empty State Component
function EmptyState({
  onGenerate,
  loading,
  themedColors,
}: {
  onGenerate: () => void;
  loading: boolean;
  themedColors?: ReturnType<typeof getThemedColors>;
}) {
  return (
    <Animated.View
      entering={FadeIn.delay(300)}
      style={styles.emptyState}
    >
      <View style={styles.emptyIconContainer}>
        <LinearGradient
          colors={colors.gradients.primary as [string, string]}
          style={styles.emptyIconGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="sparkles" size={48} color={colors.neutral[0]} />
        </LinearGradient>

        {/* Decorative rings */}
        <View style={[styles.decorativeRing, styles.ring1]} />
        <View style={[styles.decorativeRing, styles.ring2]} />
        <View style={[styles.decorativeRing, styles.ring3]} />
      </View>

      <Text style={[styles.emptyTitle, { color: themedColors?.text.primary || colors.neutral[900] }]}>Ready to plan your weekend?</Text>
      <Text style={[styles.emptyText, { color: themedColors?.text.tertiary || colors.neutral[500] }]}>
        I'll analyze your notes and preferences to create personalized plans
        just for you.
      </Text>

      <View style={styles.featureList}>
        <FeatureItem
          icon="location"
          text="Finds places near you"
          themedColors={themedColors}
        />
        <FeatureItem
          icon="heart"
          text="Based on your preferences"
          themedColors={themedColors}
        />
        <FeatureItem
          icon="time"
          text="Optimized timing"
          themedColors={themedColors}
        />
      </View>

      <PremiumButton
        onPress={onGenerate}
        loading={loading}
        gradient
        size="lg"
        fullWidth
        icon={
          !loading ? (
            <Ionicons name="sparkles" size={20} color={colors.neutral[0]} />
          ) : undefined
        }
      >
        Generate Plans
      </PremiumButton>
    </Animated.View>
  );
}

// Feature Item Component
function FeatureItem({ icon, text, themedColors }: { icon: string; text: string; themedColors?: ReturnType<typeof getThemedColors> }) {
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, { backgroundColor: themedColors?.primary[50] || colors.primary[50] }]}>
        <Ionicons name={icon as any} size={16} color={colors.primary[500]} />
      </View>
      <Text style={[styles.featureText, { color: themedColors?.text.secondary || colors.neutral[700] }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  pageTitleContainer: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  pageTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing[1],
  },
  pageSubtitle: {
    fontSize: typography.fontSize.sm,
  },
  plansContainer: {
    flex: 1,
  },
  plansContent: {
    padding: spacing[5],
  },
  plansHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  plansTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[900],
  },
  plansSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.full,
  },
  regenerateText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  bottomSpacer: {
    height: spacing[10],
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  emptyIconContainer: {
    position: 'relative',
    marginBottom: spacing[6],
  },
  emptyIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.primary,
  },
  decorativeRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: 9999,
  },
  ring1: {
    width: 130,
    height: 130,
    top: -15,
    left: -15,
    opacity: 0.5,
  },
  ring2: {
    width: 160,
    height: 160,
    top: -30,
    left: -30,
    opacity: 0.3,
  },
  ring3: {
    width: 190,
    height: 190,
    top: -45,
    left: -45,
    opacity: 0.15,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[900],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[500],
    textAlign: 'center',
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
    marginBottom: spacing[6],
  },
  featureList: {
    width: '100%',
    marginBottom: spacing[8],
    gap: spacing[3],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[700],
  },
});
