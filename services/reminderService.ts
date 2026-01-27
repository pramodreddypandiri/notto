import * as Notifications from 'expo-notifications';
import { supabase } from '../config/supabase';
import notificationService from './notificationService';
import { ParsedReminder, RecurrencePattern } from './claudeService';

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
      if (reminder.reminderType === 'one-time' && reminder.eventDate) {
        // Schedule notifications for X days before the event
        const eventDate = new Date(reminder.eventDate);
        const daysBefore = reminder.reminderDaysBefore || 1;

        // Schedule notification for each day before (including the day itself)
        for (let i = daysBefore; i >= 0; i--) {
          const reminderDate = new Date(eventDate);
          reminderDate.setDate(reminderDate.getDate() - i);

          // Set time (default to 9am)
          const [hours, minutes] = (reminder.recurrenceTime || '09:00').split(':');
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
      } else if (reminder.reminderType === 'recurring') {
        // Schedule recurring notification
        const notifId = await this.scheduleRecurringNotification(
          transcript,
          reminder.recurrencePattern || 'weekly',
          reminder.recurrenceDay,
          reminder.recurrenceTime || '09:00',
          reminder.reminderSummary || transcript
        );

        if (notifId) {
          notificationIds.push(notifId);
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
            reminderText: reminder.parsed_data?.reminder?.reminderSummary ||
                         reminder.parsed_data?.summary ||
                         reminder.transcript,
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

      const eventDate = new Date(reminder.event_date);
      const daysBefore = reminder.reminder_days_before || 1;

      // Calculate reminder window
      const windowStart = new Date(eventDate);
      windowStart.setDate(windowStart.getDate() - daysBefore);
      windowStart.setHours(0, 0, 0, 0);

      const eventEnd = new Date(eventDate);
      eventEnd.setHours(23, 59, 59, 999);

      // Show if today is within the reminder window
      return today >= windowStart && today <= eventEnd;
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
  private getReminderTimeDisplay(reminder: ReminderNote): string {
    if (reminder.reminder_type === 'one-time' && reminder.event_date) {
      const eventDate = new Date(reminder.event_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const daysUntil = Math.ceil(
        (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntil === 0) return 'Today';
      if (daysUntil === 1) return 'Tomorrow';
      if (daysUntil < 0) return 'Past';
      return `In ${daysUntil} days`;
    }

    if (reminder.reminder_type === 'recurring') {
      const time = reminder.recurrence_time || '09:00';
      const [hours, minutes] = time.split(':').map(Number);
      const timeStr = new Date(0, 0, 0, hours, minutes).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: minutes > 0 ? '2-digit' : undefined,
        hour12: true,
      });

      switch (reminder.recurrence_pattern) {
        case 'daily':
          return `Daily at ${timeStr}`;
        case 'weekly':
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          return `Every ${days[reminder.recurrence_day || 0]} at ${timeStr}`;
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
              reminderText: reminder.parsed_data?.reminder?.reminderSummary ||
                           reminder.parsed_data?.summary ||
                           reminder.transcript,
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
