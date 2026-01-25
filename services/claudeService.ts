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

interface ParsedNote {
  type: 'task' | 'preference' | 'intent';
  activity?: string;
  person?: string;
  food?: string;
  time?: string;
  summary: string;
  locationCategory?: NoteLocationCategory;
  shoppingItems?: string[];
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

export const parseNote = async (transcript: string): Promise<ParsedNote> => {
  // First, detect location category locally (no API needed)
  const { category: localCategory, items: shoppingItems } = detectLocationCategoryLocally(transcript);

  // If Claude API not configured, return simple fallback with local detection
  if (!isClaudeConfigured()) {
    console.log('Claude API not configured - using simple parsing');
    return {
      type: 'intent',
      summary: transcript,
      locationCategory: localCategory,
      shoppingItems: shoppingItems.length > 0 ? shoppingItems : undefined,
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

Return format:
{
  "type": "task" | "preference" | "intent",
  "activity": string (if mentioned),
  "person": string (if mentioned),
  "food": string (if mentioned),
  "time": string (if mentioned),
  "summary": string (clean one-line version),
  "locationCategory": "shopping" | "grocery" | "pharmacy" | "health" | "errand" | "work" | "fitness" | null,
  "shoppingItems": string[] (list of items to buy, if applicable)
}

Location Category Guidelines:
- "grocery": food items, household supplies (milk, eggs, bread, etc.)
- "shopping": general retail (clothes, electronics, etc.)
- "pharmacy": medicine, health products, prescriptions
- "health": doctor appointments, medical visits
- "errand": post office, bank, dry cleaning, car service
- "work": work-related tasks
- "fitness": gym, workout, exercise
- null: no specific location trigger

Examples:
"I want to go bowling" -> {"type": "intent", "activity": "bowling", "summary": "Want to: go bowling", "locationCategory": null}
"I'm out of milk and eggs" -> {"type": "task", "food": "milk, eggs", "summary": "Buy: milk and eggs", "locationCategory": "grocery", "shoppingItems": ["milk", "eggs"]}
"Need cold medicine" -> {"type": "task", "summary": "Buy: cold medicine", "locationCategory": "pharmacy"}
"Running low on toilet paper" -> {"type": "task", "summary": "Buy: toilet paper", "locationCategory": "grocery", "shoppingItems": ["toilet paper"]}`,
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

    return parsed;
  } catch (error) {
    console.error('Failed to parse note:', error);
    // Fallback with local detection
    return {
      type: 'intent',
      summary: transcript,
      locationCategory: localCategory,
      shoppingItems: shoppingItems.length > 0 ? shoppingItems : undefined,
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