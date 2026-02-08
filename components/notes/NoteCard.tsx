/**
 * NoteCard - Premium animated note card with swipe actions
 *
 * Features:
 * - Swipe to delete with haptic feedback
 * - Tag display with colored badges
 * - Reminder time indicator
 * - Long-press for quick actions
 * - Smooth entrance animation
 */

import React, { useState } from 'react';
import { StyleSheet, View, Text, Linking } from 'react-native';
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
import { colors, typography, spacing, borderRadius, shadows, animation, tagColors, getThemedColors } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import notificationService from '../../services/notificationService';

type NoteTag = 'reminder';
type NoteType = 'journal' | 'task' | 'reminder';

interface EnrichmentLink {
  title: string;
  url: string;
  source: string;
}

interface EnrichmentData {
  links?: EnrichmentLink[];
  tips?: string[];
  estimatedDuration?: number;
}

interface Note {
  id: string;
  transcript: string;
  parsed_data?: {
    summary: string;
    type: string;
  };
  created_at: string;
  tags?: NoteTag[];
  reminder_time?: string;
  note_type?: NoteType;
  is_reminder?: boolean;
  enrichment_data?: EnrichmentData;
}

const NOTE_TYPE_CONFIG: Record<NoteType, { label: string; icon: string; color: typeof colors.accent.violet }> = {
  journal: { label: 'Journal', icon: 'book-outline', color: colors.accent.violet },
  task: { label: 'Task', icon: 'checkbox-outline', color: colors.accent.emerald },
  reminder: { label: 'Reminder', icon: 'notifications-outline', color: colors.accent.rose },
};

interface NoteCardProps {
  note: Note;
  index: number;
  onDelete: (id: string) => void;
  onTagPress: (id: string) => void;
  onPress?: (id: string) => void;
}

const SWIPE_THRESHOLD = 80;
const DELETE_THRESHOLD = 120;

