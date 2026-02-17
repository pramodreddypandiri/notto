/**
 * Journal Insights Service - AI-powered insights from photo journal
 *
 * Handles:
 * - Generating insights using Claude API
 * - Caching insights locally
 * - Category-specific suggestions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildAIProfileContext } from './profileService';
import { JournalPhoto, JournalStats, getRecentPhotos, getStats } from './journalService';
import { isAIConfigured, callAIForJSON } from './aiService';

const INSIGHTS_CACHE_KEY = '@journal_insights_cache';
const INSIGHTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Insight categories matching the UI
export type InsightCategory = 'food' | 'you' | 'other';

// Individual insight
export interface Insight {
  category: InsightCategory;
  understanding: string; // AI's understanding of patterns
  suggestions: string[]; // Actionable suggestions for well-being
  updatedAt: string;
}

// Cached insights
interface InsightsCache {
  insights: Insight[];
  generatedAt: string;
}

/**
 * Check if AI API is configured
 */
const isClaudeConfigured = isAIConfigured;

/**
 * Get cached insights if still valid
 */
async function getCachedInsights(): Promise<InsightsCache | null> {
  try {
    const data = await AsyncStorage.getItem(INSIGHTS_CACHE_KEY);
    if (!data) return null;

    const cache: InsightsCache = JSON.parse(data);
    const cacheAge = Date.now() - new Date(cache.generatedAt).getTime();

    if (cacheAge > INSIGHTS_CACHE_TTL) {
      return null; // Cache expired
    }

    return cache;
  } catch (error) {
    console.error('Failed to get cached insights:', error);
    return null;
  }
}

/**
 * Save insights to cache
 */
