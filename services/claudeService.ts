import { buildAIProfileContext } from './profileService';
import { STORE_CHAINS } from './locationService';
import { isAIConfigured, callAIForJSON, callAI } from './aiService';

// Location-based note categories
export type NoteLocationCategory =
  | 'shopping'
  | 'grocery'
  | 'pharmacy'
  | 'health'
  | 'errand'
  | 'work'
  | 'fitness'
  | 'leaving_home'
  | 'arriving_home'
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
  recurrenceTime?: string; // HH:mm format (first/primary time)
  additionalTimes?: string[]; // All mentioned times in HH:mm format (for multiple reminders)
  reminderSummary?: string; // what to remind about
}

// Place intent detection
export interface PlaceIntent {
  detected: boolean;
  searchQuery: string;
  placeType?: string;
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
  // Place intent
  placeIntent?: PlaceIntent;
}

// Check if AI API is configured
const isClaudeConfigured = isAIConfigured;

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

  // Leaving home patterns - check first for explicit "leaving home" notes
  const leavingHomePatterns = [
    /\b(leaving|leave)\s+(home|house|the house)\b/i,
    /\b(before|when)\s+i\s+(leave|go out|head out|step out)\b/i,
    /\b(going|heading|stepping)\s+out\b/i,
    /\b(on my way|on the way)\s+out\b/i,
    /\b(before|when)\s+(going|heading)\s+out\b/i,
    /\b(don'?t forget|remember)\s+(when|before)\s+(leaving|going out)\b/i,
    /\b(as i|when i|before i)\s+(walk out|go outside|exit)\b/i,
  ];

  // Arriving home patterns - for notes triggered when getting back home
  const arrivingHomePatterns = [
    /\b(when|once|after)\s+i\s+(get|arrive|reach|come|am)\s+(home|back home|back to the house)\b/i,
    /\b(arriving|arrive|get|reach|come)\s+(home|back home)\b/i,
    /\b(when|once)\s+(i'm|i am|im)\s+(home|back home|back)\b/i,
    /\b(getting|reaching|coming)\s+(home|back home|back to the house)\b/i,
    /\b(at home|back at home)\s*(remind|remember|don'?t forget)?\b/i,
    /\b(remind|remember).*(when|once|after).*(home|get back|arrive)\b/i,
    /\b(as soon as|right when)\s+i\s+(get|arrive|reach)\s+(home|back)\b/i,
  ];

  // Check patterns in order of specificity
  // Check leaving home first - these are specifically for "leave home" reminders
  if (leavingHomePatterns.some(p => p.test(lower))) {
    return { category: 'leaving_home', items: [] };
  }

  // Check arriving home - for reminders when getting back home
  if (arrivingHomePatterns.some(p => p.test(lower))) {
    return { category: 'arriving_home', items: [] };
  }

  // Check for store names mentioned in the transcript
  // This handles cases like "when I'm at Kroger", "at Walmart remind me", "near CVS", "at work"
  const storeCategories = ['grocery', 'pharmacy', 'shopping', 'health', 'fitness', 'errand', 'work'] as const;
  for (const category of storeCategories) {
    const stores = STORE_CHAINS[category];
    if (stores && stores.some((store: string) => lower.includes(store))) {
      const items = category === 'grocery' ? extractShoppingItems(lower) : [];
      return { category, items };
    }
  }

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

// Helper to calculate future time from relative expression
const calculateRelativeTime = (amount: number, unit: 'minutes' | 'hours' | 'days'): { date: string; time: string } => {
  const now = new Date();

  if (unit === 'minutes') {
    now.setMinutes(now.getMinutes() + amount);
  } else if (unit === 'hours') {
    now.setHours(now.getHours() + amount);
  } else if (unit === 'days') {
    now.setDate(now.getDate() + amount);
  }

  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  return { date, time };
};

// Local detection of reminder patterns
const detectReminderLocally = (transcript: string): ParsedReminder | null => {
  const lower = transcript.toLowerCase();

  // Check for explicit reminder keywords
  const hasExplicitKeyword = /\b(remind|reminder|don't forget|notify|alert)\b/i.test(lower);

  // Check for relative time expressions ("in 45 minutes", "after 2 hours")
  // These are implicit reminder intent — if someone says "X in 45 minutes", they want a notification
  const hasRelativeTime = /\b(?:in|after)\s+(?:\d+|a|an|one|half\s+an?)\s*(?:minutes?|mins?|hours?|hrs?|hour)\b/i.test(lower)
    || /\b(?:in|after)\s+(?:thirty|fifteen|forty-?five)\s*(?:minutes?|mins?)\b/i.test(lower)
    || /\b(?:for|set\s+timer\s+for)\s+\d+\s*(?:minutes?|mins?|hours?|hrs?)\b/i.test(lower);

  if (!hasExplicitKeyword && !hasRelativeTime) return null;

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

  // Check for time of day - extract ALL explicit times, then fall back to vague keywords
  const parseTimeToken = (match: RegExpMatchArray, type: 'colon' | 'simple' | '24h'): string | null => {
    if (type === 'colon') {
      let hours = parseInt(match[1]);
      const minutes = match[2];
      const ampm = match[3].replace(/\./g, '').toLowerCase();
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    } else if (type === 'simple') {
      let hours = parseInt(match[1]);
      const ampm = match[2].replace(/\./g, '').toLowerCase();
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:00`;
    } else if (type === '24h') {
      const hours = parseInt(match[1]);
      const minutes = match[2];
      if (hours >= 0 && hours <= 23) {
        return `${hours.toString().padStart(2, '0')}:${minutes}`;
      }
    }
    return null;
  };

  const extractAllTimes = (text: string): string[] => {
    const times: string[] = [];

    // Match all "11:30 a.m.", "2:00 PM", "11:30am" occurrences
    const colonMatches = [...text.matchAll(/(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)/gi)];
    for (const m of colonMatches) {
      const t = parseTimeToken(m, 'colon');
      if (t) times.push(t);
    }

    // Match all "11 a.m.", "2 p.m.", "11am", "2PM" occurrences (skip if already captured with colon)
    const simpleMatches = [...text.matchAll(/(\d{1,2})\s*([ap]\.?m\.?)/gi)];
    for (const m of simpleMatches) {
      // Skip if this was part of a colon match (e.g., "30 a.m." from "11:30 a.m.")
      const t = parseTimeToken(m, 'simple');
      if (t && !times.includes(t)) times.push(t);
    }

    // Match "at 11:30" (24h format, no am/pm)
    const time24Matches = [...text.matchAll(/\bat\s+(\d{1,2}):(\d{2})\b/gi)];
    for (const m of time24Matches) {
      const t = parseTimeToken(m, '24h');
      if (t && !times.includes(t)) times.push(t);
    }

    // Fallback to vague time-of-day keywords only if no explicit times found
    if (times.length === 0) {
      if (/\bmorning\b/i.test(text)) times.push('09:00');
      else if (/\bafternoon\b/i.test(text)) times.push('14:00');
      else if (/\bevening\b/i.test(text)) times.push('18:00');
      else if (/\bnight\b/i.test(text)) times.push('20:00');
      else if (/\bnoon\b/i.test(text)) times.push('12:00');
    }

    return times;
  };

  const allTimes = extractAllTimes(lower);
  if (allTimes.length > 0) {
    reminder.recurrenceTime = allTimes[0];
    if (allTimes.length > 1) {
      reminder.additionalTimes = allTimes;
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

  // Check for relative time expressions: "in X mins", "after X minutes", "in X hours"
  // These patterns handle voice notes like "remind in 45 mins" or "remind me after 2 hours"
  const relativeTimePatterns = [
    // "in X minutes/mins/min"
    { pattern: /\b(?:in|after)\s+(\d+)\s*(?:minutes?|mins?)\b/i, unit: 'minutes' as const },
    // "in X hours/hour/hrs/hr"
    { pattern: /\b(?:in|after)\s+(\d+)\s*(?:hours?|hrs?)\b/i, unit: 'hours' as const },
    // "in X days" (relative, not "X days before")
    { pattern: /\b(?:in|after)\s+(\d+)\s*days?\b/i, unit: 'days' as const },
    // Word numbers: "in thirty minutes", "in an hour"
    { pattern: /\b(?:in|after)\s+(?:a|an|one)\s*(?:hour|hr)\b/i, unit: 'hours' as const, amount: 1 },
    { pattern: /\b(?:in|after)\s+(?:half\s+(?:an?\s+)?hour|30\s*mins?)\b/i, unit: 'minutes' as const, amount: 30 },
    // Common word numbers
    { pattern: /\b(?:in|after)\s+(fifteen|fifteen)\s*(?:minutes?|mins?)\b/i, unit: 'minutes' as const, amount: 15 },
    { pattern: /\b(?:in|after)\s+(thirty)\s*(?:minutes?|mins?)\b/i, unit: 'minutes' as const, amount: 30 },
    { pattern: /\b(?:in|after)\s+(forty-?five|45)\s*(?:minutes?|mins?)\b/i, unit: 'minutes' as const, amount: 45 },
    { pattern: /\b(?:in|after)\s+(two)\s*(?:hours?|hrs?)\b/i, unit: 'hours' as const, amount: 2 },
    { pattern: /\b(?:in|after)\s+(three)\s*(?:hours?|hrs?)\b/i, unit: 'hours' as const, amount: 3 },
  ];

  for (const { pattern, unit, amount: fixedAmount } of relativeTimePatterns) {
    const match = lower.match(pattern);
    if (match) {
      const amount = fixedAmount !== undefined ? fixedAmount : parseInt(match[1]);
      if (!isNaN(amount) && amount > 0) {
        const { date, time } = calculateRelativeTime(amount, unit);
        reminder.reminderType = 'one-time';
        reminder.eventDate = date;
        reminder.recurrenceTime = time;
        console.log(`[detectReminderLocally] Detected relative time: ${amount} ${unit} -> ${date} ${time}`);
        break; // Use first match
      }
    }
  }

  // Default to one-time if no type detected
  if (!reminder.reminderType) {
    reminder.reminderType = 'one-time';
  }

  return reminder;
};

// Local detection of place intent (e.g., "I want to go to a salon")
const PLACE_TYPE_KEYWORDS = [
  'salon', 'barbershop', 'spa', 'dentist', 'doctor', 'hospital', 'clinic',
  'restaurant', 'cafe', 'coffee shop', 'bar', 'pub', 'brewery',
  'gym', 'yoga studio', 'fitness center',
  'mechanic', 'auto shop', 'car wash',
  'hotel', 'motel',
  'park', 'beach', 'trail',
  'store', 'shop', 'mall', 'market',
  'theater', 'cinema', 'museum', 'gallery',
  'vet', 'veterinarian', 'pet store',
  'tailor', 'dry cleaner', 'laundromat',
  'library', 'bookstore',
  'bank', 'atm', 'post office',
];

const detectPlaceIntentLocally = (transcript: string): PlaceIntent => {
  const lower = transcript.toLowerCase();

  // Patterns that indicate wanting to visit a place
  const intentPatterns = [
    /(?:want|wanna|need|looking|searching)\s+(?:to\s+)?(?:go\s+to\s+|find\s+|visit\s+)?(?:a\s+|an\s+)?(?:good\s+|nice\s+|great\s+|the\s+best\s+)?(.+?)(?:\s+near(?:by)?|\s+around|\s+close|\s+in\s+town)?$/i,
    /(?:should|let'?s|let\s+us|gotta)\s+(?:go\s+to|find|visit|try|check\s+out)\s+(?:a\s+|an\s+)?(?:good\s+|nice\s+)?(.+?)$/i,
    /(?:book|schedule)\s+(?:an?\s+)?(?:appointment\s+(?:at|with)\s+)?(?:a\s+|an\s+)?(.+?)$/i,
    /(?:i\s+need|we\s+need)\s+(?:a\s+|an\s+)?(?:good\s+|new\s+)?(.+?)$/i,
  ];

  // Check if transcript contains place-type keywords
  const matchedKeyword = PLACE_TYPE_KEYWORDS.find(kw => lower.includes(kw));

  for (const pattern of intentPatterns) {
    const match = lower.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Validate: must contain a place keyword or be a reasonable length
      if (matchedKeyword || (extracted.length > 2 && extracted.length < 50)) {
        return {
          detected: true,
          searchQuery: extracted,
          placeType: matchedKeyword || undefined,
        };
      }
    }
  }

  // Fallback: if the transcript contains a place keyword with some context
  if (matchedKeyword && /\b(go|find|visit|need|want|looking|search)\b/i.test(lower)) {
    return {
      detected: true,
      searchQuery: matchedKeyword,
      placeType: matchedKeyword,
    };
  }

  return { detected: false, searchQuery: '' };
};

export const parseNote = async (transcript: string): Promise<ParsedNote> => {
  // First, detect location category locally (no API needed)
  const { category: localCategory, items: shoppingItems } = detectLocationCategoryLocally(transcript);

  // Detect reminders locally
  const localReminder = detectReminderLocally(transcript);

  // Detect place intent locally
  const localPlaceIntent = detectPlaceIntentLocally(transcript);

  // If Claude API not configured, return simple fallback with local detection
  if (!isClaudeConfigured()) {
    console.log('Claude API not configured - using simple parsing');
    return {
      type: localReminder ? 'reminder' : 'intent',
      summary: transcript,
      locationCategory: localCategory,
      shoppingItems: shoppingItems.length > 0 ? shoppingItems : undefined,
      reminder: localReminder || undefined,
      placeIntent: localPlaceIntent.detected ? localPlaceIntent : undefined,
    };
  }

  try {
    const prompt = `Parse this voice note into structured data. Return ONLY valid JSON.

Voice note: "${transcript}"

Today's date: ${new Date().toISOString().split('T')[0]}

Return format:
{
  "type": "task" | "preference" | "intent" | "reminder",
  "activity": string (if mentioned),
  "person": string (if mentioned),
  "food": string (if mentioned),
  "time": string (if mentioned),
  "summary": string (clean one-line version - never start with "Reminder:" or "Remind me" prefix),
  "locationCategory": "shopping" | "grocery" | "pharmacy" | "health" | "errand" | "work" | "fitness" | "leaving_home" | "arriving_home" | null,
  "shoppingItems": string[] (list of items to buy, if applicable),
  "reminder": {
    "isReminder": boolean,
    "reminderType": "one-time" | "recurring",
    "eventDate": string (ISO date for one-time events, e.g. "2025-02-18"),
    "eventLocation": string (location of the event if mentioned),
    "reminderDaysBefore": number (days before to start reminding, default 1),
    "recurrencePattern": "daily" | "weekly" | "monthly" | "yearly" (for recurring),
    "recurrenceDay": number (0-6 for weekly where 0=Sunday, 1-31 for monthly),
    "recurrenceTime": string (HH:mm format, e.g. "09:00" - use the FIRST specific time mentioned),
    "additionalTimes": string[] (all mentioned times in HH:mm format, when multiple times exist, e.g. ["11:00", "14:00"]),
    "reminderSummary": string (what to remind about)
  } (only if this is a reminder),
  "placeIntent": {
    "detected": boolean,
    "searchQuery": string (the place/business type to search for nearby),
    "placeType": string (specific business type if clear)
  } (only if user wants to find/visit a place)
}

Reminder Detection Guidelines:
- "remind me", "don't forget", "notify me" indicate reminders
- "every Monday", "every day", "weekly" = recurring reminder
- "on Feb 18th", "next Tuesday", "tomorrow" = one-time event
- "remind me 2 days before" = reminderDaysBefore: 2
- IMPORTANT: Extract specific times when mentioned. "at 11 a.m." = "11:00", "at 2 p.m." = "14:00", "at 3:30 PM" = "15:30"
- Speech recognition may produce "a.m." or "p.m." with periods - treat the same as "am"/"pm"
- Only use vague defaults when no specific time is given: "morning" = "09:00", "afternoon" = "14:00", "evening" = "18:00"
- If multiple times are mentioned (e.g. "at 11 a.m. and 2 p.m."), use the FIRST time for recurrenceTime and put ALL times in additionalTimes array
- Parse dates relative to today's date
- RELATIVE TIME: "in X minutes/mins", "after X hours", "in 45 mins" = calculate eventDate and recurrenceTime from current time + offset. Current time: ${new Date().toISOString()}

Location Category Guidelines:
- "grocery": food items, household supplies
- "shopping": general retail
- "pharmacy": medicine, health products
- "health": doctor appointments, medical visits
- "errand": post office, bank, dry cleaning
- "work": work-related tasks
- "fitness": gym, workout, exercise
- "leaving_home": things to remember when leaving home/house, going out, before I leave
- "arriving_home": things to do when getting home, arriving back, once I'm home

Examples:
"Remind me every Monday morning to post on LinkedIn" -> {"type": "reminder", "summary": "Post on LinkedIn", "reminder": {"isReminder": true, "reminderType": "recurring", "recurrencePattern": "weekly", "recurrenceDay": 1, "recurrenceTime": "09:00", "reminderSummary": "Post on LinkedIn"}}
"Do laundry tomorrow at 11 a.m. and 2 p.m." -> {"type": "reminder", "summary": "Do laundry", "reminder": {"isReminder": true, "reminderType": "one-time", "eventDate": "TOMORROW_DATE", "recurrenceTime": "11:00", "additionalTimes": ["11:00", "14:00"], "reminderSummary": "Do laundry"}}
"I have an event on Feb 18th, remind me 2 days before" -> {"type": "reminder", "summary": "Event on Feb 18th", "reminder": {"isReminder": true, "reminderType": "one-time", "eventDate": "2025-02-18", "reminderDaysBefore": 2, "reminderSummary": "Event on Feb 18th"}}
"Remind me in 45 minutes to take medicine" -> {"type": "reminder", "summary": "Take medicine", "reminder": {"isReminder": true, "reminderType": "one-time", "eventDate": "TODAY_DATE", "recurrenceTime": "CURRENT_TIME_PLUS_45_MINS", "reminderSummary": "Take medicine"}}
"Remind me after 2 hours to call mom" -> {"type": "reminder", "summary": "Call mom", "reminder": {"isReminder": true, "reminderType": "one-time", "eventDate": "TODAY_OR_TOMORROW_DATE", "recurrenceTime": "CURRENT_TIME_PLUS_2_HOURS", "reminderSummary": "Call mom"}}
"I'm out of milk" -> {"type": "task", "summary": "Buy: milk", "locationCategory": "grocery", "shoppingItems": ["milk"]}
"I want to go to a salon" -> {"type": "intent", "summary": "Visit a salon", "placeIntent": {"detected": true, "searchQuery": "salon", "placeType": "salon"}}
"Need to find a good dentist" -> {"type": "intent", "summary": "Find a dentist", "placeIntent": {"detected": true, "searchQuery": "good dentist", "placeType": "dentist"}}`;

    const parsed = await callAIForJSON(prompt);

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
    // Use local place intent detection as fallback
    if (!parsed.placeIntent?.detected && localPlaceIntent.detected) {
      parsed.placeIntent = localPlaceIntent;
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
      placeIntent: localPlaceIntent.detected ? localPlaceIntent : undefined,
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
  // Check if AI API is configured
  if (!isAIConfigured()) {
    throw new Error('DeepSeek API key not configured. Please add your key to config/env.ts');
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

    const prompt = `You are a personalized place recommendation assistant. Suggest 5-8 places that match this user's interests and personality.

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
Sources: notes (from their voice notes), personality (from their profile), trending (discovery)`;

    return await callAIForJSON<PlaceSuggestion[]>(prompt, { maxTokens: 4096 });
  } catch (error) {
    console.error('Failed to generate place suggestions:', error);
    throw error;
  }
};

// Keep the old function for backwards compatibility but mark as deprecated
/** @deprecated Use generatePlaceSuggestions instead */
export const generateWeekendPlans = generatePlaceSuggestions as any;