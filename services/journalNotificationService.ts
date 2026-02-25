/**
 * Journal Notification Service - On-device notification scheduling
 *
 * Handles:
 * - Scheduling 2x/week well-being reminders
 * - Pattern-based notification content
 * - Respecting user's wake/sleep times
 * - Matching user's preferred tone
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getUserProfile } from './profileService';
import { getStats, JournalStats } from './journalService';

const NOTIFICATION_SCHEDULE_KEY = '@journal_notification_schedule';
const NOTIFICATION_IDS_KEY = '@journal_notification_ids';

// Notification days (Monday = 1, Thursday = 4)
const NOTIFICATION_DAYS = [1, 4]; // Monday and Thursday

// Default times if user hasn't set preferences
const DEFAULT_NOTIFICATION_HOUR = 10; // 10 AM
const DEFAULT_WAKE_TIME = '07:00';
const DEFAULT_BED_TIME = '22:00';

// Notification messages by tone
const NOTIFICATION_MESSAGES: Record<string, { titles: string[]; bodies: Record<string, string[]> }> = {
  professional: {
    titles: [
      'Weekly Check-in',
      'Wellness Update',
      'Journal Reminder',
    ],
    bodies: {
      food: [
        'Log your meals to track your nutrition patterns.',
        'A quick food photo helps build your dietary profile.',
        'Document what you\'re eating for personalized insights.',
      ],
      selfie: [
        'A selfie helps track your wellness over time.',
        'Consider logging a self-check photo today.',
        'Regular selfies help identify health patterns.',
      ],
      general: [
        'Take a moment to capture something meaningful.',
        'Your photo journal awaits new entries.',
        'A quick photo can provide valuable wellness insights.',
      ],
    },
  },
  friendly: {
    titles: [
      'Hey there!',
      'Quick check-in',
      'How\'s it going?',
    ],
    bodies: {
      food: [
        'What delicious thing are you eating today? Share a pic!',
        'Haven\'t seen your meals lately - eating well?',
        'Drop a food photo when you get a chance!',
      ],
      selfie: [
        'Time for a selfie! Let\'s see how you\'re doing.',
        'Hey! How about a quick selfie to track your glow?',
        'Miss seeing you! Share a selfie when you can.',
      ],
      general: [
        'Seen anything cool lately? Share it with your journal!',
        'What made you smile today? Capture the moment!',
        'Your journal misses you! Add something fun.',
      ],
    },
  },
  casual: {
    titles: [
      'Yo!',
      'Sup',
      'Hey',
    ],
    bodies: {
      food: [
        'What\'s for lunch? Snap a pic!',
        'Food check - what are we eating?',
        'Drop that food pic when you can',
      ],
      selfie: [
        'Selfie time! How\'s the skin looking?',
        'Been a minute - drop a selfie!',
        'Quick selfie check?',
      ],
      general: [
        'See anything cute? Share it!',
        'Catch any cool moments lately?',
        'Journal\'s looking empty - add something!',
      ],
    },
  },
  motivational: {
    titles: [
      'You\'ve Got This!',
      'Keep Going Strong!',
      'Your Journey Continues!',
    ],
    bodies: {
      food: [
        'Every meal is a chance to fuel your best self! Log it!',
        'Nourish your body, nourish your soul. Share what you\'re eating!',
        'Great nutrition = great energy. Track your meals!',
      ],
      selfie: [
        'Track your progress with a selfie - you\'re doing amazing!',
        'Capture your journey! Every selfie shows growth.',
        'Document the incredible person you\'re becoming!',
      ],
      general: [
        'Find joy in the little things and capture them!',
        'Every photo is a step in your wellness journey!',
        'Keep building that positive momentum - share something!',
      ],
    },
  },
};

interface ScheduledNotification {
  id: string;
  scheduledFor: string; // ISO string
  type: 'food' | 'selfie' | 'general';
}

/**
 * Get appropriate notification time based on user preferences
 */
async function getNotificationTime(): Promise<{ hour: number; minute: number }> {
  try {
    const profile = await getUserProfile();

    if (!profile) {
      return { hour: DEFAULT_NOTIFICATION_HOUR, minute: 0 };
    }

    const wakeTime = profile.wake_up_time || DEFAULT_WAKE_TIME;
    const bedTime = profile.bed_time || DEFAULT_BED_TIME;

    // Parse times
    const [wakeHour] = wakeTime.split(':').map(Number);
    const [bedHour] = bedTime.split(':').map(Number);

    // Schedule notification 2-3 hours after wake time, but before 6 PM
    let notificationHour = wakeHour + 2;

    // Make sure it's within reasonable hours (between wake time + 1hr and 6 PM or bed time - 2hr)
    const latestHour = Math.min(18, bedHour - 2);
    if (notificationHour > latestHour) {
      notificationHour = latestHour;
    }
    if (notificationHour < wakeHour + 1) {
      notificationHour = wakeHour + 1;
    }

    return { hour: notificationHour, minute: 0 };
  } catch (error) {
    console.error('Failed to get notification time:', error);
    return { hour: DEFAULT_NOTIFICATION_HOUR, minute: 0 };
  }
}

/**
 * Determine what type of notification to send based on patterns
 */
