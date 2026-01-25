/**
 * PlaceCard - Individual place suggestion card with Like/Dislike feedback
 *
 * Features:
 * - Animated entrance
 * - Category icon and badge
 * - Like/Dislike swipe actions
 * - Price range indicator
 * - Reason explanation
 */

import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeInDown,
  FadeOutLeft,
  FadeOutRight,
  Layout,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AnimatedPressable from '../ui/AnimatedPressable';
import { colors, typography, spacing, borderRadius, shadows, getThemedColors } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { StoredPlaceSuggestion } from '../../services/plansService';

// Category to icon mapping
const CATEGORY_ICONS: Record<string, string> = {
  activity: 'game-controller',
  food: 'restaurant',
  park: 'leaf',
  shopping: 'bag',
  entertainment: 'film',
  fitness: 'fitness',
  cafe: 'cafe',
  bar: 'beer',
  other: 'location',
};

// Category to color mapping
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  activity: { bg: '#EEF2FF', text: '#4F46E5' },
  food: { bg: '#FEF3C7', text: '#D97706' },
  park: { bg: '#D1FAE5', text: '#059669' },
  shopping: { bg: '#FCE7F3', text: '#DB2777' },
  entertainment: { bg: '#E0E7FF', text: '#6366F1' },
  fitness: { bg: '#CFFAFE', text: '#0891B2' },
  cafe: { bg: '#FED7AA', text: '#C2410C' },
  bar: { bg: '#DDD6FE', text: '#7C3AED' },
  other: { bg: '#F3F4F6', text: '#6B7280' },
};

interface PlaceCardProps {
  place: StoredPlaceSuggestion;
  index: number;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
  variant?: 'suggestion' | 'going';
  onRemove?: (id: string) => void;
}

export function PlaceCard({
  place,
  index,
  onLike,
  onDislike,
  variant = 'suggestion',
  onRemove,
}: PlaceCardProps) {
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);
  const [isAnimatingOut, setIsAnimatingOut] = useState<'left' | 'right' | null>(null);

  // Animation values
  const likeScale = useSharedValue(1);
  const dislikeScale = useSharedValue(1);

  const categoryColors = CATEGORY_COLORS[place.category] || CATEGORY_COLORS.other;
  const categoryIcon = CATEGORY_ICONS[place.category] || 'location';

  const handleLike = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    likeScale.value = withSpring(1.3, { damping: 10 });
    setTimeout(() => {
      likeScale.value = withSpring(1);
      setIsAnimatingOut('right');
      setTimeout(() => onLike(place.id), 200);
    }, 150);
  };

  const handleDislike = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    dislikeScale.value = withSpring(1.3, { damping: 10 });
    setTimeout(() => {
      dislikeScale.value = withSpring(1);
      setIsAnimatingOut('left');
      setTimeout(() => onDislike(place.id), 200);
    }, 150);
  };

  const handleRemove = () => {
    if (onRemove) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsAnimatingOut('left');
      setTimeout(() => onRemove(place.id), 200);
    }
  };

  const animatedLikeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const animatedDislikeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dislikeScale.value }],
  }));

  const exitAnimation = isAnimatingOut === 'left' ? SlideOutLeft : SlideOutRight;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).springify().damping(15)}
      exiting={exitAnimation.duration(200)}
      layout={Layout.springify()}
      style={[
        styles.card,
        shadows.md,
        { backgroundColor: themedColors.surface.primary },
      ]}
    >
      {/* Header with category badge */}
      <View style={styles.header}>
        <View style={[styles.categoryBadge, { backgroundColor: categoryColors.bg }]}>
          <Ionicons name={categoryIcon as any} size={14} color={categoryColors.text} />
          <Text style={[styles.categoryText, { color: categoryColors.text }]}>
            {place.category.charAt(0).toUpperCase() + place.category.slice(1)}
          </Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={[styles.priceRange, { color: themedColors.text.secondary }]}>
            {place.price_range}
          </Text>
        </View>
      </View>

      {/* Place name and address */}
      <Text style={[styles.placeName, { color: themedColors.text.primary }]}>
        {place.name}
      </Text>
      {place.address && (
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={14} color={themedColors.text.tertiary} />
          <Text style={[styles.address, { color: themedColors.text.tertiary }]}>
            {place.address}
          </Text>
        </View>
      )}

      {/* Description */}
      {place.description && (
        <Text style={[styles.description, { color: themedColors.text.secondary }]} numberOfLines={2}>
          {place.description}
        </Text>
      )}

      {/* Why this suggestion */}
      <View style={[styles.reasonContainer, { backgroundColor: isDark ? colors.primary[900] : colors.primary[50] }]}>
        <Ionicons name="sparkles" size={14} color={colors.primary[500]} />
        <Text style={[styles.reasonText, { color: isDark ? colors.primary[300] : colors.primary[700] }]} numberOfLines={2}>
          {place.reason}
        </Text>
      </View>

      {/* Source badge */}
      <View style={styles.sourceBadge}>
        <Ionicons
          name={place.source === 'notes' ? 'document-text' : place.source === 'personality' ? 'person' : 'trending-up'}
          size={12}
          color={themedColors.text.tertiary}
        />
        <Text style={[styles.sourceText, { color: themedColors.text.tertiary }]}>
          {place.source === 'notes' ? 'From your notes' : place.source === 'personality' ? 'Matches your style' : 'Discover something new'}
        </Text>
      </View>

      {/* Action buttons */}
      {variant === 'suggestion' ? (
        <View style={styles.actionContainer}>
          <Animated.View style={[styles.actionButtonWrapper, animatedDislikeStyle]}>
            <AnimatedPressable
              onPress={handleDislike}
              style={[styles.actionButton, styles.dislikeButton]}
              hapticType="medium"
            >
              <Ionicons name="close" size={24} color={colors.neutral[500]} />
            </AnimatedPressable>
          </Animated.View>

          <Animated.View style={[styles.actionButtonWrapper, animatedLikeStyle]}>
            <AnimatedPressable
              onPress={handleLike}
              style={[styles.actionButton, styles.likeButton]}
              hapticType="medium"
            >
              <Ionicons name="heart" size={24} color={colors.accent.emerald.base} />
            </AnimatedPressable>
          </Animated.View>
        </View>
      ) : (
        <View style={styles.goingActionContainer}>
          <AnimatedPressable
            onPress={handleRemove}
            style={[styles.removeButton, { borderColor: themedColors.surface.border }]}
            hapticType="light"
          >
            <Ionicons name="trash-outline" size={18} color={colors.neutral[500]} />
            <Text style={[styles.removeText, { color: themedColors.text.tertiary }]}>Remove</Text>
          </AnimatedPressable>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  categoryText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  priceContainer: {
    paddingHorizontal: spacing[2],
  },
  priceRange: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  placeName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing[1],
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  address: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  description: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * 1.5,
    marginBottom: spacing[3],
  },
  reasonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    marginBottom: spacing[3],
  },
  reasonText: {
    fontSize: typography.fontSize.sm,
    flex: 1,
    lineHeight: typography.fontSize.sm * 1.4,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[3],
  },
  sourceText: {
    fontSize: typography.fontSize.xs,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[6],
  },
  actionButtonWrapper: {},
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  likeButton: {
    backgroundColor: colors.accent.emerald.light,
    borderColor: colors.accent.emerald.base,
  },
  dislikeButton: {
    backgroundColor: colors.neutral[100],
    borderColor: colors.neutral[300],
  },
  goingActionContainer: {
    alignItems: 'flex-start',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  removeText: {
    fontSize: typography.fontSize.sm,
  },
});

export default PlaceCard;
