/**
 * Profile Analysis Service - AI-powered trait inference from user notes
 *
 * Uses Claude to analyze user notes and extract:
 * - Interests and preferences
 * - Mood signals
 * - Food preferences
 * - Activity patterns
 * - Personality indicators
 */

import { supabase } from '../config/supabase';
import {
  addInferredInterest,
  addInferredDislike,
  updateMoodSignals,
  incrementActivityFrequency,
  markNotesAnalyzed,
  updateUserProfile,
  getUserProfile,
  MoodSignals,
  FoodPreferences,
} from './profileService';

// ============================================
// TYPES
// ============================================

interface AnalysisResult {
  interests: string[];
  dislikes: string[];
  mood_signals: MoodSignals;
  food_preferences: FoodPreferences;
  activities_mentioned: string[];
  personality_indicators: PersonalityIndicators;
  suggested_profile_updates: Partial<ProfileUpdates>;
}

interface PersonalityIndicators {
  energy_hints: 'low' | 'moderate' | 'high' | null;
  social_hints: 'introverted' | 'balanced' | 'extroverted' | null;
  adventure_hints: 'comfort' | 'balanced' | 'adventurous' | null;
  planning_hints: 'spontaneous' | 'balanced' | 'planner' | null;
}

interface ProfileUpdates {
  introvert_extrovert: number;
  energy_level: number;
  adventurous_comfort: number;
  spontaneous_planner: number;
  budget_sensitivity: string;
  time_preference: string;
  food_preferences: FoodPreferences;
}

interface Note {
  id: string;
  transcript: string;
  parsed_data?: {
    summary?: string;
    type?: string;
  };
  created_at: string;
}

// ============================================
// MAIN ANALYSIS FUNCTIONS
// ============================================

/**
 * Analyze recent notes and update user profile
 * Called periodically or after significant note additions
 */
export async function analyzeUserNotes(
  maxNotes: number = 20
): Promise<AnalysisResult | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get recent notes that haven't been analyzed
    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, transcript, parsed_data, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(maxNotes);

    if (error) throw error;
    if (!notes || notes.length === 0) return null;

    // Get current profile for context
    const profile = await getUserProfile();

    // Call Claude for analysis
    const analysis = await callClaudeForAnalysis(notes, profile);

    if (analysis) {
      // Apply the analysis results
      await applyAnalysisResults(analysis);
    }

    return analysis;
  } catch (error) {
    console.error('Failed to analyze user notes:', error);
    return null;
  }
}

/**
 * Analyze a single note immediately after creation
 * Lighter weight than full analysis
 */
export async function analyzeNewNote(note: Note): Promise<void> {
  try {
    const quickAnalysis = await callClaudeForQuickAnalysis(note);

    if (quickAnalysis) {
      // Add any detected interests
      for (const interest of quickAnalysis.interests) {
        await addInferredInterest(interest);
      }

      // Add any detected dislikes
      for (const dislike of quickAnalysis.dislikes) {
        await addInferredDislike(dislike);
      }

      // Track activities mentioned
      for (const activity of quickAnalysis.activities) {
        await incrementActivityFrequency(activity);
      }

      // Update mood if detected
      if (Object.keys(quickAnalysis.mood).length > 0) {
        await updateMoodSignals(quickAnalysis.mood);
      }
    }
  } catch (error) {
    console.error('Failed to analyze new note:', error);
  }
}

// ============================================
// CLAUDE API CALLS
// ============================================

/**
 * Full analysis of multiple notes
 */
