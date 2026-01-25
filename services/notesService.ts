import { supabase } from '../config/supabase';
import { parseNote } from './claudeService';
import notificationService from './notificationService';

// Keywords that indicate a reminder intent
const REMINDER_KEYWORDS = [
  'remind', 'reminder', 'remember',
  'don\'t forget', 'dont forget',
  'call', 'email', 'text', 'message',
  'meeting', 'appointment',
  'pick up', 'buy', 'get',
  'schedule', 'book',
];

// Check if transcript contains reminder intent
const hasReminderIntent = (transcript: string): boolean => {
  const lower = transcript.toLowerCase();
  return REMINDER_KEYWORDS.some(keyword => lower.includes(keyword));
};

// Auto-detect if a note should be a reminder using local parsing (no AI needed)
const autoDetectReminder = (transcript: string): { isReminder: boolean; timeExtraction: ReturnType<typeof notificationService.extractTimeFromText> } => {
  const hasIntent = hasReminderIntent(transcript);
  const timeExtraction = notificationService.extractTimeFromText(transcript);

  // It's a reminder if:
  // 1. Has reminder intent keywords AND has a time reference
  // 2. OR has strong reminder keywords (remind, reminder, don't forget) regardless of time
  const strongReminderKeywords = ['remind', 'reminder', 'don\'t forget', 'dont forget'];
  const hasStrongIntent = strongReminderKeywords.some(kw => transcript.toLowerCase().includes(kw));

  const isReminder = (hasIntent && timeExtraction.hasTime) || hasStrongIntent;

  return { isReminder, timeExtraction };
};

// Determine appropriate tags based on transcript (local detection) and optional AI parsed data
const determineTags = (
  transcript: string,
  parsedData?: any
): string[] => {
  const tags: string[] = [];

  // PRIMARY: Use local auto-detection (no AI needed)
  const { isReminder } = autoDetectReminder(transcript);
  if (isReminder) {
    tags.push('reminder');
    return tags; // Reminder takes priority
  }

  // SECONDARY: If AI parsed data is available, use it for other tag types
  if (parsedData) {
    if (parsedData.type === 'task') {
      tags.push('reminder');
    } else if (parsedData.type === 'preference') {
      tags.push('preference');
    } else if (parsedData.food || parsedData.activity) {
      tags.push('my_type');
    }
  }

  return tags;
};

export interface CreateNoteOptions {
  transcript: string;
  audioUrl?: string;
  forceReminder?: boolean;
  customReminderTime?: Date;
}

export interface CreateNoteResult {
  note: any;
  reminderScheduled: boolean;
  reminderTime?: string;
  notificationId?: string;
}

export const createNote = async (
  transcript: string,
  audioUrl?: string
): Promise<any> => {
  const result = await createNoteWithReminder({ transcript, audioUrl });
  return result.note;
};

export const createNoteWithReminder = async (
  options: CreateNoteOptions
): Promise<CreateNoteResult> => {
  const { transcript, audioUrl, forceReminder, customReminderTime } = options;

  try {
    // Parse the transcript with Claude
    const parsedData = await parseNote(transcript);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Determine tags (local detection is primary, AI parsed data is secondary)
    const tags = determineTags(transcript, parsedData);
    const isReminder = forceReminder || tags.includes('reminder');

    // Prepare note data
    const noteData: any = {
      user_id: user.id,
      transcript,
      audio_url: audioUrl,
      parsed_data: parsedData,
      tags,
      // Location-based fields from AI parsing
      location_category: parsedData.locationCategory || null,
      shopping_items: parsedData.shoppingItems || null,
      location_completed: false,
    };

    let notificationId: string | null = null;
    let reminderDisplayText: string | undefined;

    // Helper to check if a date is valid
    const isValidDate = (date: Date): boolean => {
      return date instanceof Date && !isNaN(date.getTime()) && date.getTime() > 0;
    };

    // Schedule reminder if applicable
    if (isReminder) {
      const noteDisplayText = parsedData.summary || transcript;

      if (customReminderTime && isValidDate(customReminderTime)) {
        // PRIORITY 1: Use custom time provided by user (manual selection)
        notificationId = await notificationService.scheduleReminderForDate(
          noteDisplayText,
          '', // Note ID not available yet
          customReminderTime
        );
        reminderDisplayText = notificationService.formatReminderDisplay(customReminderTime);
        noteData.reminder_time = customReminderTime.toISOString();
      } else {
        // PRIORITY 2: Use LOCAL time extraction from transcript (no AI needed)
        const localTimeExtraction = notificationService.extractTimeFromText(transcript);

        if (localTimeExtraction.hasTime && localTimeExtraction.reminderInfo?.isValid) {
          const { reminderInfo } = localTimeExtraction;
          if (isValidDate(reminderInfo.date)) {
            notificationId = await notificationService.scheduleReminderForDate(
              noteDisplayText,
              '',
              reminderInfo.date
            );
            reminderDisplayText = reminderInfo.displayText;
            noteData.reminder_time = reminderInfo.date.toISOString();
          }
        } else if (parsedData.time) {
          // PRIORITY 3: Fallback to AI-extracted time if local extraction failed
          const { notificationId: nId, reminderInfo } = await notificationService.scheduleReminderFromNote(
            noteDisplayText,
            parsedData.time
          );
          if (reminderInfo.isValid && isValidDate(reminderInfo.date)) {
            notificationId = nId;
            reminderDisplayText = reminderInfo.displayText;
            noteData.reminder_time = reminderInfo.date.toISOString();
          }
        }
      }

      if (notificationId) {
        noteData.notification_id = notificationId;
      }
    }

    // Insert into database
    const { data, error } = await supabase
      .from('notes')
      .insert(noteData)
      .select()
      .single();

    if (error) throw error;

    return {
      note: data,
      reminderScheduled: !!notificationId,
      reminderTime: reminderDisplayText,
      notificationId: notificationId || undefined,
    };
  } catch (error) {
    console.error('Failed to create note:', error);
    throw error;
  }
};

