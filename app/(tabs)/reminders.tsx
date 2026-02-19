/**
 * Tasks Tab - View and manage tasks/reminders
 *
 * Features:
 * - Today's tasks (pending and completed)
 * - Mark tasks as done
 * - Edit task dates
 * - Delete tasks
 * - Task reminders shown here so users don't miss notifications
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  Alert,
  StatusBar,
  Linking,
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
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Theme
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  // Date helpers
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isTomorrow = (date: Date) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
  };

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDateShort = (date: Date) => {
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(new Date());
  };

  // Load reminders for the selected date
  const loadReminders = async (shouldRollover: boolean = false) => {
    try {
      // Roll over pending tasks from previous days (only on initial load/focus for today)
      if (shouldRollover && isToday(selectedDate)) {
        await reminderService.rolloverPendingTasks();
      }

      // Use the appropriate method based on selected date
      const reminders = isToday(selectedDate)
        ? await reminderService.getTodaysReminders()
        : await reminderService.getRemindersForDate(selectedDate);

      // Split into pending and completed
      const pending = reminders.filter(r => !r.isCompleted);
      const completed = reminders.filter(r => r.isCompleted);

      setSections([
        {
          title: formatDateLabel(selectedDate),
          data: pending,
          emptyMessage: `No tasks for ${formatDateLabel(selectedDate).toLowerCase()}`,
        },
        {
          title: 'Completed',
          data: completed,
          emptyMessage: 'No completed tasks',
        },
      ]);
    } catch (error) {
      console.error('Failed to load reminders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh on focus (with rollover to move pending tasks to today)
  useFocusEffect(
    useCallback(() => {
      loadReminders(true); // Roll over pending tasks on focus
    }, [selectedDate])
  );

  // Reload when selected date changes
  useEffect(() => {
    setLoading(true);
    loadReminders(false);
  }, [selectedDate]);

  // Pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadReminders(false); // No rollover on manual refresh
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

  // Delete task
  const handleDelete = (reminder: TodaysReminder) => {
    const isOneTime = reminder.note.reminder_type === 'one-time';

    Alert.alert(
      'Delete Task',
      isOneTime
        ? 'This will permanently delete this task.'
        : 'This will delete this recurring task. Are you sure?',
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

  // Edit task (placeholder - would open a modal)
  const handleEdit = (_reminder: TodaysReminder) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Edit Task',
      'Edit functionality coming soon. You can delete and recreate the task for now.',
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
              : 'transparent',
            borderColor: item.isCompleted
              ? colors.semantic.success
              : isDark ? colors.neutral[400] : colors.neutral[300],
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
          {/* Type badge — only show when a time/schedule is actually set */}
          {!!item.timeDisplay && (
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
          )}

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

        {/* Quick Links from enrichment data */}
        {item.note.enrichment_data?.links && item.note.enrichment_data.links.length > 0 && (
          <View style={styles.linksContainer}>
            {item.note.enrichment_data.links.map((link, linkIndex) => (
              <AnimatedPressable
                key={linkIndex}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Linking.openURL(link.url).catch(err => console.error('Failed to open URL:', err));
                }}
                style={[styles.linkBadge, { backgroundColor: isDark ? colors.primary[900] + '30' : colors.primary[50] }]}
                hapticType="light"
              >
                <Ionicons
                  name={link.source === 'amazon' ? 'cart-outline' : 'link-outline'}
                  size={12}
                  color={colors.primary[500]}
                />
                <Text
                  style={[styles.linkText, { color: colors.primary[600] }]}
                  numberOfLines={1}
                >
                  {link.title}
                </Text>
                <Ionicons name="open-outline" size={10} color={themedColors.text.tertiary} />
              </AnimatedPressable>
            ))}
          </View>
        )}
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
  const renderSectionHeader = ({ section }: { section: SectionData }) => {
    const isDateSection = section.title !== 'Completed';

    return (
      <View style={[styles.sectionHeader, isDateSection && { marginTop: 0 }]}>
        <View style={styles.sectionTitleRow}>
          {/* Previous day button - only for date section */}
          {isDateSection && (
            <AnimatedPressable
              onPress={() => navigateDate('prev')}
              style={styles.dateNavButton}
              hapticType="light"
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={themedColors.text.secondary}
              />
            </AnimatedPressable>
          )}

          <Text style={[styles.sectionTitle, { color: themedColors.text.secondary }]}>
            {section.title}
          </Text>

          {section.data.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.primary[500] }]}>
              <Text style={styles.countText}>{section.data.length}</Text>
            </View>
          )}
        </View>

        {/* Date navigation - only for date section */}
        {isDateSection && (
          <View style={styles.dateNavRow}>
            {!isToday(selectedDate) && (
              <AnimatedPressable
                onPress={goToToday}
                style={[styles.todayButton, { backgroundColor: colors.primary[500] + '20' }]}
                hapticType="light"
              >
                <Text style={[styles.todayButtonText, { color: colors.primary[500] }]}>
                  Today
                </Text>
              </AnimatedPressable>
            )}
            <AnimatedPressable
              onPress={() => navigateDate('next')}
              style={styles.dateNavButton}
              hapticType="light"
            >
              <Text style={[styles.dateText, { color: themedColors.text.secondary }]}>
                {formatDateShort(selectedDate)}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={themedColors.text.secondary}
              />
            </AnimatedPressable>
          </View>
        )}
      </View>
    );
  };

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
        <Ionicons name="checkbox-outline" size={48} color={colors.primary[400]} />
      </View>
      <Text style={[styles.emptyTitle, { color: themedColors.text.primary }]}>
        No Tasks Yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: themedColors.text.tertiary }]}>
        Record a voice note with a task like:{'\n'}
        "Remind me every Monday to post on LinkedIn"{'\n'}
        or "Buy groceries tomorrow at 5 PM"
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
            Loading tasks...
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
    justifyContent: 'space-between',
    marginBottom: spacing[3],
    marginTop: spacing[4],
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  dateNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[1],
  },
  dateText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  todayButton: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  todayButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
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
  linksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  linkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    gap: 4,
    maxWidth: '100%',
  },
  linkText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    flexShrink: 1,
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
