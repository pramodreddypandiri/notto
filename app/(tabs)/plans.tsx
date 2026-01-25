/**
 * Plans Screen - Place suggestions with Like/Dislike feedback
 *
 * Features:
 * - Two sections: Going (liked places) and Suggestions
 * - Like/Dislike feedback for learning user preferences
 * - Pull-to-refresh for new suggestions
 * - AI-powered personalized suggestions
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  StatusBar,
  Alert,
  SectionList,
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
import PremiumButton from '../../components/ui/PremiumButton';
import { PlaceCard } from '../../components/plans/PlaceCard';
import { PlanGenerationLoader } from '../../components/plans/PlanGenerationLoader';
import TopBar from '../../components/common/TopBar';

// Services
import {
  createPlaceSuggestions,
  getSuggestions,
  getLikedPlaces,
  updateSuggestionStatus,
  removeLikedPlace,
  StoredPlaceSuggestion,
} from '../../services/plansService';
import { supabase } from '../../config/supabase';
import soundService from '../../services/soundService';

export default function PlansScreen() {
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  const [suggestions, setSuggestions] = useState<StoredPlaceSuggestion[]>([]);
  const [likedPlaces, setLikedPlaces] = useState<StoredPlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Load existing suggestions and liked places on mount
  useEffect(() => {
    loadPlaces();
  }, []);

  const loadPlaces = async () => {
    try {
      const [suggestionsData, likedData] = await Promise.all([
        getSuggestions(),
        getLikedPlaces(),
      ]);
      setSuggestions(suggestionsData);
      setLikedPlaces(likedData);
    } catch (error) {
      console.error('Failed to load places:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    setShowGenerator(true);
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
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

      const newSuggestions = await createPlaceSuggestions(userLocation);
      setSuggestions(prev => [...newSuggestions, ...prev]);
      await soundService.playPlanReady();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
      await soundService.playError();
      Alert.alert('Error', 'Failed to generate suggestions. Please try again.');
    } finally {
      setShowGenerator(false);
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await loadPlaces();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleLike = async (id: string) => {
    try {
      const updated = await updateSuggestionStatus(id, 'liked');
      // Move from suggestions to liked
      setSuggestions(prev => prev.filter(s => s.id !== id));
      setLikedPlaces(prev => [updated, ...prev]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to like place:', error);
    }
  };

  const handleDislike = async (id: string) => {
    try {
      await updateSuggestionStatus(id, 'disliked');
      // Remove from suggestions
      setSuggestions(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to dislike place:', error);
    }
  };

  const handleRemoveLiked = async (id: string) => {
    try {
      await removeLikedPlace(id);
      setLikedPlaces(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to remove liked place:', error);
    }
  };

  // Prepare sections for SectionList
  const sections = [
    ...(likedPlaces.length > 0
      ? [{ title: 'Going', data: likedPlaces, type: 'going' as const }]
      : []),
    ...(suggestions.length > 0
      ? [{ title: 'Suggestions', data: suggestions, type: 'suggestion' as const }]
      : []),
  ];

  const isEmpty = likedPlaces.length === 0 && suggestions.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: themedColors.background.primary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Bar */}
      <TopBar themedColors={themedColors} />

      {/* Page Title */}
      <View style={styles.pageTitleContainer}>
        <Text style={[styles.pageTitle, { color: themedColors.text.primary }]}>Places</Text>
        <Text style={[styles.pageSubtitle, { color: themedColors.text.tertiary }]}>
          {likedPlaces.length > 0
            ? `${likedPlaces.length} place${likedPlaces.length > 1 ? 's' : ''} to visit`
            : 'Discover places made for you'}
        </Text>
      </View>

      {/* Content */}
      {showGenerator ? (
        <PlanGenerationLoader
          isLoading={loading}
          onComplete={() => setShowGenerator(false)}
        />
      ) : initialLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: themedColors.text.tertiary }]}>
            Loading...
          </Text>
        </View>
      ) : isEmpty ? (
        <EmptyState onGenerate={handleGenerateSuggestions} loading={loading} themedColors={themedColors} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <SectionHeader
              title={section.title}
              count={section.data.length}
              type={section.type}
              themedColors={themedColors}
            />
          )}
          renderItem={({ item, index, section }) => (
            <PlaceCard
              place={item}
              index={index}
              onLike={handleLike}
              onDislike={handleDislike}
              variant={section.type === 'going' ? 'going' : 'suggestion'}
              onRemove={section.type === 'going' ? handleRemoveLiked : undefined}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary[500]}
              colors={[colors.primary[500]]}
            />
          }
          ListFooterComponent={
            suggestions.length > 0 ? (
              <View style={styles.footerContainer}>
                <PremiumButton
                  onPress={handleGenerateSuggestions}
                  loading={loading}
                  gradient
                  size="md"
                  icon={!loading ? <Ionicons name="sparkles" size={18} color={colors.neutral[0]} /> : undefined}
                >
                  Get More Suggestions
                </PremiumButton>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// Section Header Component
function SectionHeader({
  title,
  count,
  type,
  themedColors,
}: {
  title: string;
  count: number;
  type: 'going' | 'suggestion';
  themedColors: ReturnType<typeof getThemedColors>;
}) {
  return (
    <Animated.View
      entering={FadeIn.delay(100)}
      style={styles.sectionHeader}
    >
      <View style={styles.sectionTitleContainer}>
        <Ionicons
          name={type === 'going' ? 'heart' : 'sparkles'}
          size={20}
          color={type === 'going' ? colors.accent.emerald.base : colors.primary[500]}
        />
        <Text style={[styles.sectionTitle, { color: themedColors.text.primary }]}>
          {title}
        </Text>
        <View style={[styles.countBadge, { backgroundColor: themedColors.surface.secondary }]}>
          <Text style={[styles.countText, { color: themedColors.text.secondary }]}>
            {count}
          </Text>
        </View>
      </View>
    </Animated.View>
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
  themedColors: ReturnType<typeof getThemedColors>;
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
          <Ionicons name="compass" size={48} color={colors.neutral[0]} />
        </LinearGradient>

        {/* Decorative rings */}
        <View style={[styles.decorativeRing, styles.ring1]} />
        <View style={[styles.decorativeRing, styles.ring2]} />
        <View style={[styles.decorativeRing, styles.ring3]} />
      </View>

      <Text style={[styles.emptyTitle, { color: themedColors.text.primary }]}>
        Discover places just for you
      </Text>
      <Text style={[styles.emptyText, { color: themedColors.text.tertiary }]}>
        Get personalized suggestions based on your notes and personality.
        Like places to save them to your Going list.
      </Text>

      <View style={styles.featureList}>
        <FeatureItem
          icon="document-text"
          text="Based on your voice notes"
          themedColors={themedColors}
        />
        <FeatureItem
          icon="person"
          text="Matches your personality"
          themedColors={themedColors}
        />
        <FeatureItem
          icon="heart"
          text="Learns from your feedback"
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
        Get Suggestions
      </PremiumButton>
    </Animated.View>
  );
}

// Feature Item Component
function FeatureItem({
  icon,
  text,
  themedColors,
}: {
  icon: string;
  text: string;
  themedColors: ReturnType<typeof getThemedColors>;
}) {
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, { backgroundColor: themedColors.primary[50] }]}>
        <Ionicons name={icon as any} size={16} color={colors.primary[500]} />
      </View>
      <Text style={[styles.featureText, { color: themedColors.text.secondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.base,
  },
  listContent: {
    padding: spacing[5],
    paddingBottom: spacing[20],
  },
  sectionHeader: {
    marginBottom: spacing[3],
    marginTop: spacing[2],
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  countBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  footerContainer: {
    marginTop: spacing[4],
    alignItems: 'center',
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
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * 1.5,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: typography.fontSize.base,
  },
});