/** Strip leading "Reminder:", "Remind me to", etc. from display text */
const cleanReminderPrefix = (text: string): string =>
  text
    .replace(/^reminder[:\s]+/i, '')
    .replace(/^remind me (to )?(that )?/i, '')
    .replace(/^don'?t forget (to )?(that )?/i, '')
    .trim();

const TAG_ICONS: Record<NoteTag, string> = {
  reminder: 'alarm',
};

const TAG_LABELS: Record<NoteTag, string> = {
  reminder: 'Reminder',
};

// Enrichment Section Component
function EnrichmentSection({
  enrichment,
  themedColors,
  isDark,
}: {
  enrichment: EnrichmentData;
  themedColors: ReturnType<typeof getThemedColors>;
  isDark: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasLinks = enrichment.links && enrichment.links.length > 0;
  const hasTips = enrichment.tips && enrichment.tips.length > 0;

  const handleLinkPress = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
  };

  return (
    <View style={styles.enrichmentContainer}>
      <AnimatedPressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setExpanded(!expanded);
        }}
        style={[styles.enrichmentHeader, { backgroundColor: isDark ? colors.primary[900] + '30' : colors.primary[50] }]}
        hapticType="light"
      >
        <View style={styles.enrichmentHeaderContent}>
          <Ionicons name="bulb-outline" size={14} color={colors.primary[500]} />
          <Text style={[styles.enrichmentHeaderText, { color: colors.primary[600] }]}>
            {hasLinks ? `${enrichment.links!.length} link${enrichment.links!.length > 1 ? 's' : ''}` : ''}
            {hasLinks && hasTips ? ' · ' : ''}
            {hasTips ? `${enrichment.tips!.length} tip${enrichment.tips!.length > 1 ? 's' : ''}` : ''}
            {enrichment.estimatedDuration ? ` · ~${enrichment.estimatedDuration} min` : ''}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.primary[500]}
        />
      </AnimatedPressable>

      {expanded && (
        <View style={styles.enrichmentContent}>
          {/* Links */}
          {hasLinks && (
            <View style={styles.enrichmentLinks}>
              {enrichment.links!.map((link, index) => (
                <AnimatedPressable
                  key={index}
                  onPress={() => handleLinkPress(link.url)}
                  style={[styles.enrichmentLink, { backgroundColor: themedColors.surface.secondary }]}
                  hapticType="light"
                >
                  <Ionicons
                    name={link.source === 'amazon' ? 'cart-outline' : 'link-outline'}
                    size={14}
                    color={colors.primary[500]}
                  />
                  <Text style={[styles.enrichmentLinkText, { color: colors.primary[600] }]} numberOfLines={1}>
                    {link.title}
                  </Text>
                  <Ionicons name="open-outline" size={12} color={themedColors.text.tertiary} />
                </AnimatedPressable>
              ))}
            </View>
          )}

          {/* Tips */}
          {hasTips && (
            <View style={styles.enrichmentTips}>
              {enrichment.tips!.map((tip, index) => (
                <View key={index} style={styles.enrichmentTip}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.accent.emerald.base} />
                  <Text style={[styles.enrichmentTipText, { color: themedColors.text.secondary }]}>
                    {tip}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export function NoteCard({
  note,
  index,
  onDelete,
  onTagPress,
  onPress,
}: NoteCardProps) {
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  const translateX = useSharedValue(0);
  const deleteProgress = useSharedValue(0);
  const isDeleting = useSharedValue(false);

  const triggerDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDelete(note.id);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      'worklet';
      if (isDeleting.value) return;

      // Only allow swiping left
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
        // Confirm delete
        isDeleting.value = true;
        translateX.value = withTiming(-400, { duration: animation.duration.normal });
        runOnJS(triggerDelete)();
      } else {
        // Snap back
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
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Format reminder time - handles both ISO strings and display strings
  const formatReminderTime = (reminderTime: string) => {
    // Check if it's an ISO date string (e.g. "2025-02-18T09:00:00.000Z")
    const isISOString = /^\d{4}-\d{2}-\d{2}/.test(reminderTime);
    if (isISOString) {
      try {
        const date = new Date(reminderTime);
        if (!isNaN(date.getTime())) {
          return notificationService.formatReminderDisplay(date);
        }
      } catch {
        return reminderTime;
      }
    }
    // Already a display string (e.g. "Tomorrow at 11 AM & 2 PM")
    return reminderTime;
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
            onPress={() => onPress?.(note.id)}
            onLongPress={() => onTagPress(note.id)}
            style={styles.cardContent}
            hapticType="light"
            scaleIntensity="subtle"
          >
            <View style={styles.mainContent}>
              {/* Note text - show original transcript so user recognizes their own words */}
              <Text style={[styles.noteText, { color: themedColors.text.primary }]} numberOfLines={2}>
                {cleanReminderPrefix(note.transcript)}
              </Text>

              {/* Timestamp and Note Type */}
              <View style={styles.metaRow}>
                <Text style={[styles.timestamp, { color: themedColors.text.tertiary }]}>{formatTime(note.created_at)}</Text>
                {note.note_type && (
                  <View
                    style={[
                      styles.noteTypeBadge,
                      { backgroundColor: NOTE_TYPE_CONFIG[note.note_type].color.light },
                    ]}
                  >
                    <Ionicons
                      name={NOTE_TYPE_CONFIG[note.note_type].icon as any}
                      size={10}
                      color={NOTE_TYPE_CONFIG[note.note_type].color.base}
                    />
                    <Text
                      style={[
                        styles.noteTypeText,
                        { color: NOTE_TYPE_CONFIG[note.note_type].color.dark },
                      ]}
                    >
                      {NOTE_TYPE_CONFIG[note.note_type].label}
                    </Text>
                  </View>
                )}
              </View>

              {/* Tags */}
              {note.tags && note.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {note.tags.map((tag) => (
                    <View
                      key={tag}
                      style={[
                        styles.tag,
                        { backgroundColor: tagColors[tag].background },
                      ]}
                    >
                      <Ionicons
                        name={TAG_ICONS[tag] as any}
                        size={12}
                        color={tagColors[tag].icon}
                      />
                      <Text style={[styles.tagText, { color: tagColors[tag].text }]}>
                        {TAG_LABELS[tag]}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Reminder time */}
              {note.reminder_time && (
                <View style={styles.reminderContainer}>
                  <View style={[styles.reminderBadge, { backgroundColor: isDark ? colors.accent.rose.dark + '20' : colors.accent.rose.light }]}>
                    <Ionicons name="notifications" size={14} color={colors.accent.rose.base} />
                    <Text style={[styles.reminderText, { color: isDark ? colors.accent.rose.light : colors.accent.rose.dark }]}>
                      {formatReminderTime(note.reminder_time)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Enrichment Data */}
              {note.enrichment_data && (note.enrichment_data.links?.length || note.enrichment_data.tips?.length) ? (
                <EnrichmentSection enrichment={note.enrichment_data} themedColors={themedColors} isDark={isDark} />
              ) : null}
            </View>

            {/* Action buttons */}
            <View style={styles.actions}>
              <AnimatedPressable
                onPress={() => onTagPress(note.id)}
                style={[styles.actionButton, { backgroundColor: themedColors.surface.secondary }]}
                hapticType="light"
              >
                <Ionicons name="ellipsis-vertical" size={20} color={themedColors.text.secondary} />
              </AnimatedPressable>
            </View>
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
    padding: spacing[4],
  },
  mainContent: {
    flex: 1,
    marginRight: spacing[3],
  },
  noteText: {
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
  noteTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  noteTypeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  tagText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  reminderContainer: {
    marginTop: spacing[3],
  },
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  reminderText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  actions: {
    justifyContent: 'flex-start',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Enrichment styles
  enrichmentContainer: {
    marginTop: spacing[3],
  },
  enrichmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
  },
  enrichmentHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  enrichmentHeaderText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  enrichmentContent: {
    marginTop: spacing[2],
    gap: spacing[2],
  },
  enrichmentLinks: {
    gap: spacing[2],
  },
  enrichmentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
  },
  enrichmentLinkText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  enrichmentTips: {
    gap: spacing[2],
  },
  enrichmentTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingHorizontal: spacing[2],
  },
  enrichmentTipText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.fontSize.xs * typography.lineHeight.relaxed,
  },
});

export default NoteCard;