async function determineNotificationType(stats: JournalStats): Promise<'food' | 'selfie' | 'general'> {
  const now = new Date();

  // Check days since last food photo
  const daysSinceFood = stats.lastFoodDate
    ? Math.floor((now.getTime() - new Date(stats.lastFoodDate).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Check days since last selfie
  const daysSinceSelfie = stats.lastSelfieDate
    ? Math.floor((now.getTime() - new Date(stats.lastSelfieDate).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Prioritize based on what's been missing longest
  if (daysSinceFood > 3 && daysSinceFood >= daysSinceSelfie) {
    return 'food';
  }

  if (daysSinceSelfie > 5) {
    return 'selfie';
  }

  // Default to general if everything is recent
  return 'general';
}

/**
 * Get notification content based on type and user's tone preference
 */
async function getNotificationContent(type: 'food' | 'selfie' | 'general'): Promise<{ title: string; body: string }> {
  try {
    const profile = await getUserProfile();
    const tone = profile?.tone || 'friendly';

    const messages = NOTIFICATION_MESSAGES[tone] || NOTIFICATION_MESSAGES.friendly;

    // Random selection for variety
    const titleIndex = Math.floor(Math.random() * messages.titles.length);
    const bodyIndex = Math.floor(Math.random() * messages.bodies[type].length);

    return {
      title: messages.titles[titleIndex],
      body: messages.bodies[type][bodyIndex],
    };
  } catch (error) {
    console.error('Failed to get notification content:', error);
    return {
      title: 'Photo Journal',
      body: 'Time to add something to your journal!',
    };
  }
}

/**
 * Calculate next occurrence of a specific day of week
 */
function getNextDayOccurrence(targetDay: number): Date {
  const now = new Date();
  const currentDay = now.getDay();

  // Calculate days until target day
  let daysUntil = targetDay - currentDay;
  if (daysUntil <= 0) {
    daysUntil += 7; // Move to next week
  }

  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysUntil);

  return targetDate;
}

/**
 * Schedule weekly notifications (2x per week)
 */
export async function scheduleWeeklyNotifications(): Promise<void> {
  try {
    // Cancel existing notifications first
    await cancelAllJournalNotifications();

    const { hour, minute } = await getNotificationTime();
    const stats = await getStats();
    const notificationType = await determineNotificationType(stats);
    const scheduledNotifications: ScheduledNotification[] = [];

    for (const day of NOTIFICATION_DAYS) {
      const nextOccurrence = getNextDayOccurrence(day);
      nextOccurrence.setHours(hour, minute, 0, 0);

      // Skip if in the past
      if (nextOccurrence <= new Date()) {
        nextOccurrence.setDate(nextOccurrence.getDate() + 7);
      }

      const { title, body } = await getNotificationContent(notificationType);

      // Calculate seconds until notification
      const secondsUntil = Math.floor((nextOccurrence.getTime() - Date.now()) / 1000);

      if (secondsUntil > 0) {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: true,
            data: { type: 'journal_reminder', notificationType, targetTab: '/(tabs)/journal' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: secondsUntil,
          },
        });

        scheduledNotifications.push({
          id: notificationId,
          scheduledFor: nextOccurrence.toISOString(),
          type: notificationType,
        });

        console.log(`[JournalNotification] Scheduled for ${nextOccurrence.toLocaleString()}`);
      }
    }

    // Save scheduled notification IDs
    await AsyncStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify(scheduledNotifications));
    await AsyncStorage.setItem(NOTIFICATION_SCHEDULE_KEY, new Date().toISOString());
  } catch (error) {
    console.error('Failed to schedule weekly notifications:', error);
  }
}

/**
 * Cancel all journal notifications
 */
export async function cancelAllJournalNotifications(): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(NOTIFICATION_IDS_KEY);
    if (data) {
      const notifications: ScheduledNotification[] = JSON.parse(data);
      for (const notification of notifications) {
        await Notifications.cancelScheduledNotificationAsync(notification.id);
      }
    }
    await AsyncStorage.removeItem(NOTIFICATION_IDS_KEY);
  } catch (error) {
    console.error('Failed to cancel journal notifications:', error);
  }
}

/**
 * Reschedule notifications (call this when app launches or when photos are added)
 */
export async function rescheduleNotificationsIfNeeded(): Promise<void> {
  try {
    const lastSchedule = await AsyncStorage.getItem(NOTIFICATION_SCHEDULE_KEY);

    if (!lastSchedule) {
      // Never scheduled, do it now
      await scheduleWeeklyNotifications();
      return;
    }

    const lastScheduleDate = new Date(lastSchedule);
    const now = new Date();
    const daysSinceLastSchedule = Math.floor(
      (now.getTime() - lastScheduleDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Reschedule if it's been more than 3 days
    if (daysSinceLastSchedule >= 3) {
      await scheduleWeeklyNotifications();
    }
  } catch (error) {
    console.error('Failed to reschedule notifications:', error);
  }
}

/**
 * Get scheduled notifications info
 */
export async function getScheduledNotifications(): Promise<ScheduledNotification[]> {
  try {
    const data = await AsyncStorage.getItem(NOTIFICATION_IDS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get scheduled notifications:', error);
    return [];
  }
}

/**
 * Enable/disable journal notifications
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await scheduleWeeklyNotifications();
  } else {
    await cancelAllJournalNotifications();
  }
}

export default {
  scheduleWeeklyNotifications,
  cancelAllJournalNotifications,
  rescheduleNotificationsIfNeeded,
  getScheduledNotifications,
  setNotificationsEnabled,
};
