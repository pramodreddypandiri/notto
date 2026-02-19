/**
 * Onboarding Notification Service
 *
 * For the first 7 days after signup, sends up to 2 notifications per day.
 * Each one highlights a different app feature, written by AI in a funny/compelling tone.
 * Tapping a notification deep-links to the relevant tab.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { callAIForJSON, isAIConfigured } from './aiService';
import { supabase } from '../config/supabase';

// ============================================================
// Constants
// ============================================================

const KEYS = {
  SCHEDULED:  '@onboarding_notifs_scheduled',
  IDS:        '@onboarding_notif_ids',
  AI_CONTENT: '@onboarding_ai_content',
};

const ONBOARDING_DAYS = 7;
const MORNING_HOUR   = 10; // 10 AM local
const EVENING_HOUR   = 19; // 7 PM local

// ============================================================
// Slot definitions — 2 per day × 7 days = 14 total
// ============================================================

interface Slot {
  dayOffset: number; // days after signup (0 = signup day)
  hour: number;      // local 24h hour
  feature: string;   // matches AI content key
  targetTab: string; // Expo Router path
}

const SLOTS: Slot[] = [
  { dayOffset: 0, hour: MORNING_HOUR, feature: 'voice_notes',          targetTab: '/(tabs)/'         },
  { dayOffset: 0, hour: EVENING_HOUR, feature: 'tasks',                targetTab: '/(tabs)/reminders'},
  { dayOffset: 1, hour: MORNING_HOUR, feature: 'reminders',            targetTab: '/(tabs)/reminders'},
  { dayOffset: 1, hour: EVENING_HOUR, feature: 'location_tasks',       targetTab: '/(tabs)/reminders'},
  { dayOffset: 2, hour: MORNING_HOUR, feature: 'photo_journal',        targetTab: '/(tabs)/journal'  },
  { dayOffset: 2, hour: EVENING_HOUR, feature: 'food_tracking',        targetTab: '/(tabs)/journal'  },
  { dayOffset: 3, hour: MORNING_HOUR, feature: 'ai_food_analysis',     targetTab: '/(tabs)/journal'  },
  { dayOffset: 3, hour: EVENING_HOUR, feature: 'selfie_tracking',      targetTab: '/(tabs)/journal'  },
  { dayOffset: 4, hour: MORNING_HOUR, feature: 'morning_notifications', targetTab: '/(tabs)/'        },
  { dayOffset: 4, hour: EVENING_HOUR, feature: 'bedtime_reminders',    targetTab: '/(tabs)/reminders'},
  { dayOffset: 5, hour: MORNING_HOUR, feature: 'ai_insights',          targetTab: '/(tabs)/'         },
  { dayOffset: 5, hour: EVENING_HOUR, feature: 'recurring_reminders',  targetTab: '/(tabs)/reminders'},
  { dayOffset: 6, hour: MORNING_HOUR, feature: 'task_completion',      targetTab: '/(tabs)/reminders'},
  { dayOffset: 6, hour: EVENING_HOUR, feature: 'app_learning',         targetTab: '/(tabs)/'         },
];

// ============================================================
// Fallback content (when AI is unavailable)
// ============================================================

interface NotifContent { title: string; body: string }

const FALLBACK: Record<string, NotifContent> = {
  voice_notes:           { title: 'Your thumbs can finally rest 😌',        body: 'Just talk — we turn your voice into organized notes instantly. Try it right now.' },
  tasks:                 { title: 'We caught that mumble 👀',               body: 'Next time you mutter "I should really do that", we\'ll schedule it as a task.' },
  reminders:             { title: 'Remember that thing you forgot? 😬',     body: 'Next time just say "remind me". We handle the when, the where, and the how.' },
  location_tasks:        { title: 'Remembered at home. Classic. 🥛',        body: 'We can remind you AT the store. Say "remind me to buy milk at Kroger".' },
  photo_journal:         { title: 'Your wellness story, one snap at a time', body: 'Food, selfies, anything. Your AI journal builds quietly in the background.' },
  food_tracking:         { title: 'What did you actually eat today? 🤔',    body: 'Snap a meal photo — no calorie counting. Just patterns. It really adds up.' },
  ai_food_analysis:      { title: 'Your eating habits have secrets 📊',     body: 'A few food photos in and we\'ll tell you something interesting about your diet.' },
  selfie_tracking:       { title: 'Selfie for science, not Instagram 🤳',   body: 'Regular selfies show wellness trends you\'d never notice alone. Try one week.' },
  morning_notifications: { title: 'Mornings just got smarter ☀️',           body: 'A personalized nudge each morning — based on YOUR tasks, YOUR day. Not generic.' },
  bedtime_reminders:     { title: 'That thing you didn\'t finish 🌙',       body: 'We\'ll give you a gentle bedtime nudge. Like a caring friend, but less annoying.' },
  ai_insights:           { title: 'The AI is watching. Helpfully. 👁️',     body: 'The more you use the app, the better it understands your patterns and habits.' },
  recurring_reminders:   { title: 'Habits need repetition ♻️',              body: 'Say "every Monday remind me to..." and we\'ll make sure it actually happens.' },
  task_completion:       { title: 'That checkmark dopamine hit ✅',         body: 'Completing tasks in this app is unreasonably satisfying. Seriously, go try it.' },
  app_learning:          { title: 'Day 7: the app knows you now 🧠',        body: 'Keep going. The more you share, the smarter it gets — and the more useful it is.' },
};

// ============================================================
// AI content generation
// ============================================================

async function generateContent(): Promise<Record<string, NotifContent>> {
  // Return cached content if already generated
  const cached = await AsyncStorage.getItem(KEYS.AI_CONTENT);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* fall through */ }
  }

  if (!isAIConfigured()) return FALLBACK;

  try {
    const result = await callAIForJSON<{ notifications: Array<{ feature: string; title: string; body: string }> }>(
      `You are writing push notifications for a personal AI voice assistant app.
These 14 notifications go to brand-new users during their first week to get them to explore features.
Goal: make them laugh, feel FOMO, and tap to open the app immediately.
Be witty, human, and relatable — NOT corporate or generic.

Write one notification per feature below. Vary the tone: some funny, some teasing, some inspiring.

Features (write in this exact order):
1. voice_notes – capture notes just by talking, zero typing
2. tasks – app auto-creates tasks from natural speech
3. reminders – set time-based reminders by just saying it
4. location_tasks – get reminded of tasks when you physically arrive at a place
5. photo_journal – photo-based personal health journal
6. food_tracking – snap meal photos to track diet without calorie counting
7. ai_food_analysis – AI gives personalized nutrition insights after a few food photos
8. selfie_tracking – regular selfies help AI track your wellness trends over time
9. morning_notifications – personalized morning nudge based on your actual day ahead
10. bedtime_reminders – gentle pre-sleep reminder for pending tasks
11. ai_insights – app learns your habits and gives increasingly personal insights
12. recurring_reminders – set habits like "every Monday remind me to check emails"
13. task_completion – satisfying progress tracking as you complete tasks
14. app_learning – the more you use it, the smarter and more personal it gets

Rules:
- Title: max 50 chars. Body: max 110 chars.
- Funny, punchy, makes user want to tap RIGHT NOW.
- 1–2 emojis max per notification. No corporate speak.
- Make each one feel different — don't repeat the same structure.

Return ONLY valid JSON:
{"notifications":[{"feature":"voice_notes","title":"...","body":"..."},{"feature":"tasks","title":"...","body":"..."},...]}`,
      { maxTokens: 1000 },
    );

    const contentMap: Record<string, NotifContent> = { ...FALLBACK };
    for (const item of (result.notifications ?? [])) {
      if (item.feature && item.title && item.body) {
        contentMap[item.feature] = { title: item.title, body: item.body };
      }
    }

    await AsyncStorage.setItem(KEYS.AI_CONTENT, JSON.stringify(contentMap));
    console.log('[OnboardingNotifications] AI content generated and cached');
    return contentMap;
  } catch (error) {
    console.error('[OnboardingNotifications] AI generation failed — using fallback:', error);
    return FALLBACK;
  }
}

