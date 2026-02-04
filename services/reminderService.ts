import * as Notifications from 'expo-notifications';
import { supabase } from '../config/supabase';
import notificationService from './notificationService';
import { ParsedReminder, RecurrencePattern } from './claudeService';

/** Strip leading "Reminder:", "Remind me to", etc. from display text */
const cleanReminderPrefix = (text: string): string => {
  return text
    .replace(/^reminder[:\s]+/i, '')
    .replace(/^remind me (to )?(that )?/i, '')
    .replace(/^don'?t forget (to )?(that )?/i, '')
    .trim();
};

export interface ReminderNote {
  id: string;
  user_id: string;
  transcript: string;
  parsed_data: any;
  is_reminder: boolean;
  reminder_type: 'one-time' | 'recurring';
  event_date: string | null;
  event_location: string | null;
  reminder_days_before: number;
  recurrence_pattern: RecurrencePattern | null;
  recurrence_day: number | null;
  recurrence_time: string;
  notification_ids: string[] | null;
  reminder_active: boolean;
  last_reminded_at: string | null;
  reminder_completed_at: string | null;
  created_at: string;
}

export interface TodaysReminder {
  note: ReminderNote;
  isCompleted: boolean; // for today
  reminderText: string;
  timeDisplay: string;
}

class ReminderService {
  /**
   * Schedule notifications for a reminder note
   */
  async scheduleReminder(
    noteId: string,
    transcript: string,
    reminder: ParsedReminder
  ): Promise<string[]> {
    const notificationIds: string[] = [];

    try {
      // Determine all times to schedule for
      const times = reminder.additionalTimes && reminder.additionalTimes.length > 0
        ? reminder.additionalTimes
        : [reminder.recurrenceTime || '09:00'];

      if (reminder.reminderType === 'one-time' && reminder.eventDate) {
        // Schedule notifications for X days before the event
        // Parse date as local time (not UTC) to avoid timezone shift
        const eventDate = this.parseLocalDate(reminder.eventDate);
        const daysBefore = reminder.reminderDaysBefore || 1;

        // Schedule notification for each day before (including the day itself)
        for (let i = daysBefore; i >= 0; i--) {
          // Schedule for each time
          for (const time of times) {
            const reminderDate = new Date(eventDate);
            reminderDate.setDate(reminderDate.getDate() - i);

            const [hours, minutes] = time.split(':');
            reminderDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            // Only schedule if in the future
            if (reminderDate > new Date()) {
              const daysText = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `In ${i} days`;
              const title = i === 0 ? '📅 Event Today!' : `⏰ Upcoming Event (${daysText})`;

              const notifId = await notificationService.scheduleNotification(
                title,
                reminder.reminderSummary || transcript,
                reminderDate
              );

              if (notifId) {
                notificationIds.push(notifId);
              }
            }
          }
        }
      } else if (reminder.reminderType === 'recurring') {
        // Schedule recurring notification for each time
        for (const time of times) {
          const notifId = await this.scheduleRecurringNotification(
            transcript,
            reminder.recurrencePattern || 'weekly',
            reminder.recurrenceDay,
            time,
            reminder.reminderSummary || transcript
          );

          if (notifId) {
            notificationIds.push(notifId);
          }
        }
      }

      // Update the note with notification IDs
      if (notificationIds.length > 0) {
        await supabase
          .from('notes')
          .update({ notification_ids: notificationIds })
          .eq('id', noteId);
      }

      return notificationIds;
    } catch (error) {
      console.error('[ReminderService] Failed to schedule reminder:', error);
      return [];
    }
  }

  /**
   * Schedule a recurring notification
   */
  private async scheduleRecurringNotification(
    transcript: string,
    pattern: RecurrencePattern,
    day: number | undefined,
    time: string,
    summary: string
  ): Promise<string | null> {
    try {
      const [hours, minutes] = time.split(':').map(Number);

      let trigger: Notifications.NotificationTriggerInput;

      switch (pattern) {
        case 'daily':
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: hours,
            minute: minutes,
          };
          break;

        case 'weekly':
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: day !== undefined ? day + 1 : 2, // expo uses 1-7 (Sunday=1), we use 0-6
            hour: hours,
            minute: minutes,
          };
          break;

        case 'monthly':
          // Monthly triggers not directly supported, use workaround with time interval
          // For now, schedule for the next occurrence
          const nextDate = this.getNextMonthlyDate(day || 1, hours, minutes);
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: nextDate,
          };
          break;

        case 'yearly':
          // Similar workaround for yearly
          const nextYearDate = this.getNextYearlyDate(day || 1, hours, minutes);
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: nextYearDate,
          };
          break;

        default:
          return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 Reminder',
          body: summary,
          sound: true,
          data: { type: 'recurring-reminder', transcript },
        },
        trigger,
      });

      console.log('[ReminderService] Scheduled recurring notification:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('[ReminderService] Failed to schedule recurring notification:', error);
      return null;
    }
  }

  /**
   * Get next monthly occurrence date
   */
  private getNextMonthlyDate(dayOfMonth: number, hours: number, minutes: number): Date {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, hours, minutes, 0, 0);

    if (target <= now) {
      target.setMonth(target.getMonth() + 1);
    }

    return target;
  }

  /**
   * Get next yearly occurrence date
   */
  private getNextYearlyDate(dayOfYear: number, hours: number, minutes: number): Date {
    const now = new Date();
    const target = new Date(now.getFullYear(), 0, dayOfYear, hours, minutes, 0, 0);

    if (target <= now) {
      target.setFullYear(target.getFullYear() + 1);
    }

    return target;
  }

  /**
   * Parse a date string (e.g. "2025-02-18") as local time, not UTC.
   * new Date("2025-02-18") parses as UTC midnight, which shifts to the
   * previous day in timezones behind UTC (e.g. US timezones).
   */
  private parseLocalDate(dateStr: string): Date {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return new Date(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1, // month is 0-indexed
        parseInt(parts[2]),
        0, 0, 0, 0
      );
    }
    // Fallback: try native parsing but fix timezone
    const d = new Date(dateStr);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  }

  /**
   * Get today's reminders (to show and already shown)
   */
  async getTodaysReminders(): Promise<TodaysReminder[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayStr = today.toISOString().split('T')[0];

      // Get all active reminders
      const { data: reminders, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_reminder', true)
        .eq('reminder_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get today's completions
      const { data: completions } = await supabase
        .from('reminder_completions')
        .select('note_id')
        .eq('user_id', user.id)
        .eq('completed_date', todayStr);

      const completedNoteIds = new Set((completions || []).map(c => c.note_id));

      // Filter reminders for today
      const todaysReminders: TodaysReminder[] = [];

      for (const reminder of (reminders || [])) {
        const shouldShowToday = this.shouldShowReminderToday(reminder, today);

        if (shouldShowToday) {
          todaysReminders.push({
            note: reminder as ReminderNote,
            isCompleted: completedNoteIds.has(reminder.id),
            reminderText: cleanReminderPrefix(
              reminder.parsed_data?.reminder?.reminderSummary ||
              reminder.parsed_data?.summary ||
              reminder.transcript
            ),
            timeDisplay: this.getReminderTimeDisplay(reminder),
          });
        }
      }

      // Sort: incomplete first, then by time
      return todaysReminders.sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) {
          return a.isCompleted ? 1 : -1;
        }
        return 0;
      });
    } catch (error) {
      console.error('[ReminderService] Failed to get today\'s reminders:', error);
      return [];
    }
  }

  /**
   * Check if a reminder should show today
   */
  private shouldShowReminderToday(reminder: ReminderNote, today: Date): boolean {
    const todayDay = today.getDay(); // 0 = Sunday

    if (reminder.reminder_type === 'one-time') {
      if (!reminder.event_date) return false;

      const eventDate = this.parseLocalDate(reminder.event_date);
      eventDate.setHours(0, 0, 0, 0);

      // Only show on the actual event day
      return today.getTime() === eventDate.getTime();
    }

    if (reminder.reminder_type === 'recurring') {
      switch (reminder.recurrence_pattern) {
        case 'daily':
          return true;
        case 'weekly':
          return reminder.recurrence_day === todayDay;
        case 'monthly':
          return reminder.recurrence_day === today.getDate();
        case 'yearly':
          // Simplified: check if it's the right day of year
          const dayOfYear = Math.floor(
            (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
          );
          return reminder.recurrence_day === dayOfYear;
        default:
          return false;
      }
    }

    return false;
  }

  /**
   * Get display text for reminder time
   */
  private formatTimeStr(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(0, 0, 0, hours, minutes).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: minutes > 0 ? '2-digit' : undefined,
      hour12: true,
    });
  }

  private getTimesDisplay(reminder: ReminderNote): string {
    // Check for additional times in parsed_data
    const additionalTimes = reminder.parsed_data?.reminder?.additionalTimes as string[] | undefined;
    if (additionalTimes && additionalTimes.length > 1) {
      return additionalTimes.map(t => this.formatTimeStr(t)).join(' & ');
    }
    const time = reminder.recurrence_time || '09:00';
    return this.formatTimeStr(time);
  }

  private getReminderTimeDisplay(reminder: ReminderNote): string {
    if (reminder.reminder_type === 'one-time' && reminder.event_date) {
      const eventDate = this.parseLocalDate(reminder.event_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      eventDate.setHours(0, 0, 0, 0);

      const daysUntil = Math.round(
        (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      const timePart = this.getTimesDisplay(reminder);
      if (daysUntil === 0) return `Today at ${timePart}`;
      if (daysUntil === 1) return `Tomorrow at ${timePart}`;
      if (daysUntil < 0) return 'Past due';
      const datePart = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${datePart} at ${timePart}`;
    }

    if (reminder.reminder_type === 'recurring') {
      const timePart = this.getTimesDisplay(reminder);

      switch (reminder.recurrence_pattern) {
        case 'daily':
          return `Daily at ${timePart}`;
        case 'weekly':
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          return `Every ${days[reminder.recurrence_day || 0]} at ${timePart}`;
        case 'monthly':
          return `Monthly on the ${reminder.recurrence_day}${this.getOrdinalSuffix(reminder.recurrence_day || 1)}`;
        default:
          return 'Recurring';
      }
    }

    return '';
  }

  /**
   * Get ordinal suffix (1st, 2nd, 3rd, etc.)
   */
  private getOrdinalSuffix(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  /**
   * Mark a reminder as completed for today
   */
  async markReminderDone(noteId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const todayStr = new Date().toISOString().split('T')[0];

      // Get the note to check if it's one-time or recurring
      const { data: note } = await supabase
        .from('notes')
        .select('reminder_type')
        .eq('id', noteId)
        .single();

      if (note?.reminder_type === 'one-time') {
        // For one-time reminders, mark as completed permanently
        await supabase
          .from('notes')
          .update({
            reminder_completed_at: new Date().toISOString(),
            reminder_active: false
          })
          .eq('id', noteId);
      } else {
        // For recurring reminders, add to completions table
        await supabase
          .from('reminder_completions')
          .upsert({
            note_id: noteId,
            user_id: user.id,
            completed_date: todayStr,
          });
      }

      // Update last reminded timestamp
      await supabase
        .from('notes')
        .update({ last_reminded_at: new Date().toISOString() })
        .eq('id', noteId);

      return true;
    } catch (error) {
      console.error('[ReminderService] Failed to mark reminder done:', error);
      return false;
    }
  }

  /**
   * Undo marking a reminder as done (for today)
   */
  async undoReminderDone(noteId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const todayStr = new Date().toISOString().split('T')[0];

      // Get the note
      const { data: note } = await supabase
        .from('notes')
        .select('reminder_type')
        .eq('id', noteId)
        .single();

      if (note?.reminder_type === 'one-time') {
        // Reactivate one-time reminder
        await supabase
          .from('notes')
          .update({
            reminder_completed_at: null,
            reminder_active: true
          })
          .eq('id', noteId);
      } else {
        // Remove from completions table
        await supabase
          .from('reminder_completions')
          .delete()
          .eq('note_id', noteId)
          .eq('user_id', user.id)
          .eq('completed_date', todayStr);
      }

      return true;
    } catch (error) {
      console.error('[ReminderService] Failed to undo reminder:', error);
      return false;
    }
  }

  /**
   * Delete a reminder permanently
   */
  async deleteReminder(noteId: string): Promise<boolean> {
    try {
      // First cancel any scheduled notifications
      const { data: note } = await supabase
        .from('notes')
        .select('notification_ids')
        .eq('id', noteId)
        .single();

      if (note?.notification_ids) {
        for (const notifId of note.notification_ids) {
          await notificationService.cancelNotification(notifId);
        }
      }

      // Delete the note
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('[ReminderService] Failed to delete reminder:', error);
      return false;
    }
  }

  /**
   * Update reminder (e.g., change event date)
   */
  async updateReminder(
    noteId: string,
    updates: Partial<{
      event_date: string;
      reminder_days_before: number;
      recurrence_time: string;
      reminder_active: boolean;
    }>
  ): Promise<boolean> {
    try {
      // Cancel existing notifications
      const { data: note } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single();

      if (note?.notification_ids) {
        for (const notifId of note.notification_ids) {
          await notificationService.cancelNotification(notifId);
        }
      }

      // Update the note
      const { error } = await supabase
        .from('notes')
        .update({
          ...updates,
          notification_ids: null, // Clear old notification IDs
        })
        .eq('id', noteId);

      if (error) throw error;

      // Reschedule if still active
      if (updates.reminder_active !== false && note) {
        const reminder: ParsedReminder = {
          isReminder: true,
          reminderType: note.reminder_type,
          eventDate: updates.event_date || note.event_date,
          reminderDaysBefore: updates.reminder_days_before ?? note.reminder_days_before,
          recurrencePattern: note.recurrence_pattern,
          recurrenceDay: note.recurrence_day,
          recurrenceTime: updates.recurrence_time || note.recurrence_time,
          reminderSummary: note.parsed_data?.reminder?.reminderSummary || note.parsed_data?.summary,
        };

        await this.scheduleReminder(noteId, note.transcript, reminder);
      }

      return true;
    } catch (error) {
      console.error('[ReminderService] Failed to update reminder:', error);
      return false;
    }
  }

  /**
   * Pause/Resume a recurring reminder
   */
  async toggleReminderActive(noteId: string, active: boolean): Promise<boolean> {
    return this.updateReminder(noteId, { reminder_active: active });
  }

  /**
   * Get all reminders (for settings/management)
   */
  async getAllReminders(): Promise<ReminderNote[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_reminder', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []) as ReminderNote[];
    } catch (error) {
      console.error('[ReminderService] Failed to get all reminders:', error);
      return [];
    }
  }

  /**
   * Cancel all scheduled notifications and re-schedule only active reminders.
   * Call this on app launch to clean up stale/duplicate notifications.
   */
  async rescheduleAllReminders(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Cancel ALL existing scheduled notifications to clear stale ones
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[ReminderService] Cleared all scheduled notifications');

      // Fetch all active reminders from the database
      const { data: reminders, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_reminder', true)
        .eq('reminder_active', true);

      if (error) throw error;

      // Re-schedule each active reminder
      for (const reminder of (reminders || [])) {
        const parsedReminder = reminder.parsed_data?.reminder;
        if (!parsedReminder) continue;

        const scheduledIds = await this.scheduleReminder(
          reminder.id,
          reminder.transcript,
          {
            isReminder: true,
            reminderType: reminder.reminder_type,
            eventDate: reminder.event_date,
            reminderDaysBefore: reminder.reminder_days_before,
            recurrencePattern: reminder.recurrence_pattern,
            recurrenceDay: reminder.recurrence_day,
            recurrenceTime: reminder.recurrence_time,
            reminderSummary: parsedReminder.reminderSummary || reminder.parsed_data?.summary,
          } as ParsedReminder
        );

        console.log(`[ReminderService] Re-scheduled ${scheduledIds.length} notifications for note ${reminder.id}`);
      }

      console.log(`[ReminderService] Re-scheduled all active reminders (${(reminders || []).length} total)`);
    } catch (error) {
      console.error('[ReminderService] Failed to reschedule reminders:', error);
    }
  }

  /**
   * Get upcoming reminders (for the next 7 days)
   */
  async getUpcomingReminders(days: number = 7): Promise<TodaysReminder[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const reminders = await this.getAllReminders();
      const upcoming: TodaysReminder[] = [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < days; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() + i);

        for (const reminder of reminders) {
          if (!reminder.reminder_active) continue;

          if (this.shouldShowReminderToday(reminder, checkDate)) {
            upcoming.push({
              note: reminder,
              isCompleted: false,
              reminderText: cleanReminderPrefix(
                reminder.parsed_data?.reminder?.reminderSummary ||
                reminder.parsed_data?.summary ||
                reminder.transcript
              ),
              timeDisplay: this.getReminderTimeDisplay(reminder),
            });
          }
        }
      }

      return upcoming;
    } catch (error) {
      console.error('[ReminderService] Failed to get upcoming reminders:', error);
      return [];
    }
  }
}

export default new ReminderService();
