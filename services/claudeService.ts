import { buildAIProfileContext } from './profileService';
import { ENV } from '../config/env';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

interface ParsedNote {
  type: 'task' | 'preference' | 'intent';
  activity?: string;
  person?: string;
  food?: string;
  time?: string;
  summary: string;
}

// Check if Claude API is configured
const isClaudeConfigured = (): boolean => {
  return !!(ENV.CLAUDE_API_KEY && ENV.CLAUDE_API_KEY !== 'sk-ant-YOUR_CLAUDE_API_KEY_HERE');
};

export const parseNote = async (transcript: string): Promise<ParsedNote> => {
  // If Claude API not configured, return simple fallback
  if (!isClaudeConfigured()) {
    console.log('Claude API not configured - using simple parsing');
    return {
      type: 'intent',
      summary: transcript,
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
  "summary": string (clean one-line version)
}

Examples:
"I want to go bowling" -> {"type": "intent", "activity": "bowling", "summary": "Want to: go bowling"}
"Email Jack about interview on Thursday" -> {"type": "task", "person": "Jack", "time": "Thursday", "summary": "Email Jack about interview"}
"I like eating ice cream at night" -> {"type": "preference", "food": "ice cream", "time": "night", "summary": "Likes: ice cream at night"}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const content = data.content[0].text;
    
    // Remove markdown code blocks if present
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse note:', error);
    // Fallback
    return {
      type: 'intent',
      summary: transcript,
    };
  }
};

export const generateWeekendPlans = async (
  notes: any[],
  userLocation: { lat: number; lng: number; city: string },
  pastFeedback?: any[]
): Promise<any[]> => {
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

    const feedbackContext = pastFeedback
      ?.map(f => `Plan ${f.plan_id}: ${f.rating} (${f.reason || 'no reason'})`)
      .join('\n') || 'No previous feedback';

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
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
          },
        ],
        messages: [
          {
            role: 'user',
            content: `You are a weekend planning assistant. Generate 2-3 complete weekend plans that are PERSONALIZED to this user's personality and preferences.

${profileContext}

---

USER LOCATION: ${userLocation.city} (${userLocation.lat}, ${userLocation.lng})

USER'S NOTES FROM THIS WEEK:
${notesContext}

PAST FEEDBACK:
${feedbackContext}

---

PERSONALIZATION GUIDELINES:
- Match activity energy to their energy level preference
- Choose venues sized for their typical group
- Select places within their budget comfort level
- Schedule during their preferred time of day
- Avoid anything they've expressed dislike for
- Include their known interests when possible
- Match the pace to their preference (relaxed vs packed)
- Consider their social openness when suggesting new places

TASK:
1. Search for real places in ${userLocation.city} that match their interests AND personality
2. Create 2-3 complete plans with:
   - Timeline (start/end times matching their time preference)
   - Sequence of activities (2-4 activities per plan, matching their pace preference)
   - Actual place names and locations
   - Brief reasoning (why this matches BOTH their notes AND personality)
3. Each plan should be 3-5 hours total
4. Consider: open hours, distance between places, activity flow, crowd levels, budget

Return ONLY valid JSON array:
[
  {
    "title": "Saturday Evening Adventure",
    "date": "Saturday",
    "startTime": "6:00 PM",
    "endTime": "10:00 PM",
    "activities": [
      {
        "time": "6:00 PM",
        "name": "Lucky Strike Bowling",
        "address": "123 Main St",
        "type": "activity",
        "duration": "1.5 hours",
        "priceRange": "$$",
        "crowdLevel": "moderate"
      },
      {
        "time": "8:30 PM",
        "name": "Giordano's Pizza",
        "address": "456 Elm St",
        "type": "food",
        "duration": "1 hour",
        "priceRange": "$$",
        "crowdLevel": "moderate"
      }
    ],
    "reasoning": "You mentioned wanting bowling, and as an introvert who prefers moderate crowds, this smaller bowling alley is perfect",
    "totalDistance": "2.3 miles",
    "matchScore": 92
  }
]`,
          },
        ],
      }),
    });

    const data = await response.json();
    
    // Extract text content from all blocks
    let fullText = '';
    for (const block of data.content) {
      if (block.type === 'text') {
        fullText += block.text;
      }
    }
    
    // Remove markdown code blocks
    const jsonStr = fullText.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to generate plans:', error);
    throw error;
  }
};