export const updateNoteReminder = async (
  noteId: string,
  reminderTime: Date
): Promise<{ success: boolean; notificationId?: string; reminderDisplay?: string }> => {
  try {
    // Get the note first
    const { data: note, error: fetchError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (fetchError) throw fetchError;

    // Cancel existing notification if any
    if (note.notification_id) {
      await notificationService.cancelNotification(note.notification_id);
    }

    // Schedule new notification
    const notificationId = await notificationService.scheduleReminderForDate(
      note.parsed_data?.summary || note.transcript,
      noteId,
      reminderTime
    );

    // Update note with new reminder info
    const currentTags = note.tags || [];
    const newTags = currentTags.includes('reminder')
      ? currentTags
      : [...currentTags, 'reminder'];

    const { error: updateError } = await supabase
      .from('notes')
      .update({
        reminder_time: reminderTime.toISOString(),
        notification_id: notificationId,
        tags: newTags,
      })
      .eq('id', noteId);

    if (updateError) throw updateError;

    return {
      success: true,
      notificationId: notificationId || undefined,
      reminderDisplay: notificationService.formatReminderDisplay(reminderTime),
    };
  } catch (error) {
    console.error('Failed to update note reminder:', error);
    return { success: false };
  }
};

export const removeNoteReminder = async (noteId: string): Promise<boolean> => {
  try {
    // Get the note first
    const { data: note, error: fetchError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (fetchError) throw fetchError;

    // Cancel existing notification if any
    if (note.notification_id) {
      await notificationService.cancelNotification(note.notification_id);
    }

    // Remove reminder tag and clear reminder fields
    const newTags = (note.tags || []).filter((t: string) => t !== 'reminder');

    const { error: updateError } = await supabase
      .from('notes')
      .update({
        reminder_time: null,
        notification_id: null,
        tags: newTags,
      })
      .eq('id', noteId);

    if (updateError) throw updateError;

    return true;
  } catch (error) {
    console.error('Failed to remove note reminder:', error);
    return false;
  }
};

export const getNotes = async (limit = 50) => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to get notes:', error);
    throw error;
  }
};

export const getRecentNotes = async (days = 7) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to get recent notes:', error);
    throw error;
  }
};

export const updateNoteTags = async (
  noteId: string,
  tags: string[]
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notes')
      .update({ tags })
      .eq('id', noteId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to update note tags:', error);
    return false;
  }
};

export const deleteNote = async (noteId: string) => {
  try {
    // Get the note first to cancel any scheduled notification
    const { data: note } = await supabase
      .from('notes')
      .select('notification_id')
      .eq('id', noteId)
      .single();

    // Cancel notification if exists
    if (note?.notification_id) {
      await notificationService.cancelNotification(note.notification_id);
    }

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to delete note:', error);
    throw error;
  }
};

// ===== LOCATION-BASED NOTE FUNCTIONS =====

export type NoteLocationCategory =
  | 'shopping'
  | 'grocery'
  | 'pharmacy'
  | 'health'
  | 'errand'
  | 'work'
  | 'fitness';

/**
 * Get all pending location-based notes (not completed)
 */
export const getPendingLocationNotes = async (
  category?: NoteLocationCategory
): Promise<any[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .not('location_category', 'is', null)
      .eq('location_completed', false)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('location_category', category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to get pending location notes:', error);
    return [];
  }
};

/**
 * Get notes by location category
 */
export const getNotesByLocationCategory = async (
  categories: NoteLocationCategory[]
): Promise<any[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .in('location_category', categories)
      .eq('location_completed', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to get notes by category:', error);
    return [];
  }
};

/**
 * Mark a location-based note as completed
 */
export const markLocationNoteCompleted = async (noteId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notes')
      .update({ location_completed: true })
      .eq('id', noteId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to mark note completed:', error);
    return false;
  }
};

/**
 * Reset a location-based note to pending
 */
export const resetLocationNote = async (noteId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notes')
      .update({ location_completed: false })
      .eq('id', noteId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to reset note:', error);
    return false;
  }
};

/**
 * Get shopping list items from all pending grocery notes
 */
export const getShoppingList = async (): Promise<{ noteId: string; items: string[] }[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('notes')
      .select('id, shopping_items, transcript, parsed_data')
      .eq('user_id', user.id)
      .in('location_category', ['grocery', 'shopping'])
      .eq('location_completed', false)
      .not('shopping_items', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(note => ({
      noteId: note.id,
      items: note.shopping_items || [],
    }));
  } catch (error) {
    console.error('Failed to get shopping list:', error);
    return [];
  }
};
