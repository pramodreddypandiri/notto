import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications should be handled when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface ReminderInfo {
  date: Date;
  displayText: string;
  isValid: boolean;
}

export interface TimeExtractionResult {
  hasTime: boolean;
  timeString: string | null;
  reminderInfo: ReminderInfo | null;
}

class NotificationService {
  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Notification permission not granted');
        return false;
      }

      // For Android, create a notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366f1',
        });
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Check if a date is valid
   */
  private isValidDate(date: Date): boolean {
    return date instanceof Date && !isNaN(date.getTime()) && date.getTime() > Date.now();
  }

  /**
   * Schedule a notification for a specific date/time
   */
  async scheduleNotification(
    title: string,
    body: string,
    scheduledDate: Date
  ): Promise<string | null> {
    try {
      // Validate the date
      if (!this.isValidDate(scheduledDate)) {
        console.warn('Invalid or past date for notification:', scheduledDate);
        return null;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Notification permission not granted');
      }

      // Calculate seconds until the scheduled date
      const secondsUntil = Math.max(1, Math.floor((scheduledDate.getTime() - Date.now()) / 1000));

      console.log('=== SCHEDULING NOTIFICATION ===');
      console.log('Current time:', new Date().toLocaleString());
      console.log('Scheduled for:', scheduledDate.toLocaleString());
      console.log('Scheduled ISO:', scheduledDate.toISOString());
      console.log('Seconds until:', secondsUntil);
      console.log('Minutes until:', Math.round(secondsUntil / 60));
      console.log('Platform:', Platform.OS);

      // Use time interval trigger for both platforms (more reliable in Expo Go)
      const trigger: Notifications.NotificationTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
        ...(Platform.OS === 'android' && { channelId: 'reminders' }),
      };

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: { type: 'reminder' },
        },
        trigger,
      });

      console.log('Notification scheduled:', notificationId, 'for', scheduledDate.toLocaleString());

      // Debug: Log all scheduled notifications to verify
      await this.debugLogScheduledNotifications();

      return notificationId;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return null;
    }
  }

  /**
   * Schedule a reminder from note text
   * Parses natural language time (e.g., "Thursday at 9am")
   * Returns notification ID and reminder info
   */
  async scheduleReminderFromNote(
    noteText: string,
    reminderTime?: string
  ): Promise<{ notificationId: string | null; reminderInfo: ReminderInfo }> {
    try {
      const reminderInfo = reminderTime
        ? this.parseReminderTime(reminderTime)
        : { date: new Date(Date.now() + 60 * 60 * 1000), displayText: 'In 1 hour', isValid: true };

      const notificationId = await this.scheduleNotification(
        '⏰ Reminder',
        noteText,
        reminderInfo.date
      );

      return { notificationId, reminderInfo };
    } catch (error) {
      console.error('Failed to schedule reminder from note:', error);
      return {
        notificationId: null,
        reminderInfo: { date: new Date(), displayText: '', isValid: false }
      };
    }
  }

  /**
   * Schedule a reminder for a specific date
   */
  async scheduleReminderForDate(
    noteText: string,
    noteId: string,
    scheduledDate: Date
  ): Promise<string | null> {
    try {
      const notificationId = await this.scheduleNotification(
        '⏰ Reminder',
        noteText,
        scheduledDate
      );

      return notificationId;
    } catch (error) {
      console.error('Failed to schedule reminder:', error);
      return null;
    }
  }

  /**
   * Extract time/date information from natural language text (e.g., voice note transcript)
   * This is the PRIMARY method for auto-detecting reminders without AI
   */
  extractTimeFromText(text: string): TimeExtractionResult {
    const input = text.toLowerCase();

    // Patterns to detect time-related phrases (ordered by specificity - more specific first)
    const timePatterns = [
      // ===== RELATIVE TIME (minutes/hours) =====
      // "in X minutes", "after X mins", "X minutes from now"
      /\b(in|after)\s+(\d+)\s*(minutes?|mins?|hours?|hrs?)\b/i,
      /\b(\d+)\s*(minutes?|mins?|hours?|hrs?)\s+from\s+now\b/i,
      // "in an hour", "after an hour", "in a minute"
      /\b(in|after)\s+(an?|one)\s*(hour|minute)\b/i,
      // "in half an hour", "after half an hour"
      /\b(in|after)\s+(half\s+an?\s+hour|30\s+minutes?)\b/i,
      // "within X minutes"
      /\bwithin\s+(\d+)\s*(minutes?|mins?|hours?|hrs?)\b/i,
      // "for X minutes" / "set timer for X mins"
      /\b(for|set\s+timer\s+for)\s+(\d+)\s*(minutes?|mins?|hours?|hrs?)\b/i,

      // ===== SPECIFIC TIMES =====
      // "at 3pm", "at 3:30 pm", "by 5pm", "around 2pm", "for 3pm"
      /\b(at|by|around|for)\s+(\d{1,2})(:\d{2})?\s*(am|pm)?\b/i,
      // "@ 3pm", "@3:30"
      /\b@\s*(\d{1,2})(:\d{2})?\s*(am|pm)?\b/i,
      // "3pm", "3:30pm" (standalone)
      /\b(\d{1,2})(:\d{2})?\s*(am|pm)\b/i,
      // "3 o'clock", "3 o clock"
      /\b(\d{1,2})\s*o['\s]?clock\b/i,
      // "noon", "midnight"
      /\b(noon|midday|midnight)\b/i,
      // "quarter past 3", "half past 3", "quarter to 4"
      /\b(quarter\s+past|half\s+past|quarter\s+to)\s+(\d{1,2})\b/i,

      // ===== DAY REFERENCES =====
      // "today", "tonight", "tomorrow", "day after tomorrow"
      /\bday\s+after\s+tomorrow\b/i,
      /\b(today|tonight|tomorrow|tmrw|tmw|2morrow)\b/i,
      // "this evening", "this morning", "this afternoon"
      /\bthis\s+(evening|morning|afternoon|night)\b/i,
      // "later today", "later tonight"
      /\blater\s+(today|tonight)\b/i,
      // "this weekend", "next week", "next month"
      /\b(this\s+weekend|next\s+week|next\s+month)\b/i,

      // ===== DAY NAMES =====
      // "next Monday", "this Monday", "coming Monday", "following Monday"
      /\b(next|this|coming|following)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      // "Monday", "on Monday"
      /\b(on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      // Short forms: "Mon", "Tue", "on Fri"
      /\b(on\s+)?(mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/i,

      // ===== RELATIVE DAYS =====
      // "in X days", "after X days", "X days from now"
      /\b(in|after)\s+(\d+)\s*days?\b/i,
      /\b(\d+)\s*days?\s+from\s+now\b/i,
      // "in a week", "in a month"
      /\b(in|after)\s+(a|one)\s+(week|month)\b/i,

      // ===== TIME OF DAY =====
      // "tomorrow morning", "tomorrow evening", "tomorrow night"
      /\b(tomorrow|tmrw)\s+(morning|afternoon|evening|night)\b/i,
      // "morning", "afternoon", "evening", "night" (standalone)
      /\b(early\s+)?(morning|afternoon|evening|night)\b/i,
      /\b(late\s+)?(morning|afternoon|evening|night)\b/i,

      // ===== DATES =====
      // "on the 15th", "the 15th"
      /\b(on\s+)?(the\s+)?(\d{1,2})(st|nd|rd|th)\b/i,
      // "January 5th", "on March 15"
      /\b(on\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?\b/i,
      // Short month names: "Jan 5", "Mar 15th"
      /\b(on\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(st|nd|rd|th)?\b/i,

      // ===== DEADLINE PHRASES =====
      // "by end of day", "by EOD", "end of day"
      /\b(by\s+)?(end\s+of\s+(day|week|month)|eod|eow|eom)\b/i,
      // "before", "until", "due"
      /\b(before|until|due)\s+/i,
    ];

    // Find matching time pattern
    let matchedTimeString: string | null = null;

    for (const pattern of timePatterns) {
      const match = input.match(pattern);
      if (match) {
        matchedTimeString = match[0];
        break;
      }
    }

    if (!matchedTimeString) {
      return {
        hasTime: false,
        timeString: null,
        reminderInfo: null,
      };
    }

    // Parse the extracted time string
    const reminderInfo = this.parseReminderTime(matchedTimeString);

    return {
      hasTime: true,
      timeString: matchedTimeString,
      reminderInfo,
    };
  }

  /**
   * Parse reminder time string to Date with comprehensive natural language support
   */
  parseReminderTime(timeString: string): ReminderInfo {
    const now = new Date();
    const input = timeString.toLowerCase().trim();
    let targetDate = new Date(now);
    let displayText = '';
    let isValid = true;

    // Extract time if present (e.g., "3pm", "3:30 PM", "15:00", "noon", "quarter past 3")
    const extractTime = (str: string): { hours: number; minutes: number } | null => {
      // Check for special times first
      if (str.includes('noon') || str.includes('midday')) {
        return { hours: 12, minutes: 0 };
      }
      if (str.includes('midnight')) {
        return { hours: 0, minutes: 0 };
      }

      // Check for "quarter past X", "half past X", "quarter to X"
      const quarterPastMatch = str.match(/quarter\s+past\s+(\d{1,2})/i);
      if (quarterPastMatch) {
        return { hours: parseInt(quarterPastMatch[1]), minutes: 15 };
      }
      const halfPastMatch = str.match(/half\s+past\s+(\d{1,2})/i);
      if (halfPastMatch) {
        return { hours: parseInt(halfPastMatch[1]), minutes: 30 };
      }
      const quarterToMatch = str.match(/quarter\s+to\s+(\d{1,2})/i);
      if (quarterToMatch) {
        return { hours: parseInt(quarterToMatch[1]) - 1, minutes: 45 };
      }

      // Check for "X o'clock"
      const oclockMatch = str.match(/(\d{1,2})\s*o['\s]?clock/i);
      if (oclockMatch) {
        let hours = parseInt(oclockMatch[1]);
        // Assume PM for afternoon hours if no am/pm specified
        if (hours < 12 && hours >= 1 && hours <= 6) {
          hours += 12; // Default 1-6 o'clock to PM
        }
        return { hours, minutes: 0 };
      }

      // Match patterns like "3pm", "3:30pm", "3 pm", "15:00", "@3pm"
      const timePatterns = [
        /(\d{1,2}):(\d{2})\s*(am|pm)/i,    // 3:30pm, 3:30 pm
        /(\d{1,2})\s*(am|pm)/i,             // 3pm, 3 pm
        /@\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i, // @3:30pm
        /@\s*(\d{1,2})\s*(am|pm)?/i,         // @3pm
        /(\d{1,2}):(\d{2})/,                // 15:00, 3:30
      ];

      for (const pattern of timePatterns) {
        const match = str.match(pattern);
        if (match) {
          let hours = parseInt(match[1]);
          const minutes = match[2] && !isNaN(parseInt(match[2])) ? parseInt(match[2]) : 0;
          const period = (match[3] || match[2])?.toLowerCase();

          if (period === 'pm' && hours < 12) hours += 12;
          if (period === 'am' && hours === 12) hours = 0;

          return { hours, minutes };
        }
      }
      return null;
    };

    // Check for time of day defaults
    const getTimeOfDayDefaults = (str: string): { hours: number; minutes: number } | null => {
      if (str.includes('early morning')) return { hours: 6, minutes: 0 };
      if (str.includes('late morning')) return { hours: 11, minutes: 0 };
      if (str.includes('morning')) return { hours: 9, minutes: 0 };
      if (str.includes('early afternoon')) return { hours: 13, minutes: 0 };
      if (str.includes('late afternoon')) return { hours: 17, minutes: 0 };
      if (str.includes('afternoon')) return { hours: 14, minutes: 0 };
      if (str.includes('early evening')) return { hours: 17, minutes: 0 };
      if (str.includes('late evening')) return { hours: 21, minutes: 0 };
      if (str.includes('evening')) return { hours: 18, minutes: 0 };
      if (str.includes('night')) return { hours: 20, minutes: 0 };
      return null;
    };

    // Get the extracted time or time of day default or final default to 9 AM
    const time = extractTime(input) || getTimeOfDayDefaults(input) || { hours: 9, minutes: 0 };

    // Day of week mapping
    const daysOfWeek: { [key: string]: number } = {
      sunday: 0, sun: 0,
      monday: 1, mon: 1,
      tuesday: 2, tue: 2, tues: 2,
      wednesday: 3, wed: 3,
      thursday: 4, thu: 4, thurs: 4,
      friday: 5, fri: 5,
      saturday: 6, sat: 6,
    };

    // ===== PARSE RELATIVE TIME (returns immediately) =====

    // "in/after X hours" or "X hours from now"
    const hoursMatch = input.match(/(in|after)\s+(\d+)\s*hours?/i) || input.match(/(\d+)\s*hours?\s+from\s+now/i);
    if (hoursMatch) {
      const hours = parseInt(hoursMatch[2] || hoursMatch[1]);
      targetDate = new Date(now.getTime() + hours * 60 * 60 * 1000);
      displayText = `In ${hours} hour${hours > 1 ? 's' : ''}`;
      return { date: targetDate, displayText, isValid: true };
    }

    // "in/after X minutes/mins" or "X minutes from now"
    const minutesMatch = input.match(/(in|after)\s+(\d+)\s*(minutes?|mins?)/i) || input.match(/(\d+)\s*(minutes?|mins?)\s+from\s+now/i);
    if (minutesMatch) {
      const minutes = parseInt(minutesMatch[2] || minutesMatch[1]);
      targetDate = new Date(now.getTime() + minutes * 60 * 1000);
      displayText = `In ${minutes} minute${minutes > 1 ? 's' : ''}`;
      return { date: targetDate, displayText, isValid: true };
    }

    // "within X minutes/hours"
    const withinMatch = input.match(/within\s+(\d+)\s*(minutes?|mins?|hours?|hrs?)/i);
    if (withinMatch) {
      const value = parseInt(withinMatch[1]);
      const unit = withinMatch[2].toLowerCase();
      const isHours = unit.startsWith('hour') || unit.startsWith('hr');
      const ms = isHours ? value * 60 * 60 * 1000 : value * 60 * 1000;
      targetDate = new Date(now.getTime() + ms);
      displayText = `In ${value} ${isHours ? 'hour' : 'minute'}${value > 1 ? 's' : ''}`;
      return { date: targetDate, displayText, isValid: true };
    }

    // "for X minutes" / "set timer for X minutes"
    const timerMatch = input.match(/(for|set\s+timer\s+for)\s+(\d+)\s*(minutes?|mins?|hours?|hrs?)/i);
    if (timerMatch) {
      const value = parseInt(timerMatch[2]);
      const unit = timerMatch[3].toLowerCase();
      const isHours = unit.startsWith('hour') || unit.startsWith('hr');
      const ms = isHours ? value * 60 * 60 * 1000 : value * 60 * 1000;
      targetDate = new Date(now.getTime() + ms);
      displayText = `In ${value} ${isHours ? 'hour' : 'minute'}${value > 1 ? 's' : ''}`;
      return { date: targetDate, displayText, isValid: true };
    }

    // "in an hour" / "after an hour" / "in a minute"
    if (input.match(/(in|after)\s+(an?|one)\s+hour/i)) {
      targetDate = new Date(now.getTime() + 60 * 60 * 1000);
      displayText = 'In 1 hour';
      return { date: targetDate, displayText, isValid: true };
    }
    if (input.match(/(in|after)\s+(a|one)\s+minute/i)) {
      targetDate = new Date(now.getTime() + 60 * 1000);
      displayText = 'In 1 minute';
      return { date: targetDate, displayText, isValid: true };
    }

    // "in half an hour" / "after half an hour" / "in 30 minutes"
    if (input.match(/(in|after)\s+(half\s+an?\s+hour|30\s+minutes?)/i)) {
      targetDate = new Date(now.getTime() + 30 * 60 * 1000);
      displayText = 'In 30 minutes';
      return { date: targetDate, displayText, isValid: true };
    }

    // "in X days" / "after X days" / "X days from now"
    const daysMatch = input.match(/(in|after)\s+(\d+)\s*days?/i) || input.match(/(\d+)\s*days?\s+from\s+now/i);
    if (daysMatch) {
      const days = parseInt(daysMatch[2] || daysMatch[1]);
      targetDate.setDate(targetDate.getDate() + days);
      displayText = `In ${days} day${days > 1 ? 's' : ''}`;
    }

    // "in a week" / "after a week"
    else if (input.match(/(in|after)\s+(a|one)\s+week/i)) {
      targetDate.setDate(targetDate.getDate() + 7);
      displayText = 'In 1 week';
    }

    // "in a month" / "after a month"
    else if (input.match(/(in|after)\s+(a|one)\s+month/i)) {
      targetDate.setMonth(targetDate.getMonth() + 1);
      displayText = 'In 1 month';
    }

    // ===== PARSE DAY REFERENCES =====

    // "day after tomorrow"
    else if (input.includes('day after tomorrow')) {
      targetDate.setDate(targetDate.getDate() + 2);
      displayText = 'Day after tomorrow';
    }
    // "today", "later today"
    else if (input.includes('today')) {
      // Keep current date
      displayText = 'Today';
    }
    // "tonight", "later tonight"
    else if (input.includes('tonight')) {
      time.hours = time.hours < 18 ? 20 : time.hours; // Default to 8pm for "tonight"
      displayText = 'Tonight';
    }
    // "tomorrow", "tmrw", "tmw", "2morrow"
    else if (input.match(/\b(tomorrow|tmrw|tmw|2morrow)\b/i)) {
      targetDate.setDate(targetDate.getDate() + 1);
      displayText = 'Tomorrow';
    }
    // "next week"
    else if (input.includes('next week')) {
      targetDate.setDate(targetDate.getDate() + 7);
      displayText = 'Next week';
    }
    // "next month"
    else if (input.includes('next month')) {
      targetDate.setMonth(targetDate.getMonth() + 1);
      displayText = 'Next month';
    }
    // "this weekend"
    else if (input.includes('this weekend')) {
      // Find next Saturday
      const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + daysUntilSaturday);
      displayText = 'This weekend';
    }
    // "end of day" / "EOD"
    else if (input.match(/\b(end\s+of\s+day|eod)\b/i)) {
      time.hours = 17;
      time.minutes = 0;
      displayText = 'End of day';
    }
    // "end of week" / "EOW"
    else if (input.match(/\b(end\s+of\s+week|eow)\b/i)) {
      const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + daysUntilFriday);
      time.hours = 17;
      time.minutes = 0;
      displayText = 'End of week';
    }
    // "noon" / "midday"
    else if (input.match(/\b(noon|midday)\b/i)) {
      // Today at noon
      displayText = 'Noon';
    }
    // "midnight"
    else if (input.includes('midnight')) {
      targetDate.setDate(targetDate.getDate() + 1); // Next midnight
      displayText = 'Midnight';
    }
    // "next/this/coming/following monday", etc.
    else if (input.match(/\b(next|this|coming|following)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)) {
      const prefixMatch = input.match(/(next|this|coming|following)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
      if (prefixMatch) {
        const prefix = prefixMatch[1].toLowerCase();
        const day = prefixMatch[2].toLowerCase();
        const dayNum = daysOfWeek[day];
        let daysUntil = (dayNum - now.getDay() + 7) % 7;
        if (daysUntil === 0) daysUntil = 7;
        if (prefix === 'next') {
          daysUntil += 7; // Add another week for "next"
        }
        targetDate.setDate(targetDate.getDate() + daysUntil);
        const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
        displayText = prefix === 'next' ? `Next ${capitalizedDay}` : capitalizedDay;
      }
    }
    // Day names without prefix
    else {
      // Check for day of week without "next"
      for (const [day, dayNum] of Object.entries(daysOfWeek)) {
        if (input.includes(day)) {
          let daysUntil = (dayNum - now.getDay() + 7) % 7;
          if (daysUntil === 0) daysUntil = 7; // If today, go to next week
          targetDate.setDate(targetDate.getDate() + daysUntil);
          displayText = day.charAt(0).toUpperCase() + day.slice(1);
          break;
        }
      }
    }

    // If no date pattern matched, default to today if time is in future, otherwise tomorrow
    if (!displayText) {
      const testDate = new Date(now);
      testDate.setHours(time.hours, time.minutes, 0, 0);
      if (testDate > now) {
        displayText = 'Today';
      } else {
        targetDate.setDate(targetDate.getDate() + 1);
        displayText = 'Tomorrow';
      }
      isValid = false; // Mark as not a precise match
    }

    // Set the time
    targetDate.setHours(time.hours, time.minutes, 0, 0);

    // Format display text with time
    const timeStr = targetDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: time.minutes > 0 ? '2-digit' : undefined,
      hour12: true,
    });

    // Don't add "at X" for relative time displays that already returned
    if (!displayText.startsWith('In ')) {
      displayText = `${displayText} at ${timeStr}`;
    }

    // If the time is in the past, move to the next occurrence
    if (targetDate <= now) {
      if (input.includes('today') || input.includes('tonight')) {
        // If today but time passed, move to tomorrow
        targetDate.setDate(targetDate.getDate() + 1);
        displayText = displayText.replace('Today', 'Tomorrow').replace('Tonight', 'Tomorrow');
      }
    }

    return { date: targetDate, displayText, isValid };
  }

  /**
   * Format a Date to a user-friendly display string
   */
  formatReminderDisplay(date: Date): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: date.getMinutes() > 0 ? '2-digit' : undefined,
      hour12: true,
    });

    if (isToday) {
      return `Today at ${timeStr}`;
    } else if (isTomorrow) {
      return `Tomorrow at ${timeStr}`;
    } else {
      const dayStr = date.toLocaleDateString('en-US', { weekday: 'long' });
      return `${dayStr} at ${timeStr}`;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('Notification cancelled:', notificationId);
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }

  /**
   * Get all scheduled notifications
   */
  async getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      return notifications;
    } catch (error) {
      console.error('Failed to get scheduled notifications:', error);
      return [];
    }
  }

  /**
   * Debug: Log all scheduled notifications with their trigger times
   * Call this to verify notifications are scheduled correctly
   */
  async debugLogScheduledNotifications(): Promise<void> {
    const notifications = await this.getAllScheduledNotifications();
    console.log('=== SCHEDULED NOTIFICATIONS ===');
    console.log(`Total: ${notifications.length}`);

    notifications.forEach((notification, index) => {
      const trigger = notification.trigger as any;
      let triggerInfo = 'Unknown trigger';

      if (trigger) {
        if (trigger.type === 'date' && trigger.date) {
          const date = new Date(trigger.date);
          triggerInfo = `Date: ${date.toLocaleString()}`;
        } else if (trigger.type === 'timeInterval' && trigger.seconds) {
          const minutes = Math.floor(trigger.seconds / 60);
          const hours = Math.floor(minutes / 60);
          triggerInfo = `In ${hours}h ${minutes % 60}m (${trigger.seconds}s)`;
        } else if (trigger.seconds) {
          triggerInfo = `Seconds: ${trigger.seconds}`;
        }
      }

      console.log(`[${index + 1}] ID: ${notification.identifier}`);
      console.log(`    Title: ${notification.content.title}`);
      console.log(`    Body: ${notification.content.body}`);
      console.log(`    Trigger: ${triggerInfo}`);
    });

    console.log('===============================');
  }

  /**
   * Get badge count (number of pending notifications)
   */
  async getBadgeCount(): Promise<number> {
    try {
      const notifications = await this.getAllScheduledNotifications();
      return notifications.length;
    } catch (error) {
      console.error('Failed to get badge count:', error);
      return 0;
    }
  }

  /**
   * Set up notification listeners
   */
  setupNotificationListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationTapped?: (response: Notifications.NotificationResponse) => void
  ) {
    // Listen for notifications received while app is foregrounded
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
        onNotificationReceived?.(notification);
      }
    );

    // Listen for user interactions with notifications
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification tapped:', response);
        onNotificationTapped?.(response);
      }
    );

    return {
      receivedSubscription,
      responseSubscription,
      remove: () => {
        receivedSubscription.remove();
        responseSubscription.remove();
      },
    };
  }
}

export default new NotificationService();