async function callClaudeForAnalysis(
  notes: Note[],
  profile: any
): Promise<AnalysisResult | null> {
  try {
    // Build notes context
    const notesContext = notes
      .map((n, i) => `Note ${i + 1}: "${n.transcript}"`)
      .join('\n');

    const currentProfile = profile
      ? `Current known interests: ${profile.inferred_interests?.join(', ') || 'none yet'}`
      : 'No existing profile data.';

    const prompt = `Analyze these voice notes from a user of a weekend planning app. Extract insights about their personality, preferences, and current state.

${notesContext}

${currentProfile}

Return ONLY valid JSON in this exact format:
{
  "interests": ["interest1", "interest2"],
  "dislikes": ["dislike1"],
  "mood_signals": {
    "stress_level": "low" | "moderate" | "high" | null,
    "seeking": "relaxation" | "adventure" | "connection" | "entertainment" | null,
    "recent_theme": "string describing recurring theme" | null,
    "energy_state": "tired" | "normal" | "energized" | null
  },
  "food_preferences": {
    "favorites": ["cuisine1", "cuisine2"],
    "dietary": ["requirement1"],
    "avoid": ["food1"],
    "cuisine_adventurousness": "low" | "moderate" | "high"
  },
  "activities_mentioned": ["activity1", "activity2"],
  "personality_indicators": {
    "energy_hints": "low" | "moderate" | "high" | null,
    "social_hints": "introverted" | "balanced" | "extroverted" | null,
    "adventure_hints": "comfort" | "balanced" | "adventurous" | null,
    "planning_hints": "spontaneous" | "balanced" | "planner" | null
  },
  "suggested_profile_updates": {
    "introvert_extrovert": 1-10 | null,
    "energy_level": 1-10 | null,
    "adventurous_comfort": 1-10 | null,
    "budget_sensitivity": "budget" | "moderate" | "splurge" | null,
    "time_preference": "morning" | "afternoon" | "evening" | "night" | null
  }
}

Guidelines:
- Only include fields where you have evidence from the notes
- interests should be specific activities or things they want to do
- Be conservative with personality scores - only suggest if there's clear evidence
- Look for emotional cues for mood_signals
- Extract specific cuisine/food preferences mentioned`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Claude API error:', data.error);
      return null;
    }

    const content = data.content?.[0]?.text;
    if (!content) return null;

    // Parse JSON from response
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonStr) as AnalysisResult;
  } catch (error) {
    console.error('Failed to call Claude for analysis:', error);
    return null;
  }
}

/**
 * Quick analysis of a single note
 */
