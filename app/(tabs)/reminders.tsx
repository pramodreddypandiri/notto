/**
 * Reminders Tab - View and manage reminders
 *
 * Features:
 * - Today's reminders (pending and completed)
 * - Mark reminders as done
 * - Edit reminder dates
 * - Delete reminders
 * - Upcoming reminders preview
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  Alert,
  StatusBar,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';

// Theme
import { colors, typography, spacing, borderRadius, shadows, getThemedColors } from '../../theme';

// Components
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { TopBar } from '../../components/common/TopBar';

// Services
import reminderService, { TodaysReminder } from '../../services/reminderService';

// Context
import { useTheme } from '../../context/ThemeContext';

type SectionData = {
  title: string;
  data: TodaysReminder[];
  emptyMessage?: string;
};

export default function RemindersScreen() {
  const [sections, setSections] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Theme
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  // Load reminders
  const loadReminders = async () => {
    try {
      const todaysReminders = await reminderService.getTodaysReminders();

      // Split into pending and completed
      const pending = todaysReminders.filter(r => !r.isCompleted);
      const completed = todaysReminders.filter(r => r.isCompleted);

      setSections([
        {
          title: 'Today',
          data: pending,
          emptyMessage: 'No reminders for today',
        },
        {
          title: 'Completed',
          data: completed,
          emptyMessage: 'No completed reminders',
        },
      ]);
    } catch (error) {
      console.error('Failed to load reminders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadReminders();
    }, [])
  );

  // Pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadReminders();
  };

  // Mark reminder as done
  const handleMarkDone = async (reminder: TodaysReminder) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const success = reminder.isCompleted
      ? await reminderService.undoReminderDone(reminder.note.id)
      : await reminderService.markReminderDone(reminder.note.id);

    if (success) {
      loadReminders();
    }
  };

  // Delete reminder
  const handleDelete = (reminder: TodaysReminder) => {
    const isOneTime = reminder.note.reminder_type === 'one-time';

    Alert.alert(
      'Delete Reminder',
      isOneTime
        ? 'This will permanently delete this reminder.'
        : 'This will delete this recurring reminder. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const success = await reminderService.deleteReminder(reminder.note.id);
            if (success) {
              loadReminders();
            }
          },
        },
      ]
    );
  };

  // Edit reminder (placeholder - would open a modal)
  const handleEdit = (_reminder: TodaysReminder) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Edit Reminder',
      'Edit functionality coming soon. You can delete and recreate the reminder for now.',
      [{ text: 'OK' }]
    );
  };

  // Render reminder item
  const renderReminderItem = ({ item, index }: { item: TodaysReminder; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      style={[
        styles.reminderCard,
        shadows.sm,
        {
          backgroundColor: themedColors.surface.primary,
          opacity: item.isCompleted ? 0.7 : 1,
        },
      ]}
    >
      {/* Checkbox / Done indicator */}
      <AnimatedPressable
        onPress={() => handleMarkDone(item)}
        style={[
          styles.checkbox,
          {
            backgroundColor: item.isCompleted
              ? colors.semantic.success
              : themedColors.surface.secondary,
            borderColor: item.isCompleted
              ? colors.semantic.success
              : themedColors.surface.border,
          },
        ]}
        hapticType="light"
      >
        {item.isCompleted && (
          <Ionicons name="checkmark" size={16} color={colors.neutral[0]} />
        )}
      </AnimatedPressable>

      {/* Content */}
      <View style={styles.reminderContent}>
        <Text
          style={[
            styles.reminderText,
            {
              color: themedColors.text.primary,
              textDecorationLine: item.isCompleted ? 'line-through' : 'none',
            },
          ]}
          numberOfLines={2}
        >
          {item.reminderText}
        </Text>

        <View style={styles.reminderMeta}>
          {/* Type badge */}
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor:
                  item.note.reminder_type === 'recurring'
                    ? colors.accent.violet.light
                    : colors.accent.sky.light,
              },
            ]}
          >
            <Ionicons
              name={item.note.reminder_type === 'recurring' ? 'repeat' : 'calendar-outline'}
              size={12}
              color={
                item.note.reminder_type === 'recurring'
                  ? colors.accent.violet.dark
                  : colors.accent.sky.dark
              }
            />
            <Text
              style={[
                styles.typeBadgeText,
                {
                  color:
                    item.note.reminder_type === 'recurring'
                      ? colors.accent.violet.dark
                      : colors.accent.sky.dark,
                },
              ]}
            >
              {item.timeDisplay}
            </Text>
          </View>

          {/* Event location if available */}
          {item.note.event_location && (
            <View style={styles.locationBadge}>
              <Ionicons
                name="location-outline"
                size={12}
                color={themedColors.text.tertiary}
              />
              <Text
                style={[styles.locationText, { color: themedColors.text.tertiary }]}
                numberOfLines={1}
              >
                {item.note.event_location}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <AnimatedPressable
          onPress={() => handleEdit(item)}
          style={[styles.actionButton, { backgroundColor: themedColors.surface.secondary }]}
          hapticType="light"
        >
          <Ionicons name="pencil-outline" size={18} color={themedColors.text.secondary} />
        </AnimatedPressable>

        <AnimatedPressable
          onPress={() => handleDelete(item)}
          style={[styles.actionButton, { backgroundColor: colors.semantic.error + '15' }]}
          hapticType="light"
        >
          <Ionicons name="trash-outline" size={18} color={colors.semantic.error} />
        </AnimatedPressable>
      </View>
    </Animated.View>
  );

  // Render section header
  const renderSectionHeader = ({ section }: { section: SectionData }) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: themedColors.text.secondary }]}>
        {section.title}
      </Text>
      {section.data.length > 0 && (
        <View style={[styles.countBadge, { backgroundColor: colors.primary[500] }]}>
          <Text style={styles.countText}>{section.data.length}</Text>
        </View>
      )}
    </View>
  );

  // Render empty section
  const renderSectionEmpty = (section: SectionData) => {
    if (section.data.length > 0) return null;

    return (
      <View style={styles.emptySection}>
        <Text style={[styles.emptySectionText, { color: themedColors.text.tertiary }]}>
          {section.emptyMessage}
        </Text>
      </View>
    );
  };

  // Empty state
  const renderEmptyState = () => (
    <Animated.View entering={FadeIn.delay(200)} style={styles.emptyState}>
      <View
        style={[
          styles.emptyIconContainer,
          { backgroundColor: colors.primary[50] },
        ]}
      >
        <Ionicons name="notifications-outline" size={48} color={colors.primary[400]} />
      </View>
      <Text style={[styles.emptyTitle, { color: themedColors.text.primary }]}>
        No Reminders Yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: themedColors.text.tertiary }]}>
        Record a voice note with a reminder like:{'\n'}
        "Remind me every Monday to post on LinkedIn"{'\n'}
        or "Event on Feb 18th, remind me 2 days before"
      </Text>
    </Animated.View>
  );

  const hasAnyReminders = sections.some(s => s.data.length > 0);

  return (
    <View style={[styles.container, { backgroundColor: themedColors.background.primary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <TopBar themedColors={themedColors} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: themedColors.text.tertiary }]}>
            Loading reminders...
          </Text>
        </View>
      ) : !hasAnyReminders ? (
        renderEmptyState()
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.note.id}
          renderItem={renderReminderItem}
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={({ section }) => renderSectionEmpty(section)}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary[500]}
              colors={[colors.primary[500]]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    padding: spacing[4],
    paddingBottom: 120,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
    marginTop: spacing[4],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countBadge: {
    marginLeft: spacing[2],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    marginBottom: spacing[3],
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  reminderContent: {
    flex: 1,
  },
  reminderText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing[2],
  },
  reminderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  typeBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: typography.fontSize.xs,
    maxWidth: 120,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySection: {
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
  },
});
