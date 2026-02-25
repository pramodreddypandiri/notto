/**
 * Smart Notification Engine
 *
 * Schedules three categories of intelligent notifications:
 *
 * 1. MORNING  — Daily at wake_up_time: cheerful start + prep for any location/activity tasks
 * 2. BEDTIME  — Daily at bed_time: encourages completing pending tasks before sleep
 * 3. FOOD     — Once per analysis cycle: nutrition insight based on journal food photos
 *
 * Entry point: call `rescheduleSmartNotifications()` on app open (authenticated).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getUserProfile } from './profileService';
import { getRecentPhotos } from './journalService';
import { callAIForJSON, isAIConfigured } from './aiService';
import { supabase } from '../config/supabase';

// ============================================================
// Storage keys
// ============================================================

const KEYS = {
  MORNING_ID:         '@smart_notif_morning_id',
  BEDTIME_ID:         '@smart_notif_bedtime_id',
  FOOD_INSIGHT_ID:    '@smart_notif_food_insight_id',
  LAST_RESCHEDULE:    '@smart_notif_last_reschedule',
  FOOD_ANALYSIS:      '@smart_notif_food_analysis',
  FOOD_ANALYSIS_DATE: '@smart_notif_food_analysis_date',
};

const RESCHEDULE_THROTTLE_MS = 12 * 60 * 60 * 1000; // 12 hours
const FOOD_ANALYSIS_TTL_MS   = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================
// Helpers
// ============================================================

function parseTime(timeStr: string | null): { hour: number; minute: number } {
  if (!timeStr) return { hour: 7, minute: 0 };
  const [h, m] = timeStr.split(':').map(Number);
  return { hour: isNaN(h) ? 7 : h, minute: isNaN(m) ? 0 : m };
}

/** Returns the next Date when clock shows hour:minute (today or tomorrow). */
function nextOccurrence(hour: number, minute: number): Date {
  const now = new Date();
  const t = new Date();
  t.setHours(hour, minute, 0, 0);
  if (t <= now) t.setDate(t.getDate() + 1);
  return t;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('smart_notifications', {
      name: 'Smart Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
    });
  }
}

async function cancelStored(key: string): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(key);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      await AsyncStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

async function scheduleOnce(
  storageKey: string,
  title: string,
  body: string,
  fireAt: Date,
  extraData?: Record<string, string>,
): Promise<void> {
  await cancelStored(storageKey);

  const secondsUntil = Math.floor((fireAt.getTime() - Date.now()) / 1000);
  if (secondsUntil <= 0) return;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: { type: 'smart_notification', ...extraData },
      ...(Platform.OS === 'android' && { channelId: 'smart_notifications' }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntil,
    },
  });

  await AsyncStorage.setItem(storageKey, id);
}

// ============================================================
// Storage keys for daily AI content cache
// ============================================================

const todayDateKey = () => new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
const CONTENT_CACHE_KEYS = {
  morning: () => `@smart_notif_morning_content_${todayDateKey()}`,
  bedtime: () => `@smart_notif_bedtime_content_${todayDateKey()}`,
};

// ============================================================
// Data fetchers
// ============================================================

interface TaskContext {
  transcript: string;
  event_location: string | null;
  place_search_query: string | null;
  place_intent: boolean;
}

/** Local date string YYYY-MM-DD (not UTC) */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns today's uncompleted tasks with their full context.
 *  Only includes tasks due today or with no specific date (not future-dated tasks). */
async function getTodaysTasks(): Promise<TaskContext[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const today = localToday();

    const { data } = await supabase
      .from('notes')
      .select('transcript, event_location, place_search_query, place_intent')
      .eq('user_id', user.id)
      .eq('note_type', 'task')
      .eq('is_completed', false)
      .or(`event_date.eq.${today},event_date.is.null`)
      .order('created_at', { ascending: false })
      .limit(10);

    return (data ?? []) as TaskContext[];
  } catch {
    return [];
  }
}

/** Returns pending task transcripts due today or with no specific date. */
async function getPendingTaskDetails(): Promise<{ transcripts: string[]; count: number }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { transcripts: [], count: 0 };

    const today = localToday();

    const { data, count } = await supabase
      .from('notes')
      .select('transcript', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('note_type', 'task')
      .eq('is_completed', false)
      .or(`event_date.eq.${today},event_date.is.null`)
      .order('created_at', { ascending: false })
      .limit(3);

    return {
      transcripts: (data ?? []).map((n: any) => n.transcript as string),
      count: count ?? 0,
    };
  } catch {
    return { transcripts: [], count: 0 };
  }
}

// ============================================================
// AI content generation
// ============================================================