// ============================================================
// Android channel
// ============================================================

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('onboarding', {
      name: 'Getting Started',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
    });
  }
}

// ============================================================
// Public API
// ============================================================

interface ScheduledOnboardingNotif {
  id: string;
  feature: string;
  targetTab: string;
  scheduledFor: string;
}

/**
 * Schedule onboarding notifications for new users.
 * Safe to call on every login — internally runs only once per install.
 */
export async function scheduleOnboardingNotifications(): Promise<void> {
  try {
    // Run only once (flag survives app restarts, cleared on new install)
    const alreadyScheduled = await AsyncStorage.getItem(KEYS.SCHEDULED);
    if (alreadyScheduled) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now        = new Date();
    const signupDate = new Date(user.created_at);

    // Check if still within the 7-day onboarding window
    const daysSinceSignup = (now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceSignup >= ONBOARDING_DAYS) {
      await AsyncStorage.setItem(KEYS.SCHEDULED, 'done');
      console.log('[OnboardingNotifications] Past 7-day window — skipping');
      return;
    }

    await ensureAndroidChannel();

    // Generate (or load cached) AI-written content
    const content = await generateContent();

    // Midnight of signup day (local time) as base for day offsets
    const signupMidnight = new Date(signupDate);
    signupMidnight.setHours(0, 0, 0, 0);

    const scheduled: ScheduledOnboardingNotif[] = [];

    for (const slot of SLOTS) {
      const fireAt = new Date(signupMidnight);
      fireAt.setDate(fireAt.getDate() + slot.dayOffset);
      fireAt.setHours(slot.hour, 0, 0, 0);

      // Skip slots already in the past
      if (fireAt <= now) continue;

      const secondsUntil = Math.floor((fireAt.getTime() - now.getTime()) / 1000);
      if (secondsUntil <= 0) continue;

      const { title, body } = content[slot.feature] ?? FALLBACK[slot.feature];

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data: {
            type:      'onboarding',
            feature:   slot.feature,
            targetTab: slot.targetTab,
          },
          ...(Platform.OS === 'android' && { channelId: 'onboarding' }),
        },
        trigger: {
          type:    Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsUntil,
        },
      });

      scheduled.push({ id, feature: slot.feature, targetTab: slot.targetTab, scheduledFor: fireAt.toISOString() });
      console.log(`[OnboardingNotifications] "${slot.feature}" → ${fireAt.toLocaleString()}`);
    }

    await AsyncStorage.setItem(KEYS.IDS, JSON.stringify(scheduled));
    await AsyncStorage.setItem(KEYS.SCHEDULED, 'done');
    console.log(`[OnboardingNotifications] ${scheduled.length} notifications scheduled`);
  } catch (error) {
    console.error('[OnboardingNotifications] Scheduling failed:', error);
  }
}

/**
 * Cancel all scheduled onboarding notifications and reset state.
 * Call this only if you want to fully reset (e.g. after logout on a new account).
 */
export async function cancelOnboardingNotifications(): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(KEYS.IDS);
    if (data) {
      const ids: ScheduledOnboardingNotif[] = JSON.parse(data);
      await Promise.all(ids.map(n =>
        Notifications.cancelScheduledNotificationAsync(n.id).catch(() => {})
      ));
    }
    await AsyncStorage.removeItem(KEYS.IDS);
    await AsyncStorage.removeItem(KEYS.SCHEDULED);
    console.log('[OnboardingNotifications] Cancelled and reset');
  } catch {
    // ignore
  }
}

export default { scheduleOnboardingNotifications, cancelOnboardingNotifications };