async function cacheInsights(insights: Insight[]): Promise<void> {
  try {
    const cache: InsightsCache = {
      insights,
      generatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(INSIGHTS_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to cache insights:', error);
  }
}

/**
 * Generate fallback insights when API is unavailable
 */
function generateFallbackInsights(stats: JournalStats, photos: JournalPhoto[]): Insight[] {
  const now = new Date();
  const insights: Insight[] = [];

  // Food insights
  const foodPhotos = photos.filter(p => p.category === 'food');
  const foodUnderstanding = foodPhotos.length > 0
    ? `You've logged ${stats.foodCount} food photos. Recent meals include: ${foodPhotos.slice(0, 3).map(p => p.caption || 'meal').join(', ')}.`
    : 'No food photos logged yet. Start tracking your meals to get personalized nutrition insights.';

  const foodSuggestions: string[] = [];
  if (stats.foodCount === 0) {
    foodSuggestions.push('Try logging your next meal to start building a food journal');
  } else if (stats.foodCount < 5) {
    foodSuggestions.push('Keep logging meals to build a complete picture of your eating habits');
  } else {
    foodSuggestions.push('Great job tracking your meals! Consistency helps identify patterns');
  }

  insights.push({
    category: 'food',
    understanding: foodUnderstanding,
    suggestions: foodSuggestions,
    updatedAt: now.toISOString(),
  });

  // You (selfie) insights
  const selfiePhotos = photos.filter(p => p.category === 'selfie');
  const daysSinceLastSelfie = stats.lastSelfieDate
    ? Math.floor((now.getTime() - new Date(stats.lastSelfieDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const youUnderstanding = selfiePhotos.length > 0
    ? `You've taken ${stats.selfieCount} selfies. ${daysSinceLastSelfie !== null ? `Last one was ${daysSinceLastSelfie === 0 ? 'today' : daysSinceLastSelfie === 1 ? 'yesterday' : `${daysSinceLastSelfie} days ago`}.` : ''}`
    : 'No selfies logged yet. Selfies can help track skin health and personal progress.';

  const youSuggestions: string[] = [];
  if (daysSinceLastSelfie === null || daysSinceLastSelfie > 7) {
    youSuggestions.push('Consider taking a selfie to track your well-being over time');
  } else {
    youSuggestions.push('Keep up the self-check-ins! Regular photos help spot changes');
  }

  insights.push({
    category: 'you',
    understanding: youUnderstanding,
    suggestions: youSuggestions,
    updatedAt: now.toISOString(),
  });

  // Other insights
  const otherPhotos = photos.filter(p => p.category === 'other');
  const otherUnderstanding = otherPhotos.length > 0
    ? `You've captured ${stats.otherCount} moments - places and things that bring you joy.`
    : 'Capture places you love, cute things you find, or anything that makes you smile.';

  const otherSuggestions: string[] = [];
  if (stats.otherCount < 3) {
    otherSuggestions.push('Share more of what makes you happy - it helps build your joy profile');
  } else {
    otherSuggestions.push('Your collection of happy moments is growing!');
  }

  insights.push({
    category: 'other',
    understanding: otherUnderstanding,
    suggestions: otherSuggestions,
    updatedAt: now.toISOString(),
  });

  return insights;
}

/**
 * Generate insights using Claude API
 */
export async function generateInsights(forceRefresh: boolean = false): Promise<Insight[]> {
  // Check cache first
  if (!forceRefresh) {
    const cached = await getCachedInsights();
    if (cached) {
      return cached.insights;
    }
  }

  // Get photo data
  const photos = await getRecentPhotos(14); // Last 2 weeks
  const stats = await getStats();

  // Fallback if no Claude API
  if (!isClaudeConfigured()) {
    console.log('Claude API not configured - using fallback insights');
    const fallback = generateFallbackInsights(stats, photos);
    await cacheInsights(fallback);
    return fallback;
  }

  // Fallback if no photos
  if (photos.length === 0) {
    const fallback = generateFallbackInsights(stats, photos);
    await cacheInsights(fallback);
    return fallback;
  }

  try {
    // Get user profile for personalization
    const profileContext = await buildAIProfileContext();

    // Prepare photo summaries by category
    const photoSummaries = {
      food: photos.filter(p => p.category === 'food').map(p => ({
        caption: p.caption || 'No caption',
        date: new Date(p.createdAt).toLocaleDateString(),
      })),
      selfie: photos.filter(p => p.category === 'selfie').map(p => ({
        caption: p.caption || 'No caption',
        date: new Date(p.createdAt).toLocaleDateString(),
      })),
      other: photos.filter(p => p.category === 'other').map(p => ({
        caption: p.caption || 'No caption',
        date: new Date(p.createdAt).toLocaleDateString(),
      })),
    };

    const prompt = `You are a wellness assistant analyzing a user's photo journal to provide insights and suggestions.

${profileContext}

---

PHOTO JOURNAL DATA (last 2 weeks):

FOOD PHOTOS (${photoSummaries.food.length} entries):
${photoSummaries.food.length > 0
  ? photoSummaries.food.map(p => `- ${p.date}: "${p.caption}"`).join('\n')
  : 'No food photos logged'}

SELFIES (${photoSummaries.selfie.length} entries):
${photoSummaries.selfie.length > 0
  ? photoSummaries.selfie.map(p => `- ${p.date}: "${p.caption}"`).join('\n')
  : 'No selfies logged'}

OTHER (places, cute things) (${photoSummaries.other.length} entries):
${photoSummaries.other.length > 0
  ? photoSummaries.other.map(p => `- ${p.date}: "${p.caption}"`).join('\n')
  : 'No other photos logged'}

STATS:
- Total photos: ${stats.totalPhotos}
- This week: ${stats.weeklyPhotoCount} photos
- Days since last food photo: ${stats.lastFoodDate ? Math.floor((Date.now() - new Date(stats.lastFoodDate).getTime()) / (1000 * 60 * 60 * 24)) : 'Never'}
- Days since last selfie: ${stats.lastSelfieDate ? Math.floor((Date.now() - new Date(stats.lastSelfieDate).getTime()) / (1000 * 60 * 60 * 24)) : 'Never'}

---

Generate personalized wellness insights for THREE categories. Return ONLY valid JSON:

[
  {
    "category": "food",
    "understanding": "One paragraph about what you understand from their food photos - eating patterns, variety, timing, etc.",
    "suggestions": ["2-3 actionable suggestions for improving nutrition or eating habits based on their patterns"]
  },
  {
    "category": "you",
    "understanding": "One paragraph about self-care patterns from selfies - frequency, any notes about wellness routines",
    "suggestions": ["2-3 actionable suggestions for self-care, skin health, or personal well-being"]
  },
  {
    "category": "other",
    "understanding": "One paragraph about what brings them joy based on places/things they capture",
    "suggestions": ["2-3 suggestions for activities or experiences that might boost their mood based on their interests"]
  }
]

GUIDELINES:
- Be warm and encouraging, not judgmental
- Match the user's preferred tone from their profile
- If data is sparse, encourage them to log more without being pushy
- Suggestions should be specific and actionable
- Focus on positive well-being, not criticism
- Keep understanding to 2-3 sentences max
- Keep each suggestion to 1 sentence`;

    const parsed = await callAIForJSON(prompt, { maxTokens: 2048 });
    const now = new Date().toISOString();

    const insights: Insight[] = parsed.map((item: any) => ({
      category: item.category as InsightCategory,
      understanding: item.understanding,
      suggestions: item.suggestions,
      updatedAt: now,
    }));

    // Cache the insights
    await cacheInsights(insights);

    return insights;
  } catch (error) {
    console.error('Failed to generate insights:', error);
    // Return fallback on error
    const fallback = generateFallbackInsights(stats, photos);
    await cacheInsights(fallback);
    return fallback;
  }
}

/**
 * Get insights for a specific category
 */
export async function getInsightsByCategory(
  category: InsightCategory,
  forceRefresh: boolean = false
): Promise<Insight | null> {
  const insights = await generateInsights(forceRefresh);
  return insights.find(i => i.category === category) || null;
}

/**
 * Clear insights cache (useful when photos are added/deleted)
 */
export async function clearInsightsCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(INSIGHTS_CACHE_KEY);
  } catch (error) {
    console.error('Failed to clear insights cache:', error);
  }
}

export default {
  generateInsights,
  getInsightsByCategory,
  clearInsightsCache,
};
