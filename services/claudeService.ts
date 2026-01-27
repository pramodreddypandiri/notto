import { buildAIProfileContext } from './profileService';
import { ENV } from '../config/env';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// Location-based note categories
export type NoteLocationCategory =
  | 'shopping'
  | 'grocery'
  | 'pharmacy'
  | 'health'
  | 'errand'
  | 'work'
  | 'fitness'
  | null;

// Reminder types
export type ReminderType = 'one-time' | 'recurring';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

// Parsed reminder info
export interface ParsedReminder {
  isReminder: boolean;
  reminderType?: ReminderType;
  eventDate?: string; // ISO date string for one-time events
  eventLocation?: string;
  reminderDaysBefore?: number; // days before to remind
  recurrencePattern?: RecurrencePattern;
  recurrenceDay?: number; // 0-6 for weekly (0=Sunday), 1-31 for monthly
  recurrenceTime?: string; // HH:mm format
  reminderSummary?: string; // what to remind about
}

interface ParsedNote {
  type: 'task' | 'preference' | 'intent' | 'reminder';
  activity?: string;
  person?: string;
  food?: string;
  time?: string;
  summary: string;
  locationCategory?: NoteLocationCategory;
  shoppingItems?: string[];
  // Reminder fields
  reminder?: ParsedReminder;
}

// Check if Claude API is configured
const isClaudeConfigured = (): boolean => {
  return !!(ENV.CLAUDE_API_KEY && ENV.CLAUDE_API_KEY !== 'sk-ant-YOUR_CLAUDE_API_KEY_HERE');
};

// Local detection of note categories (no AI needed for common patterns)
const detectLocationCategoryLocally = (transcript: string): { category: NoteLocationCategory; items: string[] } => {
  const lower = transcript.toLowerCase();

  // Shopping/Grocery patterns
  const groceryPatterns = [
    /\b(buy|get|need|out of|running low|pick up|grocery|groceries)\b/i,
    /\b(milk|eggs|bread|butter|cheese|vegetables?|fruits?|meat|chicken|beef|fish)\b/i,
    /\b(cereal|rice|pasta|sauce|oil|sugar|flour|coffee|tea)\b/i,
    /\b(shopping list|grocery list)\b/i,
  ];

  const pharmacyPatterns = [
    /\b(medicine|medication|prescription|refill|pharmacy|drug ?store)\b/i,
    /\b(cold|flu|fever|headache|pain|vitamin|supplement|allergy|antibiotic)\b/i,
    /\b(pills?|tablets?|syrup|bandage|first aid)\b/i,
  ];

  const healthPatterns = [
    /\b(doctor|appointment|checkup|dentist|hospital|clinic|therapy|physical)\b/i,
  ];

  const fitnessPatterns = [
    /\b(gym|workout|exercise|yoga|run|fitness|training)\b/i,
  ];

  const errandPatterns = [
    /\b(post office|mail|package|bank|deposit|dry clean|car wash|mechanic|repair)\b/i,
  ];

  // Extract shopping items
  const extractShoppingItems = (text: string): string[] => {
    const items: string[] = [];
    // Common shopping item patterns
    const itemPatterns = [
      /\b(milk|eggs?|bread|butter|cheese|yogurt|cream)\b/gi,
      /\b(apples?|bananas?|oranges?|grapes?|berries|tomatoes?|onions?|potatoes?|lettuce|carrots?)\b/gi,
      /\b(chicken|beef|pork|fish|salmon|shrimp|bacon|sausage)\b/gi,
      /\b(rice|pasta|noodles|cereal|oatmeal|flour|sugar|salt|pepper)\b/gi,
      /\b(coffee|tea|juice|soda|water|wine|beer)\b/gi,
      /\b(soap|shampoo|toothpaste|detergent|paper towels?|toilet paper)\b/gi,
    ];

    itemPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        items.push(...matches.map(m => m.toLowerCase()));
      }
    });

    return [...new Set(items)]; // Remove duplicates
  };

  // Check patterns in order of specificity
  if (pharmacyPatterns.some(p => p.test(lower))) {
    return { category: 'pharmacy', items: [] };
  }

  if (healthPatterns.some(p => p.test(lower))) {
    return { category: 'health', items: [] };
  }

  if (fitnessPatterns.some(p => p.test(lower))) {
    return { category: 'fitness', items: [] };
  }

  if (errandPatterns.some(p => p.test(lower))) {
    return { category: 'errand', items: [] };
  }

  // Check grocery/shopping last (most common)
  if (groceryPatterns.some(p => p.test(lower))) {
    const items = extractShoppingItems(lower);
    return { category: items.length > 0 ? 'grocery' : 'shopping', items };
  }

  return { category: null, items: [] };
};

