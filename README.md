# Notto — Voice-First Life Assist app

A mobile app that turns scattered voice notes, cravings, and to-dos into smart reminders using AI. Built with React Native + Expo, Supabase, and a DeepSeek-powered AI layer.

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Project Structure](#4-project-structure)
5. [Database Schema](#5-database-schema)
6. [Feature Specifications](#6-feature-specifications)
7. [Services Layer](#7-services-layer)
8. [Component Architecture](#8-component-architecture)
9. [Navigation & Auth Flow](#9-navigation--auth-flow)
10. [State Management](#10-state-management)
11. [Theme System](#11-theme-system)
12. [API Integrations](#12-api-integrations)
13. [Key User Flows](#13-key-user-flows)
14. [Environment Setup](#14-environment-setup)

---

## 1. Product Vision

### Core Problem

People want better weekends with less effort. They think in fragments — "I wanna go bowling", "try Mexican food", "email Jack about interview Thursday" — but no tool converts those fragments into timely reminders and actionable weekend plans without manual effort.

### What Notto Does

```
Capture  →  Interpret  →  Remind  →  Recommend  →  Learn
```

- **Capture**: Voice or text, raw and unstructured
- **Interpret**: AI extracts tasks, preferences, and intent from messy input
- **Remind**: Schedule time-based and location-triggered reminders
- **Recommend**: Generate 2–3 bundled weekend plans (not 20 search results)
- **Learn**: Feedback loop updates the user model for better future recommendations

### Design Principles

- **Voice-first**, not text-first — optimized for speaking, not typing
- **Learning system**, not static preferences — improves with every interaction
- **Productivity** - with timely reminders
- **Track food habits** - Jounral your food habits

---

## 2. Tech Stack

### Core Framework

| Technology | Version | Purpose |
|---|---|---|
| React Native | 0.81.5 | Cross-platform mobile |
| React | 19.1.0 | UI library |
| Expo | ~54.0.32 | Native APIs, build tooling |
| TypeScript | ~5.9.2 | Type safety |
| Expo Router | ~6.0.22 | File-based routing |

### Backend & Database

| Service | Purpose |
|---|---|
| Supabase | PostgreSQL + Auth + Row Level Security |
| AsyncStorage | Local cache (theme, locations, cooldowns) |

### AI & Voice

| Service | Purpose |
|---|---|
| DeepSeek API (`deepseek-chat`) | Note parsing, plan generation, profile analysis, journal insights |
| OpenAI Whisper (`whisper-1`) | Voice transcription fallback |
| Expo Speech Recognition | Native on-device speech-to-text (dev builds) |

> The AI layer is intentionally provider-agnostic — `services/aiService.ts` wraps the DeepSeek API using the OpenAI-compatible interface. Swapping providers requires changing only the URL and model constant in that file.

### Location & Notifications

| Package | Purpose |
|---|---|
| Expo Location | GPS, geofencing |
| Expo Notifications | Local push notifications |
| Expo Task Manager | Background geofence monitoring |

### UI & Styling

| Package | Purpose |
|---|---|
| NativeWind | Tailwind CSS for React Native |
| React Native Reanimated | Declarative animations |
| React Native Gesture Handler | Swipe gestures |
| Expo Haptics | Haptic feedback |
| Expo Linear Gradient | Gradient UI elements |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        UI Layer                          │
│   Expo Router screens  ·  NativeWind  ·  Reanimated     │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                    Services Layer                         │
│  notesService · reminderService · locationService        │
│  journalService · plansService · profileService          │
│  productivityService · patternsService                   │
└──────────┬──────────────┬───────────────────────────────┘
           │              │
┌──────────▼──────┐  ┌────▼──────────────────────────────┐
│   AI Layer      │  │          Data Layer                 │
│  aiService.ts   │  │  Supabase (PostgreSQL + Auth)       │
│  DeepSeek API   │  │  AsyncStorage (local cache)         │
└──────────┬──────┘  └───────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│               External APIs                              │
│  OpenAI Whisper · Google Places · Expo Notifications     │
└─────────────────────────────────────────────────────────┘
```

**Key architectural decisions:**

1. **Offline-first parsing** — local regex-based detection before any AI API call, minimizing latency and cost
2. **Service layer isolation** — all business logic lives in `services/`, screens only call service functions
3. **Provider-agnostic AI** — single `aiService.ts` wrapper; swap providers by changing one constant
4. **Background geofencing** — Expo TaskManager runs location monitoring even when app is closed
5. **RLS-enforced data isolation** — Supabase Row Level Security ensures users can only access their own data

---

## 4. Project Structure

```
notes/                              # App root (Expo project named "Notto")
├── app/                            # Screens — Expo Router file-based routing
│   ├── _layout.tsx                 # Root layout: auth state, providers
│   ├── index.tsx                   # Redirect entry point
│   ├── (auth)/                     # Auth screens (unauthenticated group)
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   ├── forgot-password.tsx
│   │   └── reset-password.tsx
│   ├── (tabs)/                     # Main app (authenticated tab group)
│   │   ├── _layout.tsx             # Tab bar configuration
│   │   ├── index.tsx               # Home — notes list & capture
│   │   ├── reminders.tsx           # Reminders management
│   │   ├── journal.tsx             # Photo journal + AI insights
│   │   ├── me.tsx                  # Productivity metrics + patterns
│   │   └── settings.tsx            # App settings
│   ├── auth/callback.tsx           # OAuth callback handler
│   ├── onboarding.tsx              # Personality questionnaire (modal)
│   ├── profile.tsx                 # User profile editor (modal)
│   └── locations.tsx               # Saved locations manager (modal)
│
├── components/
│   ├── common/TopBar.tsx           # Shared header bar
│   ├── notes/                      # Note-specific components
│   │   ├── NoteCard.tsx            # Note display card with swipe-to-delete
│   │   ├── NoteInputBar.tsx        # Text + mic input bar
│   │   ├── TranscriptionReview.tsx # Review/edit modal before saving
│   │   ├── ReminderPicker.tsx      # Date/time picker modal
│   │   └── EditNoteModal.tsx       # Edit existing note
│   ├── voice/                      # Voice recording UI
│   │   ├── VoiceCaptureSheet.tsx   # Bottom sheet for recording
│   │   ├── VoiceRecordButton.tsx   # Hold-to-record button
│   │   └── VoiceWaveform.tsx       # Animated waveform visualizer
│   ├── journal/                    # Photo journal components
│   │   ├── PhotoCard.tsx
│   │   ├── PhotoPreview.tsx
│   │   ├── CameraView.tsx
│   │   ├── CategoryFilter.tsx
│   │   ├── InsightsView.tsx
│   │   └── EmptyJournalState.tsx
│   ├── plans/                      # Place suggestion components
│   │   ├── PlanCard.tsx
│   │   ├── PlaceCard.tsx
│   │   ├── GooglePlaceCard.tsx
│   │   └── PlanGenerationLoader.tsx
│   ├── onboarding/                 # Onboarding flow components
│   │   ├── OnboardingScreen.tsx
│   │   ├── OnboardingSlider.tsx
│   │   ├── OnboardingOption.tsx
│   │   ├── OnboardingProgress.tsx
│   │   ├── OnboardingTextInput.tsx
│   │   └── OnboardingTimePicker.tsx
│   └── ui/                         # Generic UI primitives
│       ├── AnimatedPressable.tsx
│       ├── BottomSheet.tsx
│       ├── PremiumButton.tsx
│       ├── PremiumCard.tsx
│       ├── PullToRefresh.tsx
│       ├── SkeletonLoader.tsx
│       └── WheelTimePicker.tsx
│
├── services/                       # All business logic
│   ├── aiService.ts                # Centralized AI API wrapper (DeepSeek)
│   ├── authService.ts              # Supabase auth
│   ├── notesService.ts             # Notes CRUD + location notes
│   ├── claudeService.ts            # Note parsing + place suggestions (legacy)
│   ├── reminderService.ts          # Reminder scheduling + recurring logic
│   ├── locationService.ts          # Geofencing + saved locations
│   ├── notificationService.ts      # Push notification scheduling
│   ├── smartNotificationEngine.ts  # Intelligent notification timing
│   ├── onboardingNotificationService.ts
│   ├── plansService.ts             # Place suggestions CRUD
│   ├── journalService.ts           # Photo journal CRUD
│   ├── journalInsightsService.ts   # AI-generated journal insights
│   ├── journalNotificationService.ts
│   ├── profileService.ts           # User profile CRUD
│   ├── profileAnalysisService.ts   # AI profile learning from notes
│   ├── preferencesService.ts       # User preferences
│   ├── productivityService.ts      # Metrics: streaks, completion rates
│   ├── patternsService.ts          # Behavioral pattern detection
│   ├── taskEnrichmentService.ts    # AI task enhancement
│   ├── googlePlacesService.ts      # Google Places API wrapper
│   ├── voiceService.ts             # Audio recording
│   ├── speechRecognitionService.ts # Native speech-to-text
│   └── soundService.ts             # Audio feedback (UI sounds)
│
├── context/ThemeContext.tsx        # Dark/light mode React Context
├── theme/index.ts                  # Design tokens (colors, type, spacing)
├── config/
│   ├── supabase.ts                 # Supabase client
│   └── env.ts                      # Environment variable accessors
└── database/migrations/            # SQL migration files
```

---

## 5. Database Schema

All tables use Supabase's `auth.users` for ownership and have Row Level Security enabled — users can only read/write their own rows via `auth.uid()`.

### `notes` — Core content storage

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id               UUID REFERENCES auth.users
transcript            TEXT                    -- Raw input (voice or text)
audio_url             TEXT                    -- Optional S3/storage URL
parsed_data           JSONB                   -- AI-extracted structure
tags                  TEXT[]                  -- ['reminder','preference','my_type','my_vibe']
created_at            TIMESTAMPTZ DEFAULT now()

-- Reminder fields
is_reminder           BOOLEAN DEFAULT FALSE
reminder_type         TEXT                    -- 'one-time' | 'recurring'
event_date            TIMESTAMPTZ             -- For one-time reminders
recurrence_pattern    TEXT                    -- 'daily'|'weekly'|'monthly'|'yearly'
recurrence_day        INTEGER                 -- 0-6 (weekly) or 1-31 (monthly)
recurrence_time       TIME                    -- 'HH:mm'
notification_ids      TEXT[]                  -- Expo notification IDs for cancellation
reminder_active       BOOLEAN DEFAULT TRUE
reminder_completed_at TIMESTAMPTZ             -- Timestamp when marked done (one-time)

-- Location-triggered fields
location_category     TEXT                    -- 'grocery'|'pharmacy'|'fitness'|etc.
shopping_items        TEXT[]                  -- Items extracted for shopping lists
location_completed    BOOLEAN DEFAULT FALSE
```

### `user_profiles` — Personality model and AI-inferred preferences

```sql
id                    UUID PRIMARY KEY
user_id               UUID UNIQUE REFERENCES auth.users

-- Personality spectrum (1–10 sliders set during onboarding)
introvert_extrovert   INTEGER                 -- 1=introvert, 10=extrovert
spontaneous_planner   INTEGER                 -- 1=meticulous, 10=spontaneous
adventurous_comfort   INTEGER                 -- 1=comfort zone, 10=adventure seeker
energy_level          INTEGER                 -- 1=relaxed, 10=high energy
decisiveness          INTEGER                 -- 1=decisive, 10=likes many options

-- Practical preferences
budget_sensitivity    TEXT                    -- 'budget'|'moderate'|'splurge'|'flexible'
time_preference       TEXT                    -- 'morning'|'afternoon'|'evening'|'night'
preferred_group_size  TEXT                    -- 'solo'|'couple'|'small_group'|'large_group'

-- AI-inferred (auto-updated via profileAnalysisService)
inferred_interests    JSONB                   -- ["bowling","mexican food","stargazing"]
inferred_dislikes     JSONB                   -- Things to actively avoid
food_preferences      JSONB                   -- {favorites, dietary_restrictions, avoid}
mood_signals          JSONB                   -- {current_stress_level, seeking}

-- Metadata
onboarding_completed  BOOLEAN DEFAULT FALSE
profile_completeness  INTEGER DEFAULT 0       -- 0–100%
notes_analyzed_count  INTEGER DEFAULT 0
```

### `reminder_completions` — Tracks which recurring instances are done

```sql
id                    UUID PRIMARY KEY
note_id               UUID REFERENCES notes
user_id               UUID REFERENCES auth.users
completed_date        DATE                    -- Which calendar day was completed
completed_at          TIMESTAMPTZ
UNIQUE(note_id, completed_date)
```

### `place_suggestions` — AI-generated weekend recommendations

```sql
id                    UUID PRIMARY KEY
user_id               UUID
name                  TEXT
category              TEXT                    -- 'food'|'activity'|'park'|'entertainment'|'fitness'
description           TEXT
reason                TEXT                    -- Why this was suggested (shown to user)
status                TEXT DEFAULT 'suggested' -- 'suggested'|'liked'|'disliked'
expires_at            TIMESTAMPTZ             -- 7-day TTL; regenerated when stale
```

### `saved_locations` — Geofence anchor points

```sql
id                    UUID PRIMARY KEY
user_id               UUID
name                  TEXT                    -- "Home", "Work", "Gym"
type                  TEXT                    -- 'home'|'work'|'gym'|'custom'
latitude              NUMERIC
longitude             NUMERIC
radius                NUMERIC                 -- Meters (geofence radius)
notifyOnEnter         BOOLEAN DEFAULT TRUE
notifyOnExit          BOOLEAN DEFAULT FALSE
```

### Additional tables (from migrations)

- `note_place_results` — Cached Google Places results attached to notes
- `patterns` — Detected behavioral patterns (e.g., "often craves pizza on Fridays")
- `productivity_metrics` — Daily task completion rates, streaks

---

## 6. Feature Specifications

### 6.1 Voice Note Capture

- **Hold-to-record** button with animated waveform (VoiceWaveform component)
- **Transcription pipeline**: native Expo Speech Recognition → Whisper API fallback
- **Review modal** (TranscriptionReview): editable text before saving
- **AI parsing** on save: extracts reminder, location category, shopping items, tags
- **Local parsing fallback**: regex-based detection when AI API is unavailable, ensuring offline functionality

### 6.2 Smart Reminders

| Type | Behavior |
|---|---|
| One-time | Fires at a specific date/time; supports pre-event notifications |
| Recurring daily | Fires every day at a set time |
| Recurring weekly | Fires on a specific weekday at a set time |
| Recurring monthly | Fires on a specific day of the month |
| Recurring yearly | Anniversary/annual events |
| Multiple times | Same reminder at different times (e.g., 11am and 2pm) |

Rollover logic: incomplete tasks from previous days surface at the top of today's list.

### 6.3 Location-Based Reminders (Geofencing)

1. User saves named locations (Home, Work, Gym) with a configurable radius
2. `locationService` registers geofence regions via Expo Location
3. `TaskManager` background task monitors enter/exit events even when app is closed
4. On region entry: query `notes` table for pending location-category notes → push notification
5. Cooldown tracking in AsyncStorage prevents notification spam for the same location

**Supported auto-categories**: grocery, pharmacy, fitness, hardware store, pet store, clothing, electronics

### 6.4 AI Weekend Plans

- Generates 5–8 personalized place recommendations (not raw search results)
- Input context: last 7 days of notes + personality profile + past like/dislike feedback
- Categories: activity, food, park, shopping, entertainment, fitness
- 7-day TTL on suggestions; regenerated when stale or on user refresh
- **Learning loop**: thumbs up/down updates `place_suggestions.status`, which feeds back into the next generation prompt

### 6.5 Photo Journal

- Capture or import photos with optional AI-generated caption/context
- Category filters: food, activity, social, nature, work, personal
- **Insights tab**: AI-generated weekly summaries and well-being patterns derived from the photo timeline
- Notification service nudges users to log when they haven't journaled recently

### 6.6 Me / Productivity Screen

- **Streak tracking**: consecutive days with completed reminders
- **Completion rate**: tasks done / tasks scheduled (daily + weekly)
- **Pattern detection**: recurring behaviors inferred from notes (e.g., "you tend to defer tasks on Mondays")
- **Inferred interests**: extracted from notes and surfaced as a profile snapshot
- Weekly trend graph showing productivity over the past 7 days

### 6.7 Personality Onboarding

Five slider questions (1–10 scale), answered once at signup and editable in profile:

1. Introvert ↔ Extrovert
2. Meticulous Planner ↔ Spontaneous
3. Comfort Zone ↔ Adventure Seeker
4. Relaxed ↔ High Energy
5. Quick Decisions ↔ Likes Options

Additional preferences: budget sensitivity, preferred time of day, preferred group size.

### 6.8 Tag System

| Tag | Color | Meaning |
|---|---|---|
| `reminder` | Rose/Red | Time-based notification needed |
| `preference` | Emerald/Green | "I like..." — feeds into recommendations |
| `my_type` | Violet/Purple | Activity/food that matches personal style |
| `my_vibe` | Amber/Orange | Mood or atmosphere note |

Tags are applied automatically by AI parsing, and can be toggled manually per note.

---

## 7. Services Layer

All business logic is isolated in `services/`. Screens import service functions and never call Supabase or AI APIs directly.

### `aiService.ts` — AI API gateway

```typescript
isAIConfigured(): boolean
callAI(prompt: string, options?: { maxTokens?: number }): Promise<string>
callAIForJSON<T>(prompt: string, options?): Promise<T>
```

Uses DeepSeek API (`deepseek-chat` model, OpenAI-compatible format). Swap providers by changing `API_URL` and `DEFAULT_MODEL`.

### `notesService.ts`

```typescript
createNoteWithReminder(params) → Note
getNotes() → Note[]
deleteNote(id) → void
updateNoteTags(id, tags) → void
getPendingLocationNotes(category) → Note[]  // For geofence triggers
markLocationNoteCompleted(id) → void
getShoppingList() → string[]
```

### `reminderService.ts`

```typescript
scheduleReminder(noteId, transcript, reminder) → string[]   // Returns notification IDs
scheduleRecurringNotification(pattern, day, time) → string
getTodaysReminders() → TodaysReminder[]
getUpcomingReminders(days: number) → TodaysReminder[]
markReminderDone(noteId) → boolean
undoReminderDone(noteId) → boolean
rolloverPendingTasks() → void
rescheduleAllReminders() → void   // Called on app open to re-register notifications
```

### `locationService.ts`

```typescript
initialize() → void
updateGeofencing() → void
startBackgroundLocationMonitoring() → void
saveLocation(location) → SavedLocation
getLocations() → SavedLocation[]
deleteLocation(id) → void
```

### `profileService.ts`

```typescript
getUserProfile() → UserProfile
updateUserProfile(updates) → UserProfile
completeOnboarding() → void
buildAIProfileContext(profile) → string   // Formats profile for AI prompt injection
analyzeNotesForInsights(notes) → Insights
```

### `productivityService.ts` / `patternsService.ts`

```typescript
// productivityService
getMetrics(date) → ProductivityMetrics
getWeeklyTrend() → WeeklyTrend
getCurrentStreak() → number

// patternsService
getPatterns() → Pattern[]
detectPatterns(notes, completions) → Pattern[]
```

---

## 8. Component Architecture

### Note input hierarchy

```
NoteInputBar
├── TextInput (freeform text entry)
├── SendButton (submit text note)
└── MicButton → VoiceCaptureSheet (bottom sheet)
      ├── VoiceRecordButton (hold-to-record, animated)
      └── VoiceWaveform (real-time audio visualization)

TranscriptionReview (modal, post-recording)
├── EditableTranscript (TextInput)
├── ReminderSection (shows extracted reminder if detected)
├── AddReminderButton → ReminderPicker
│     ├── QuickOptions ("In 1 hour", "Tomorrow morning", etc.)
│     └── CustomDateTime (DatePicker + TimePicker wheels)
├── ReRecordButton
└── SaveButton
```

### NoteCard

```
NoteCard
├── SwipeLeftGesture → DeleteConfirmation
├── Transcript text
├── Timestamp (relative: "2 hours ago")
├── Tag badges (colored chips)
├── ReminderBadge (if is_reminder: clock icon + formatted datetime)
└── ActionMenu (edit tags, delete, edit note)
```

### UI primitives

| Component | Behavior |
|---|---|
| `AnimatedPressable` | Scale-down on press via Reanimated |
| `BottomSheet` | Slides up from bottom with backdrop dismiss |
| `PremiumButton` | Gradient background with haptic press animation |
| `PremiumCard` | Elevated card with platform-appropriate shadow |
| `SkeletonLoader` | Shimmer placeholder while content loads |
| `WheelTimePicker` | Custom iOS-style scroll wheel for time selection |

---

## 9. Navigation & Auth Flow

### Route map (Expo Router file-based)

```
/                       → index.tsx (redirects based on auth state)
/(auth)/login           → Login screen
/(auth)/signup          → Signup screen
/(auth)/forgot-password → Password reset request
/(auth)/reset-password  → New password entry
/auth/callback          → OAuth deep link handler
/(tabs)/                → Home (notes list)
/(tabs)/reminders       → Reminders tab
/(tabs)/journal         → Photo journal tab
/(tabs)/me              → Productivity / Me tab
/(tabs)/settings        → Settings tab
/onboarding             → Personality questionnaire (modal, shown once)
/profile                → Profile editor (modal)
/locations              → Saved locations manager (modal)
```

### Auth state machine

```
App launch
    ↓
Check Supabase session (onAuthStateChange)
    ├── No session  →  /(auth)/login
    └── Has session →  Check onboarding_completed
            ├── false  →  /onboarding  →  /(tabs)/
            └── true   →  /(tabs)/
```

---

## 10. State Management

Notto uses a deliberately minimal state management approach — no Redux or Zustand.

| Mechanism | What it manages |
|---|---|
| React Context (`ThemeContext`) | Dark/light/system theme mode |
| Supabase `onAuthStateChange` | Global auth state + route protection |
| Component-local `useState` | All screen-level state (notes list, form inputs, etc.) |
| AsyncStorage | Persisted local state (theme, location cache, cooldowns) |

### AsyncStorage keys

```typescript
'@theme_mode'           // 'light' | 'dark' | 'system'
'@saved_locations'      // SavedLocation[] cache
'@location_settings'    // Geofencing radius/enable preferences
'@last_detected_store'  // ISO timestamp — cooldown to prevent repeat geofence pings
```

---

## 11. Theme System

All design tokens live in `theme/index.ts`. Components consume tokens directly; no inline magic numbers.

### Color palette

```typescript
colors.primary          // Indigo scale (#6366f1 base)
colors.accent.rose      // Reminders / alerts
colors.accent.emerald   // Preferences / success
colors.accent.violet    // My Type tag
colors.accent.amber     // My Vibe tag / warnings
colors.semantic.success // #10b981
colors.semantic.error   // #ef4444
colors.neutral          // Warm gray scale (0–950)
colors.background       // { primary, secondary, tertiary, elevated, overlay }
colors.backgroundDark   // Dark mode variants for all background tokens
```

### Typography scale

```typescript
fontSize: { xs: 11, sm: 13, base: 15, md: 17, lg: 19, xl: 23, '2xl': 28, '3xl': 34 }
fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' }
lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.625 }
```

### Spacing (8px grid)

```typescript
spacing: { 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 }
```

### Animation presets

```typescript
animation.duration: { instant: 100, fast: 200, normal: 300, slow: 500 }
animation.spring.snappy: { damping: 20, stiffness: 300 }
animation.spring.bouncy: { damping: 10, stiffness: 180 }
animation.spring.gentle: { damping: 15, stiffness: 120 }
```

### Dark mode utility

```typescript
const themedColors = getThemedColors(isDark);
// Returns: { text, subtext, surface, input, background, border }
// with appropriate light/dark variants applied
```

---

## 12. API Integrations

### DeepSeek (primary AI)

```typescript
// services/aiService.ts
const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';

// OpenAI-compatible format
POST /v1/chat/completions
{ model, max_tokens, messages: [{ role: 'user', content: prompt }] }
```

Used for: note parsing, place suggestion generation, profile analysis, journal insights, pattern detection.

### OpenAI Whisper (voice transcription)

```typescript
POST https://api.openai.com/v1/audio/transcriptions
FormData: { file: <m4a blob>, model: 'whisper-1' }
```

### Google Places (live place search)

```typescript
GET https://maps.googleapis.com/maps/api/place/nearbysearch/json
  ?location={lat},{lng}
  &radius=5000
  &keyword={query}
  &key={GOOGLE_PLACES_API_KEY}
```

Called on-demand when generating place suggestions. No local places database is maintained.

### Supabase

```typescript
// config/supabase.ts
createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, detectSessionInUrl: false }
})
```

All queries use RLS; client-side filters are redundant safety checks only.

---

## 13. Key User Flows

### Voice note → saved reminder

```
1. User holds mic button
2. voiceService.startRecording()
3. User releases → stopRecording() returns audio URI
4. speechRecognitionService (native) OR whisperAPI(audioURI) → transcript
5. TranscriptionReview modal opens with editable text
6. User optionally edits text, sets reminder via ReminderPicker
7. User taps "Save Note"
8. claudeService.parseNote(text) OR local regex fallback
   → { is_reminder, reminder_type, event_date, location_category, tags, ... }
9. notesService.createNoteWithReminder(transcript, parsedData)
10. If reminder: reminderService.scheduleReminder(noteId, transcript, reminderData)
    → returns notification_ids stored on the note row
11. Supabase insert → note appears in list
```

### Location-triggered reminder

```
1. User saves "Grocery Store" as a saved location with 200m radius
2. locationService.updateGeofencing() registers Expo geofence region
3. User leaves home → TaskManager background task fires on region entry
4. notesService.getPendingLocationNotes('grocery') → returns pending shopping notes
5. notificationService.sendLocalNotification("You have a grocery list")
6. User taps notification → app opens, shows relevant notes
7. User marks note complete → markLocationNoteCompleted(id)
```

### AI weekend plan generation

```
1. User taps "Generate Plans" in Plans tab
2. notesService.getRecentNotes(7) → last 7 days of notes
3. profileService.buildAIProfileContext(profile) → formatted personality string
4. plansService.getPastFeedbackSummary() → liked/disliked history
5. googlePlacesService.searchNearby(userLocation, queries) → live place data
6. claudeService.generatePlaceSuggestions(notes, profile, feedback, places)
   → returns 5–8 PlaceSuggestion objects with name, category, reason
7. plansService.saveSuggestions(suggestions) → stored with 7-day expiry
8. Plans rendered as swipeable cards with thumbs up/down feedback
9. Feedback updates suggestion status → included in next generation's prompt
```

---

## 14. Environment Setup

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator or Android Emulator (or physical device with Expo Go)
- For full functionality: dev build (not Expo Go) — required for background location and native speech recognition

### Install and run

```bash
cd notes
npm install
npx expo start
# Press i for iOS simulator, a for Android
```

### Environment variables

Copy `config/env.example.ts` to `config/env.ts` and fill in your keys, or set them as EAS Secrets for production builds.

```bash
DEEPSEEK_API_KEY=sk-...          # Required: AI parsing & suggestions
OPENAI_API_KEY=sk-...            # Optional: Whisper voice transcription
GOOGLE_PLACES_API_KEY=AIza...    # Optional: Live place search
```

Supabase credentials are hardcoded in `config/supabase.ts` (replace with your project URL and anon key).

### Building for device (dev build)

```bash
npx expo run:ios      # Requires Xcode
npx expo run:android  # Requires Android Studio
```

Background location monitoring and native speech recognition require a dev build — they do not work in Expo Go.

### App identifiers

```
iOS bundle ID:    com.notesapp.voicenotes
Android package:  com.notesapp.voicenotes
EAS project ID:   d676cf2a-5bc7-4bf8-b616-7ccb12f07aa4
```

---

## Roadmap / Open Questions

- **Calendar sync** — import existing commitments to improve plan scheduling
- **Voice-generated plans** — "Plan my weekend" as a voice command that kicks off the full agent flow
- **AI memory persistence** — embeddings-based long-term preference storage vs structured preference model
- **Whisper on-device** — evaluate `whisper.rn` for fully offline transcription
- **Collaborative plans** — share/coordinate weekend plans with contacts
