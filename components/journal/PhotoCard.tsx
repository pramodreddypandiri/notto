/**
 * PhotoCard - Photo journal entry card with swipe to delete
 *
 * Features:
 * - Photo thumbnail
 * - Category tag
 * - Caption display
 * - 3-dot menu for delete
 * - Swipe to delete with haptic feedback
 */

import React from 'react';
import { StyleSheet, View, Text, Image, Alert } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  FadeInRight,
  FadeOutLeft,
  Layout,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AnimatedPressable from '../ui/AnimatedPressable';
import { colors, typography, spacing, borderRadius, shadows, animation, getThemedColors } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { JournalPhoto, PhotoCategory } from '../../services/journalService';

const CATEGORY_CONFIG: Record<PhotoCategory, { label: string; icon: string; color: typeof colors.accent.violet }> = {
  food: { label: 'Food', icon: 'restaurant-outline', color: colors.accent.amber },
  selfie: { label: 'Selfie', icon: 'person-circle-outline', color: colors.accent.rose },
  other: { label: 'Other', icon: 'heart-outline', color: colors.accent.violet },
};

interface PhotoCardProps {
  photo: JournalPhoto;
  index: number;
  onDelete: (id: string) => void;
  onEditCaption: (id: string, caption: string) => void;
  onPress?: (photo: JournalPhoto) => void;
}

const SWIPE_THRESHOLD = 80;
const DELETE_THRESHOLD = 120;

export function PhotoCard({ photo, index, onDelete, onEditCaption, onPress }: PhotoCardProps) {
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  const translateX = useSharedValue(0);
  const deleteProgress = useSharedValue(0);
  const isDeleting = useSharedValue(false);

  const categoryConfig = CATEGORY_CONFIG[photo.category];

  const triggerDelete = () => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => {
          translateX.value = withSpring(0, animation.spring.default);
          deleteProgress.value = withTiming(0, { duration: animation.duration.fast });
          isDeleting.value = false;
        }},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onDelete(photo.id);
          },
        },
      ]
    );
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      'worklet';
      if (isDeleting.value) return;

      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, -DELETE_THRESHOLD);
        deleteProgress.value = Math.min(
          Math.abs(event.translationX) / SWIPE_THRESHOLD,
          1
        );
      }
    })
    .onEnd((event) => {
      'worklet';
      if (isDeleting.value) return;

      if (event.translationX < -SWIPE_THRESHOLD) {
        isDeleting.value = true;
        runOnJS(triggerDelete)();
      } else {
        translateX.value = withSpring(0, animation.spring.default);
        deleteProgress.value = withTiming(0, { duration: animation.duration.fast });
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animatedDeleteStyle = useAnimatedStyle(() => ({
    opacity: deleteProgress.value,
    transform: [{ scale: 0.8 + deleteProgress.value * 0.2 }],
  }));

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    // For photos older than 24 hours, show the date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const handleMenuPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Photo Options',
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: photo.caption ? 'Edit Caption' : 'Add Caption',
          onPress: () => {
            Alert.prompt(
              photo.caption ? 'Edit Caption' : 'Add Caption',
              'Enter a caption for this photo',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Save',
                  onPress: (newCaption) => {
                    if (newCaption !== undefined) {
                      onEditCaption(photo.id, newCaption.trim());
                    }
                  },
                },
              ],
              'plain-text',
              photo.caption || ''
            );
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(photo.id),
        },
      ]
    );
  };

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 50).springify().damping(15)}
      exiting={FadeOutLeft.duration(200)}
      layout={Layout.springify()}
      style={styles.container}
    >
      {/* Delete indicator */}
      <Animated.View style={[styles.deleteIndicator, animatedDeleteStyle]}>
        <Ionicons name="trash" size={24} color={colors.neutral[0]} />
        <Text style={styles.deleteText}>Delete</Text>
      </Animated.View>

      {/* Card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.card, shadows.md, animatedCardStyle, { backgroundColor: themedColors.surface.primary }]}>
          <AnimatedPressable
            onPress={() => onPress?.(photo)}
            style={styles.cardContent}
            hapticType="light"
            scaleIntensity="subtle"
          >
            {/* Photo thumbnail */}
            <Image source={{ uri: photo.localUri }} style={styles.thumbnail} />

            {/* Content */}
            <View style={styles.mainContent}>
              {/* Caption */}
              <Text
                style={[styles.caption, { color: themedColors.text.primary }]}
                numberOfLines={2}
              >
                {photo.caption || 'No caption'}
              </Text>

              {/* Meta row */}
              <View style={styles.metaRow}>
                <Text style={[styles.timestamp, { color: themedColors.text.tertiary }]}>
                  {formatTime(photo.createdAt)}
                </Text>

                {/* Category badge */}
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: categoryConfig.color.light },
                  ]}
                >
                  <Ionicons
                    name={categoryConfig.icon as any}
                    size={10}
                    color={categoryConfig.color.base}
                  />
                  <Text
                    style={[
                      styles.categoryText,
                      { color: categoryConfig.color.dark },
                    ]}
                  >
                    {categoryConfig.label}
                  </Text>
                </View>
              </View>
            </View>

            {/* Menu button */}
            <AnimatedPressable
              onPress={handleMenuPress}
              style={[styles.menuButton, { backgroundColor: themedColors.surface.secondary }]}
              hapticType="light"
            >
              <Ionicons name="ellipsis-vertical" size={20} color={themedColors.text.secondary} />
            </AnimatedPressable>
          </AnimatedPressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[3],
    position: 'relative',
  },
  deleteIndicator: {
    position: 'absolute',
    right: spacing[4],
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.semantic.error,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    gap: spacing[1],
  },
  deleteText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    padding: spacing[3],
    alignItems: 'center',
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    marginRight: spacing[3],
  },
  mainContent: {
    flex: 1,
    marginRight: spacing[2],
  },
  caption: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  timestamp: {
    fontSize: typography.fontSize.xs,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PhotoCard;