async function callClaudeForQuickAnalysis(note: Note): Promise<{
  interests: string[];
  dislikes: string[];
  activities: string[];
  mood: Partial<MoodSignals>;
} | null> {
  try {
    const prompt = `Quickly extract key information from this voice note for a weekend planning app.

Note: "${note.transcript}"

Return ONLY valid JSON:
{
  "interests": ["specific things they want to do or try"],
  "dislikes": ["things they don't want"],
  "activities": ["activities mentioned: bowling, dining, movies, etc"],
  "mood": {
    "stress_level": "low" | "moderate" | "high" | null,
    "seeking": "what they seem to want" | null
  }
}

Only include items with clear evidence. Keep arrays short and specific.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Claude API error:', data.error);
      return null;
    }

    const content = data.content?.[0]?.text;
    if (!content) return null;

    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to call Claude for quick analysis:', error);
    return null;
  }
}

// ============================================
// APPLY ANALYSIS RESULTS
// ============================================

/**
 * Apply analysis results to user profile
 */
async function applyAnalysisResults(analysis: AnalysisResult): Promise<void> {
  try {
    // Add interests
    for (const interest of analysis.interests) {
      await addInferredInterest(interest);
    }

    // Add dislikes
    for (const dislike of analysis.dislikes) {
      await addInferredDislike(dislike);
    }

    // Update mood signals
    if (Object.keys(analysis.mood_signals).length > 0) {
      await updateMoodSignals(analysis.mood_signals);
    }

    // Track activities
    for (const activity of analysis.activities_mentioned) {
      await incrementActivityFrequency(activity);
    }

    // Apply suggested profile updates
    const updates: any = {};

    if (analysis.suggested_profile_updates) {
      const suggestions = analysis.suggested_profile_updates;

      if (suggestions.introvert_extrovert !== undefined && suggestions.introvert_extrovert !== null) {
        updates.introvert_extrovert = suggestions.introvert_extrovert;
      }
      if (suggestions.energy_level !== undefined && suggestions.energy_level !== null) {
        updates.energy_level = suggestions.energy_level;
      }
      if (suggestions.adventurous_comfort !== undefined && suggestions.adventurous_comfort !== null) {
        updates.adventurous_comfort = suggestions.adventurous_comfort;
      }
      if (suggestions.budget_sensitivity) {
        updates.budget_sensitivity = suggestions.budget_sensitivity;
      }
      if (suggestions.time_preference) {
        updates.time_preference = suggestions.time_preference;
      }
    }

    // Apply food preferences
    if (analysis.food_preferences && Object.keys(analysis.food_preferences).length > 0) {
      updates.food_preferences = analysis.food_preferences;
    }

    // Update profile if we have updates
    if (Object.keys(updates).length > 0) {
      await updateUserProfile(updates);
    }

    // Mark notes as analyzed
    await markNotesAnalyzed(1);
  } catch (error) {
    console.error('Failed to apply analysis results:', error);
  }
}

// ============================================
// PERIODIC ANALYSIS
// ============================================

/**
 * Check if we should run a full analysis
 * (e.g., if significant new notes since last analysis)
 */
export async function shouldRunAnalysis(): Promise<boolean> {
  try {
    const profile = await getUserProfile();
    if (!profile) return false;

    // Check time since last analysis
    if (profile.last_ai_analysis) {
      const lastAnalysis = new Date(profile.last_ai_analysis);
      const hoursSinceAnalysis = (Date.now() - lastAnalysis.getTime()) / (1000 * 60 * 60);

      // Don't analyze more than once per hour
      if (hoursSinceAnalysis < 1) return false;
    }

    // Count notes since last analysis
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { count } = await supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const newNotesCount = (count || 0) - profile.notes_analyzed_count;

    // Run analysis if 5+ new notes
    return newNotesCount >= 5;
  } catch (error) {
    console.error('Failed to check if should run analysis:', error);
    return false;
  }
}

/**
 * Run analysis if needed
 */
export async function runAnalysisIfNeeded(): Promise<void> {
  const shouldRun = await shouldRunAnalysis();
  if (shouldRun) {
    await analyzeUserNotes();
  }
}

// ============================================
// MOOD DETECTION HELPERS
// ============================================

/**
 * Quick local mood detection from text
 * Used before sending to AI for immediate feedback
 */
export function detectMoodLocally(text: string): Partial<MoodSignals> {
  const lowerText = text.toLowerCase();
  const mood: Partial<MoodSignals> = {};

  // Stress indicators
  const stressWords = ['stressed', 'exhausted', 'overwhelmed', 'busy', 'hectic', 'crazy week', 'need a break'];
  const relaxWords = ['relaxed', 'chill', 'calm', 'peaceful', 'easy'];

  if (stressWords.some(w => lowerText.includes(w))) {
    mood.stress_level = 'high';
    mood.seeking = 'relaxation';
  } else if (relaxWords.some(w => lowerText.includes(w))) {
    mood.stress_level = 'low';
  }

  // Energy indicators
  const tiredWords = ['tired', 'exhausted', 'drained', 'low energy'];
  const energizedWords = ['excited', 'pumped', 'energized', 'ready to'];

  if (tiredWords.some(w => lowerText.includes(w))) {
    mood.energy_state = 'tired';
  } else if (energizedWords.some(w => lowerText.includes(w))) {
    mood.energy_state = 'energized';
  }

  // Seeking indicators
  if (lowerText.includes('adventure') || lowerText.includes('something new') || lowerText.includes('exciting')) {
    mood.seeking = 'adventure';
  } else if (lowerText.includes('friends') || lowerText.includes('social') || lowerText.includes('people')) {
    mood.seeking = 'connection';
  } else if (lowerText.includes('fun') || lowerText.includes('entertainment')) {
    mood.seeking = 'entertainment';
  }

  return mood;
}

/**
 * Extract activities from text locally
 */
export function extractActivitiesLocally(text: string): string[] {
  const lowerText = text.toLowerCase();
  const activities: string[] = [];

  const activityKeywords: Record<string, string> = {
    'bowling': 'bowling',
    'bowl': 'bowling',
    'movie': 'movies',
    'film': 'movies',
    'cinema': 'movies',
    'restaurant': 'dining',
    'dinner': 'dining',
    'lunch': 'dining',
    'brunch': 'brunch',
    'breakfast': 'breakfast',
    'coffee': 'coffee',
    'cafe': 'coffee',
    'bar': 'drinks',
    'drinks': 'drinks',
    'cocktail': 'drinks',
    'hike': 'hiking',
    'hiking': 'hiking',
    'walk': 'walking',
    'park': 'parks',
    'museum': 'museums',
    'art': 'art',
    'gallery': 'art',
    'concert': 'live music',
    'music': 'live music',
    'show': 'entertainment',
    'theater': 'theater',
    'theatre': 'theater',
    'shopping': 'shopping',
    'shop': 'shopping',
    'spa': 'spa',
    'massage': 'spa',
    'gym': 'fitness',
    'workout': 'fitness',
    'yoga': 'yoga',
    'beach': 'beach',
    'swim': 'swimming',
    'pool': 'swimming',
    'golf': 'golf',
    'tennis': 'tennis',
    'game': 'games',
    'arcade': 'arcade',
    'escape room': 'escape room',
    'karaoke': 'karaoke',
    'cooking': 'cooking class',
    'wine': 'wine tasting',
    'brewery': 'brewery',
    'beer': 'brewery',
  };

  for (const [keyword, activity] of Object.entries(activityKeywords)) {
    if (lowerText.includes(keyword) && !activities.includes(activity)) {
      activities.push(activity);
    }
  }

  return activities;
}

/**
 * Extract food preferences from text locally
 */
export function extractFoodPreferencesLocally(text: string): Partial<FoodPreferences> {
  const lowerText = text.toLowerCase();
  const prefs: Partial<FoodPreferences> = {
    favorites: [],
    avoid: [],
    dietary: [],
  };

  const cuisines = [
    'mexican', 'italian', 'chinese', 'japanese', 'thai', 'indian',
    'korean', 'vietnamese', 'french', 'greek', 'mediterranean',
    'american', 'bbq', 'seafood', 'sushi', 'pizza', 'burgers',
    'tacos', 'ramen', 'pho', 'curry', 'steak', 'vegetarian', 'vegan'
  ];

  for (const cuisine of cuisines) {
    if (lowerText.includes(cuisine)) {
      // Check if it's in a negative context
      const negativePatterns = [
        `don't like ${cuisine}`,
        `don't want ${cuisine}`,
        `no ${cuisine}`,
        `hate ${cuisine}`,
        `avoid ${cuisine}`,
        `not ${cuisine}`,
      ];

      const isNegative = negativePatterns.some(p => lowerText.includes(p));

      if (isNegative) {
        prefs.avoid?.push(cuisine);
      } else {
        prefs.favorites?.push(cuisine);
      }
    }
  }

  // Dietary requirements
  const dietaryKeywords = ['vegetarian', 'vegan', 'gluten-free', 'gluten free', 'dairy-free', 'dairy free', 'halal', 'kosher'];
  for (const diet of dietaryKeywords) {
    if (lowerText.includes(diet)) {
      prefs.dietary?.push(diet.replace(' ', '-'));
    }
  }

  return prefs;
}

// Export
export default {
  analyzeUserNotes,
  analyzeNewNote,
  shouldRunAnalysis,
  runAnalysisIfNeeded,
  detectMoodLocally,
  extractActivitiesLocally,
  extractFoodPreferencesLocally,
};