type Tone = 'professional' | 'friendly' | 'casual' | 'motivational' | string;

interface NotifContent { title: string; body: string }

/**
 * AI writes the morning notification.
 * Passes real user context so every message feels personal and specific.
 * Result is cached per day — only one AI call per morning per user.
 */
async function generateMorningContent(
  tone: Tone,
  selfDescription: string | null,
  hobbies: string | null,
  tasks: TaskContext[],
): Promise<NotifContent> {
  // Return today's cached message if already generated
  const cacheKey = CONTENT_CACHE_KEYS.morning();
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached) as NotifContent;

  // Build task context for the AI
  const locationTask = tasks.find(t => t.event_location || t.place_intent);
  const place = locationTask?.event_location ?? locationTask?.place_search_query ?? null;
  const taskLines = tasks.slice(0, 3).map(t => `- ${t.transcript}`).join('\n');
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  if (isAIConfigured()) {
    try {
      const result = await callAIForJSON<NotifContent>(
        `You are a caring personal companion app sending a morning notification.
Write a warm, specific notification that makes the user feel understood — not a generic greeting.

User context:
- Today: ${dayName}
- Who they are: ${selfDescription || 'not set'}
- Hobbies/interests: ${hobbies || 'not set'}
- Tone preference: ${tone}
- Tasks on their mind today:
${taskLines || '(no specific tasks)'}
- Going somewhere today: ${place ? `Yes — ${place}` : 'No'}

Rules:
- Title: max 50 chars. Body: max 120 chars.
- If they have a place to go, mention it and help them feel prepared.
- If they have tasks, you can reference one specifically.
- If no tasks, reference their hobby or who they are to make it personal.
- Match the tone preference: professional=formal, friendly=warm, casual=laid-back, motivational=energetic.
- Never start with "Good morning" — be more creative.
- One emoji is fine if tone is friendly/casual/motivational.

Return ONLY valid JSON: {"title": "...", "body": "..."}`,
        { maxTokens: 150 },
      );
      await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
      return result;
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback when AI is not configured — still uses real context
  const fallback: NotifContent = place
    ? { title: `Heading to ${place} today`, body: 'You\'ve got this. Stay focused and enjoy the journey.' }
    : hobbies
    ? { title: 'A new day awaits', body: `Make time for what matters — including ${hobbies.split(',')[0].trim()}.` }
    : { title: 'Morning check-in', body: 'Take a moment to set your intention for today.' };

  await AsyncStorage.setItem(cacheKey, JSON.stringify(fallback));
  return fallback;
}

/**
 * AI writes the bedtime notification referencing the user's actual pending tasks by name.
 * This makes the reminder feel caring, not nagging.
 * Skips if no pending tasks.
 * Result is cached per day.
 */
async function generateBedtimeContent(
  tone: Tone,
  pendingTranscripts: string[],
  totalCount: number,
): Promise<NotifContent | null> {
  if (totalCount === 0) return null;

  // Return today's cached message if already generated
  const cacheKey = CONTENT_CACHE_KEYS.bedtime();
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached) as NotifContent;

  const taskLines = pendingTranscripts.map(t => `- ${t}`).join('\n');
  const remaining = totalCount > 3 ? ` (+${totalCount - 3} more)` : '';

  if (isAIConfigured()) {
    try {
      const result = await callAIForJSON<NotifContent>(
        `You are a caring personal companion app sending a gentle bedtime notification.
The user has pending tasks. Write a warm, encouraging notification — NOT nagging or guilt-inducing.
The goal is to gently remind them while acknowledging it's okay if not everything gets done tonight.

Pending tasks (top 3):
${taskLines}${remaining}

Tone preference: ${tone}

Rules:
- Title: max 50 chars. Body: max 120 chars.
- Reference 1 specific task by name if it's short and clear enough.
- Be warm, human, and caring — like a supportive friend, not a to-do list app.
- It's okay to acknowledge that rest is important too.
- Match tone: professional=calm/direct, friendly=warm, casual=relaxed, motivational=energizing.
- One emoji is fine if tone is not professional.

Return ONLY valid JSON: {"title": "...", "body": "..."}`,
        { maxTokens: 150 },
      );
      await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
      return result;
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback
  const firstTask = pendingTranscripts[0] ?? null;
  const fallback: NotifContent = firstTask
    ? { title: 'Before you sleep 🌙', body: `"${firstTask.slice(0, 60)}" is still waiting. Even a small step counts.` }
    : { title: 'Before you sleep 🌙', body: `${totalCount} tasks waiting. Rest well — tomorrow is another chance.` };

  await AsyncStorage.setItem(cacheKey, JSON.stringify(fallback));
  return fallback;
}

// ============================================================
// Food analysis
// ============================================================

interface FoodAnalysis {
  pattern: 'high_sugar' | 'repetitive' | 'missing_fiber' | 'missing_protein' | 'balanced' | 'none';
  notificationTitle: string;
  notificationBody: string;
}

async function analyzeFoodJournal(): Promise<FoodAnalysis | null> {
  try {
    // Return cached result if fresh
    const cacheDate = await AsyncStorage.getItem(KEYS.FOOD_ANALYSIS_DATE);
    if (cacheDate && Date.now() - new Date(cacheDate).getTime() < FOOD_ANALYSIS_TTL_MS) {
      const cached = await AsyncStorage.getItem(KEYS.FOOD_ANALYSIS);
      if (cached) return JSON.parse(cached) as FoodAnalysis;
    }

    if (!isAIConfigured()) return null;

    const recent = await getRecentPhotos(14);
    const foodPhotos = recent.filter(p => p.category === 'food' && p.caption?.trim());

    if (foodPhotos.length < 3) return null; // Not enough data

    const entries = foodPhotos.map(p => `- ${p.caption}`).join('\n');

    const result = await callAIForJSON<FoodAnalysis>(
      `You are a caring, non-judgmental nutrition companion. Analyze these food journal entries from the last 14 days.
Only flag a pattern if clearly present (3+ occurrences or very dominant). Be specific — reference actual foods the user ate.

Food entries (most recent first):
${entries}

Return ONLY valid JSON matching this exact shape:
{
  "pattern": "high_sugar" | "repetitive" | "missing_fiber" | "missing_protein" | "balanced" | "none",
  "notificationTitle": "max 40 characters — specific, not generic",
  "notificationBody": "under 110 characters — mention the actual food, be warm and actionable, not preachy"
}

Pattern rules and example outputs:
- "high_sugar": sweets/sodas/candy/desserts appear frequently
  → title: "Noticed a sugar pattern", body: "You've had [specific food] a few times lately. Try swapping one for fruit or nuts today."
- "repetitive": same item 3+ times
  → title: "Loving [food name]?", body: "You've had [food] quite a bit — mix in something different for better nutrition variety."
- "missing_fiber": meals rarely have vegetables, fruits, whole grains
  → title: "Your meals look light on fibre", body: "Consider adding [specific veg/grain] — it pairs well with what you've been eating."
- "missing_protein": rarely includes meat, eggs, legumes, dairy
  → title: "Protein check", body: "Your recent meals look low on protein. Adding [eggs/legumes/etc.] could help your energy."
- "balanced": diet looks varied and well-rounded
  → title: "Your diet looks great!", body: "You've been eating well and with variety. Keep it up — your body will thank you."
- "none": not enough data or no clear pattern → return empty title and body strings`,
      { maxTokens: 250 },
    );

    await AsyncStorage.setItem(KEYS.FOOD_ANALYSIS, JSON.stringify(result));
    await AsyncStorage.setItem(KEYS.FOOD_ANALYSIS_DATE, new Date().toISOString());

    return result;
  } catch (error) {
    console.error('[SmartNotifications] Food analysis failed:', error);
    return null;
  }
}

/**
 * Infer the user's meal times from food photo timestamps.
 *
 * Scans all food photo `createdAt` values, groups hours into three meal windows
 * (breakfast 5–10, lunch 11–15, dinner 16–22), and picks the modal hour within
 * each window. Returns up to three meal hours sorted ascending.
 * Falls back to [12, 19] if there is insufficient data.
 */
async function inferMealHours(): Promise<number[]> {
  try {
    const allPhotos = await getRecentPhotos(60); // 60 days for a reliable sample
    const foodHours = allPhotos
      .filter(p => p.category === 'food')
      .map(p => new Date(p.createdAt).getHours());

    if (foodHours.length < 3) return [12, 19]; // not enough data

    const WINDOWS = [
      { name: 'breakfast', min: 5,  max: 10 },
      { name: 'lunch',     min: 11, max: 15 },
      { name: 'dinner',    min: 16, max: 22 },
    ];

    const mealHours: number[] = [];

    for (const window of WINDOWS) {
      const hours = foodHours.filter(h => h >= window.min && h <= window.max);
      if (hours.length === 0) continue;

      // Modal hour within this window
      const freq: Record<number, number> = {};
      for (const h of hours) freq[h] = (freq[h] ?? 0) + 1;
      const modal = Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
      mealHours.push(modal);
    }

    return mealHours.length > 0 ? mealHours.sort((a, b) => a - b) : [12, 19];
  } catch {
    return [12, 19];
  }
}

/**
 * Returns the next Date at one of the user's inferred meal times.
 * Falls back to the next of 12pm / 7pm if no data.
 */
async function nextMealTime(): Promise<Date> {
  const mealHours = await inferMealHours();
  const now = new Date();

  // Find first meal hour still in the future today
  for (const hour of mealHours) {
    const candidate = new Date();
    candidate.setHours(hour, 0, 0, 0);
    if (candidate > now) return candidate;
  }

  // All meal times have passed today — use first meal tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(mealHours[0], 0, 0, 0);
  return tomorrow;
}

async function scheduleFoodInsight(analysis: FoodAnalysis): Promise<void> {
  if (analysis.pattern === 'none' || analysis.pattern === 'balanced') return;
  if (!analysis.notificationTitle || !analysis.notificationBody) return;

  const fireAt = await nextMealTime();

  await scheduleOnce(
    KEYS.FOOD_INSIGHT_ID,
    analysis.notificationTitle,
    analysis.notificationBody,
    fireAt,
    { notifType: 'food_insight', pattern: analysis.pattern, targetTab: '/(tabs)/journal' },
  );

  console.log(`[SmartNotifications] Food insight (${analysis.pattern}) scheduled at ${fireAt.toLocaleTimeString()}`);
}

// ============================================================
// Public API
// ============================================================

/**
 * Reschedule all smart notifications.
 * Call this on every authenticated app open — internally throttled to once per 12 hours.
 */
export async function rescheduleSmartNotifications(): Promise<void> {
  try {
    // Throttle
    const last = await AsyncStorage.getItem(KEYS.LAST_RESCHEDULE);
    if (last && Date.now() - new Date(last).getTime() < RESCHEDULE_THROTTLE_MS) {
      console.log('[SmartNotifications] Skipping — rescheduled recently');
      return;
    }

    await ensureAndroidChannel();

    const profile = await getUserProfile();
    if (!profile?.wake_up_time && !profile?.bed_time) {
      console.log('[SmartNotifications] No wake/bed times set — skipping');
      return;
    }

    const tone = profile.tone ?? 'friendly';
    const wake  = parseTime(profile.wake_up_time);
    const bed   = parseTime(profile.bed_time);

    // ── 1. Morning notification ───────────────────────────
    const todaysTasks = await getTodaysTasks();
    const { title: morningTitle, body: morningBody } = await generateMorningContent(
      tone,
      profile.self_description ?? null,
      profile.hobbies ?? null,
      todaysTasks,
    );

    await scheduleOnce(
      KEYS.MORNING_ID,
      morningTitle,
      morningBody,
      nextOccurrence(wake.hour, wake.minute),
      { notifType: 'morning', targetTab: '/(tabs)/' },
    );
    console.log(`[SmartNotifications] Morning scheduled at ${wake.hour}:${String(wake.minute).padStart(2, '0')}`);

    // ── 2. Bedtime notification ───────────────────────────
    const { transcripts: pendingTranscripts, count: pendingCount } = await getPendingTaskDetails();
    const bedContent = await generateBedtimeContent(tone, pendingTranscripts, pendingCount);

    if (bedContent) {
      await scheduleOnce(
        KEYS.BEDTIME_ID,
        bedContent.title,
        bedContent.body,
        nextOccurrence(bed.hour, bed.minute),
        { notifType: 'bedtime', targetTab: '/(tabs)/reminders' },
      );
      console.log(`[SmartNotifications] Bedtime scheduled at ${bed.hour}:${String(bed.minute).padStart(2, '0')} (${pendingCount} pending tasks)`);
    } else {
      await cancelStored(KEYS.BEDTIME_ID);
      console.log('[SmartNotifications] No pending tasks — bedtime notification skipped');
    }

    // ── 3. Food insight (async, non-blocking) ─────────────
    analyzeFoodJournal()
      .then(analysis => { if (analysis) scheduleFoodInsight(analysis); })
      .catch(err => console.error('[SmartNotifications] Food analysis error:', err));

    await AsyncStorage.setItem(KEYS.LAST_RESCHEDULE, new Date().toISOString());
    console.log('[SmartNotifications] All smart notifications rescheduled');
  } catch (error) {
    console.error('[SmartNotifications] reschedule failed:', error);
  }
}

/**
 * Cancel all smart notifications.
 * Call this on logout.
 */
export async function cancelAllSmartNotifications(): Promise<void> {
  await Promise.all([
    cancelStored(KEYS.MORNING_ID),
    cancelStored(KEYS.BEDTIME_ID),
    cancelStored(KEYS.FOOD_INSIGHT_ID),
  ]);
  console.log('[SmartNotifications] All cancelled');
}

export default {
  rescheduleSmartNotifications,
  cancelAllSmartNotifications,
};