// Local detection of reminder patterns
const detectReminderLocally = (transcript: string): ParsedReminder | null => {
  const lower = transcript.toLowerCase();

  // Check for reminder keywords
  const isReminder = /\b(remind|reminder|don't forget|notify|alert)\b/i.test(lower);
  if (!isReminder) return null;

  const reminder: ParsedReminder = { isReminder: true };

  // Check for recurring patterns
  const recurringPatterns = [
    { pattern: /every\s+(day|daily)/i, recurrence: 'daily' as RecurrencePattern },
    { pattern: /every\s+monday/i, recurrence: 'weekly' as RecurrencePattern, day: 1 },
    { pattern: /every\s+tuesday/i, recurrence: 'weekly' as RecurrencePattern, day: 2 },
    { pattern: /every\s+wednesday/i, recurrence: 'weekly' as RecurrencePattern, day: 3 },
    { pattern: /every\s+thursday/i, recurrence: 'weekly' as RecurrencePattern, day: 4 },
    { pattern: /every\s+friday/i, recurrence: 'weekly' as RecurrencePattern, day: 5 },
    { pattern: /every\s+saturday/i, recurrence: 'weekly' as RecurrencePattern, day: 6 },
    { pattern: /every\s+sunday/i, recurrence: 'weekly' as RecurrencePattern, day: 0 },
    { pattern: /every\s+week/i, recurrence: 'weekly' as RecurrencePattern },
    { pattern: /every\s+month/i, recurrence: 'monthly' as RecurrencePattern },
    { pattern: /weekly/i, recurrence: 'weekly' as RecurrencePattern },
    { pattern: /daily/i, recurrence: 'daily' as RecurrencePattern },
    { pattern: /monthly/i, recurrence: 'monthly' as RecurrencePattern },
  ];

  for (const { pattern, recurrence, day } of recurringPatterns) {
    if (pattern.test(lower)) {
      reminder.reminderType = 'recurring';
      reminder.recurrencePattern = recurrence;
      if (day !== undefined) reminder.recurrenceDay = day;
      break;
    }
  }

  // Check for time of day
  const timePatterns = [
    { pattern: /morning/i, time: '09:00' },
    { pattern: /afternoon/i, time: '14:00' },
    { pattern: /evening/i, time: '18:00' },
    { pattern: /night/i, time: '20:00' },
    { pattern: /(\d{1,2}):(\d{2})\s*(am|pm)?/i, extract: true },
    { pattern: /(\d{1,2})\s*(am|pm)/i, extract: true },
  ];

  for (const { pattern, time, extract } of timePatterns) {
    const match = lower.match(pattern);
    if (match) {
      if (extract && match[1]) {
        let hours = parseInt(match[1]);
        const minutes = match[2] && !isNaN(parseInt(match[2])) ? match[2] : '00';
        const ampm = match[3] || match[2];
        if (ampm?.toLowerCase() === 'pm' && hours < 12) hours += 12;
        if (ampm?.toLowerCase() === 'am' && hours === 12) hours = 0;
        reminder.recurrenceTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } else if (time) {
        reminder.recurrenceTime = time;
      }
      break;
    }
  }

  // Check for "X days before" pattern
  const daysBefore = lower.match(/(\d+)\s*days?\s*(before|prior|in advance)/i);
  if (daysBefore) {
    reminder.reminderDaysBefore = parseInt(daysBefore[1]);
  }
  // Also check for "two days before", "three days before" etc.
  const wordDaysBefore = lower.match(/(one|two|three|four|five|six|seven)\s*days?\s*(before|prior|in advance)/i);
  if (wordDaysBefore) {
    const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
    reminder.reminderDaysBefore = wordToNum[wordDaysBefore[1].toLowerCase()] || 1;
  }

  // If not recurring but has "days before", it's a one-time event
  if (!reminder.reminderType && reminder.reminderDaysBefore) {
    reminder.reminderType = 'one-time';
  }

  // Default to one-time if no type detected
  if (!reminder.reminderType) {
    reminder.reminderType = 'one-time';
  }

  return reminder;
};

export const parseNote = async (transcript: string): Promise<ParsedNote> => {
  // First, detect location category locally (no API needed)
  const { category: localCategory, items: shoppingItems } = detectLocationCategoryLocally(transcript);

  // Detect reminders locally
  const localReminder = detectReminderLocally(transcript);

  // If Claude API not configured, return simple fallback with local detection
  if (!isClaudeConfigured()) {
    console.log('Claude API not configured - using simple parsing');
    return {
      type: localReminder ? 'reminder' : 'intent',
      summary: transcript,
      locationCategory: localCategory,
      shoppingItems: shoppingItems.length > 0 ? shoppingItems : undefined,
      reminder: localReminder || undefined,
    };
  }

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ENV.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Parse this voice note into structured data. Return ONLY valid JSON.

Voice note: "${transcript}"

Today's date: ${new Date().toISOString().split('T')[0]}

Return format:
{
  "type": "task" | "preference" | "intent" | "reminder",
  "activity": string (if mentioned),
  "person": string (if mentioned),
  "food": string (if mentioned),
  "time": string (if mentioned),
  "summary": string (clean one-line version),
  "locationCategory": "shopping" | "grocery" | "pharmacy" | "health" | "errand" | "work" | "fitness" | null,
  "shoppingItems": string[] (list of items to buy, if applicable),
  "reminder": {
    "isReminder": boolean,
    "reminderType": "one-time" | "recurring",
    "eventDate": string (ISO date for one-time events, e.g. "2025-02-18"),
    "eventLocation": string (location of the event if mentioned),
    "reminderDaysBefore": number (days before to start reminding, default 1),
    "recurrencePattern": "daily" | "weekly" | "monthly" | "yearly" (for recurring),
    "recurrenceDay": number (0-6 for weekly where 0=Sunday, 1-31 for monthly),
    "recurrenceTime": string (HH:mm format, e.g. "09:00"),
    "reminderSummary": string (what to remind about)
  } (only if this is a reminder)
}

Reminder Detection Guidelines:
- "remind me", "don't forget", "notify me" indicate reminders
- "every Monday", "every day", "weekly" = recurring reminder
- "on Feb 18th", "next Tuesday", "tomorrow" = one-time event
- "remind me 2 days before" = reminderDaysBefore: 2
- "morning" = 09:00, "afternoon" = 14:00, "evening" = 18:00
- Parse dates relative to today's date

Location Category Guidelines:
- "grocery": food items, household supplies
- "shopping": general retail
- "pharmacy": medicine, health products
- "health": doctor appointments, medical visits
- "errand": post office, bank, dry cleaning
- "work": work-related tasks
- "fitness": gym, workout, exercise

Examples:
"Remind me every Monday morning to post on LinkedIn" -> {"type": "reminder", "summary": "Post on LinkedIn", "reminder": {"isReminder": true, "reminderType": "recurring", "recurrencePattern": "weekly", "recurrenceDay": 1, "recurrenceTime": "09:00", "reminderSummary": "Post on LinkedIn"}}
"I have an event on Feb 18th, remind me 2 days before" -> {"type": "reminder", "summary": "Event on Feb 18th", "reminder": {"isReminder": true, "reminderType": "one-time", "eventDate": "2025-02-18", "reminderDaysBefore": 2, "reminderSummary": "Event on Feb 18th"}}
"I'm out of milk" -> {"type": "task", "summary": "Buy: milk", "locationCategory": "grocery", "shoppingItems": ["milk"]}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const content = data.content[0].text;

    // Remove markdown code blocks if present
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    // Use local detection as fallback if AI didn't detect a category
    if (!parsed.locationCategory && localCategory) {
      parsed.locationCategory = localCategory;
    }
    if ((!parsed.shoppingItems || parsed.shoppingItems.length === 0) && shoppingItems.length > 0) {
      parsed.shoppingItems = shoppingItems;
    }
    // Use local reminder detection as fallback
    if (!parsed.reminder && localReminder) {
      parsed.reminder = localReminder;
      parsed.type = 'reminder';
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse note:', error);
    // Fallback with local detection
    return {
      type: localReminder ? 'reminder' : 'intent',
      summary: transcript,
      locationCategory: localCategory,
      shoppingItems: shoppingItems.length > 0 ? shoppingItems : undefined,
      reminder: localReminder || undefined,
    };
  }
};

// Place suggestion interface
export interface PlaceSuggestion {
  name: string;
  address: string;
  category: 'activity' | 'food' | 'park' | 'shopping' | 'entertainment' | 'fitness' | 'cafe' | 'bar' | 'other';
  description: string;
  reason: string;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  source: 'notes' | 'personality' | 'trending';
}

export const generatePlaceSuggestions = async (
  notes: any[],
  userLocation: { lat: number; lng: number; city: string },
  pastFeedback?: { name: string; status: 'liked' | 'disliked' }[]
): Promise<PlaceSuggestion[]> => {
  // Check if Claude API is configured
  if (!isClaudeConfigured()) {
    throw new Error('Claude API key not configured. Please add your key to config/env.ts');
  }

  try {
    // Get user profile context for personalization
    const profileContext = await buildAIProfileContext();

    // Prepare context for Claude
    const notesContext = notes
      .map(n => `- ${n.transcript} (${n.parsed_data?.summary || ''})`)
      .join('\n');

    const feedbackContext = pastFeedback && pastFeedback.length > 0
      ? pastFeedback.map(f => `${f.name}: ${f.status}`).join('\n')
      : 'No previous feedback';

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ENV.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `You are a personalized place recommendation assistant. Suggest 5-8 places that match this user's interests and personality.

${profileContext}

---

USER LOCATION: ${userLocation.city} (${userLocation.lat}, ${userLocation.lng})

USER'S NOTES FROM THIS WEEK:
${notesContext}

PAST PLACE FEEDBACK (learn from this):
${feedbackContext}

---

SUGGESTION STRATEGY:
1. NOTES-BASED (2-3 places): Directly match what they mentioned in notes
   - Example: "want to try sushi" -> suggest a specific sushi restaurant
   - Example: "need to workout more" -> suggest a gym or fitness class

2. PERSONALITY-BASED (2-3 places): Match their personality profile
   - Introverts: quieter cafes, less crowded parks, bookstores
   - Extroverts: lively bars, popular hangouts, group activities
   - Budget-conscious: affordable options, happy hours
   - Foodies: unique restaurants, local favorites

3. DISCOVERY (1-2 places): Help them discover something new that fits their profile
   - Slightly outside their usual but still within their comfort zone
   - Good for understanding their tastes better based on feedback

IMPORTANT:
- Learn from past feedback: avoid places similar to disliked ones
- Suggest more places similar to liked ones
- Use real, actual place names that would exist in ${userLocation.city}
- Vary the categories: don't suggest only restaurants

Return ONLY valid JSON array:
[
  {
    "name": "Blue Bottle Coffee",
    "address": "123 Main Street",
    "category": "cafe",
    "description": "Minimalist specialty coffee shop known for single-origin pour-overs",
    "reason": "Based on your notes about wanting a quiet workspace - this spot has great WiFi and a calm atmosphere",
    "priceRange": "$$",
    "source": "notes"
  },
  {
    "name": "Sunset Park",
    "address": "456 Park Avenue",
    "category": "park",
    "description": "Peaceful urban park with walking trails and scenic views",
    "reason": "You seem to prefer relaxed settings - this is a great spot for unwinding",
    "priceRange": "$",
    "source": "personality"
  }
]

Categories: activity, food, park, shopping, entertainment, fitness, cafe, bar, other
Price ranges: $, $$, $$$, $$$$
Sources: notes (from their voice notes), personality (from their profile), trending (discovery)`,
          },
        ],
      }),
    });

    const data = await response.json();

    // Check for API errors
    if (!response.ok) {
      console.error('Claude API error:', data);
      throw new Error(data.error?.message || `API request failed with status ${response.status}`);
    }

    // Check if content exists
    if (!data.content || !Array.isArray(data.content)) {
      console.error('Unexpected API response:', data);
      throw new Error('Invalid API response structure');
    }

    // Extract text content from all blocks
    let fullText = '';
    for (const block of data.content) {
      if (block.type === 'text') {
        fullText += block.text;
      }
    }

    // Log the raw response for debugging
    console.log('[generatePlaceSuggestions] Raw response:', fullText.substring(0, 200) + '...');

    // Remove markdown code blocks and any leading/trailing text
    let jsonStr = fullText.replace(/```json\n?|\n?```/g, '').trim();

    // Try to extract JSON array if there's extra text
    const jsonArrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonArrayMatch) {
      jsonStr = jsonArrayMatch[0];
    }

    try {
      return JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', jsonStr.substring(0, 500));
      throw new Error('Failed to parse place suggestions response');
    }
  } catch (error) {
    console.error('Failed to generate place suggestions:', error);
    throw error;
  }
};

// Keep the old function for backwards compatibility but mark as deprecated
/** @deprecated Use generatePlaceSuggestions instead */
export const generateWeekendPlans = generatePlaceSuggestions as any;