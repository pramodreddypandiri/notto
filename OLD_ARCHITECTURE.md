# Voice Notes App - Architecture Documentation

> Comprehensive documentation for LLMs and developers to understand the codebase.

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Core Features](#5-core-features)
6. [Services Layer](#6-services-layer)
7. [Component Architecture](#7-component-architecture)
8. [Navigation & Routing](#8-navigation--routing)
9. [State Management](#9-state-management)
10. [Theme System](#10-theme-system)
11. [API Integrations](#11-api-integrations)
12. [Key Flows](#12-key-flows)
13. [Configuration](#13-configuration)

---

## 1. Project Overview

**Voice Notes** is an AI-powered mobile app for capturing voice notes with intelligent features:
- Voice-to-text transcription
- Smart reminder extraction and scheduling
- Location-based reminders (geofencing)
- AI-powered place suggestions based on user preferences
- Personality profiling for personalized recommendations

**Platform**: iOS & Android (React Native + Expo)

---

## 2. Tech Stack

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| React Native | 0.81.5 | Cross-platform mobile framework |
| React | 19.1.0 | UI library |
| Expo | ~54.0.32 | Development platform & native APIs |
| TypeScript | ~5.9.2 | Type-safe JavaScript |

### Navigation
| Package | Purpose |
|---------|---------|
| Expo Router ~6.0.22 | File-based routing |
| React Navigation | Stack & tab navigation |

### Backend & Database
| Service | Purpose |
|---------|---------|
| Supabase | PostgreSQL database + Auth + Real-time |
| Row Level Security | Per-user data isolation |

### AI & Voice
| Service | Purpose |
|---------|---------|
| Claude AI (Anthropic) | Note parsing, place suggestions, profile analysis |
| Whisper API (OpenAI) | Voice transcription fallback |
| Expo Speech Recognition | Native speech-to-text (dev builds) |

### Location & Notifications
| Package | Purpose |
|---------|---------|
| Expo Location | GPS & geofencing |
| Expo Notifications | Local push notifications |
| Expo Task Manager | Background task execution |

### UI & Styling
| Package | Purpose |
|---------|---------|
| NativeWind | Tailwind CSS for React Native |
| React Native Reanimated | Smooth animations |
| React Native Gesture Handler | Touch gestures |
| Expo Haptics | Haptic feedback |

---

## 3. Project Structure

```
notes/
├── app/                          # Screens (Expo Router file-based routing)
│   ├── (auth)/                   # Auth screens (login, signup)
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/                   # Main tab screens
│   │   ├── _layout.tsx           # Tab bar configuration
│   │   ├── index.tsx             # Home - Notes list & capture
│   │   ├── reminders.tsx         # Reminders management
│   │   ├── plans.tsx             # AI place suggestions
│   │   └── settings.tsx          # App settings
│   ├── _layout.tsx               # Root layout (auth state)
│   ├── onboarding.tsx            # Personality questionnaire
│   ├── profile.tsx               # User profile editor
│   └── locations.tsx             # Saved locations manager
│
├── components/                   # Reusable UI components
│   ├── common/                   # Shared (TopBar)
│   ├── notes/                    # Note-related components
│   │   ├── NoteCard.tsx          # Note display card
│   │   ├── NoteInputBar.tsx      # Text + mic input bar
│   │   ├── TranscriptionReview.tsx # Review before save
│   │   └── ReminderPicker.tsx    # Date/time picker modal
│   ├── voice/                    # Voice recording UI
│   ├── plans/                    # Place suggestion cards
│   ├── onboarding/               # Onboarding flow UI
│   └── ui/                       # Generic UI (buttons, cards, etc.)
│
├── services/                     # Business logic (13 services)
│   ├── authService.ts            # Authentication
│   ├── notesService.ts           # Notes CRUD
│   ├── claudeService.ts          # AI parsing & suggestions
│   ├── reminderService.ts        # Reminder scheduling
│   ├── locationService.ts        # Geofencing
│   ├── plansService.ts           # Place suggestions CRUD
│   ├── notificationService.ts    # Push notifications
│   ├── voiceService.ts           # Audio recording
│   ├── speechRecognitionService.ts # Native speech-to-text
│   ├── profileService.ts         # User profiles
│   ├── profileAnalysisService.ts # AI profile learning
│   ├── googlePlacesService.ts    # Google Places API
│   └── soundService.ts           # Audio feedback
│
├── context/                      # React Context providers
│   └── ThemeContext.tsx          # Dark/light mode
│
├── theme/                        # Design system
│   └── index.ts                  # Colors, typography, spacing, etc.
│
├── database/                     # SQL schemas
│   └── migrations/               # Database migrations
│
├── config/                       # App configuration
│   ├── supabase.ts               # Supabase client
│   └── env.ts                    # Environment variables
│
└── assets/                       # Images, fonts, icons
```

---

## 4. Database Schema

### Core Tables

#### `notes` - Main content storage
```sql
id                  UUID PRIMARY KEY
user_id             UUID (FK → auth.users)
transcript          TEXT              -- Original transcription
audio_url           TEXT              -- Optional audio file
parsed_data         JSONB             -- AI-extracted structure
tags                TEXT[]            -- ['reminder', 'preference', 'my_type']
created_at          TIMESTAMPTZ

-- Reminder fields
is_reminder         BOOLEAN DEFAULT FALSE
reminder_type       TEXT              -- 'one-time' | 'recurring'
event_date          TIMESTAMPTZ       -- For one-time events
recurrence_pattern  TEXT              -- 'daily' | 'weekly' | 'monthly' | 'yearly'
recurrence_day      INTEGER           -- 0-6 (weekly) or 1-31 (monthly)
recurrence_time     TIME              -- 'HH:mm' format
notification_ids    TEXT[]            -- Scheduled notification IDs
reminder_active     BOOLEAN DEFAULT TRUE
reminder_completed_at TIMESTAMPTZ     -- When marked done (one-time)

-- Location fields
location_category   TEXT              -- 'grocery' | 'pharmacy' | 'fitness' | etc.
shopping_items      TEXT[]            -- Extracted items
location_completed  BOOLEAN DEFAULT FALSE
```

#### `user_profiles` - Personality & AI learning
```sql
id                  UUID PRIMARY KEY
user_id             UUID UNIQUE (FK → auth.users)

-- Personality spectrum (1-10 scale)
introvert_extrovert INTEGER           -- 1=introvert, 10=extrovert
spontaneous_planner INTEGER           -- 1=meticulous, 10=spontaneous
adventurous_comfort INTEGER           -- 1=comfort, 10=adventure
energy_level        INTEGER           -- 1=relaxed, 10=high-energy
decisiveness        INTEGER           -- 1=decisive, 10=likes options

-- Practical preferences
budget_sensitivity  TEXT              -- 'budget' | 'moderate' | 'splurge' | 'flexible'
time_preference     TEXT              -- 'morning' | 'afternoon' | 'evening' | etc.
preferred_group_size TEXT             -- 'solo' | 'couple' | 'small_group' | etc.

-- AI-inferred (auto-updated)
inferred_interests  JSONB             -- ["bowling", "mexican food"]
inferred_dislikes   JSONB             -- Things to avoid
food_preferences    JSONB             -- {favorites, dietary, avoid}
mood_signals        JSONB             -- {stress_level, seeking}

-- Metadata
onboarding_completed BOOLEAN
profile_completeness INTEGER          -- 0-100
notes_analyzed_count INTEGER
```

#### `reminder_completions` - Recurring reminder tracking
```sql
id                  UUID PRIMARY KEY
note_id             UUID (FK → notes)
user_id             UUID (FK → auth.users)
completed_date      DATE              -- Which day was completed
completed_at        TIMESTAMPTZ
UNIQUE(note_id, completed_date)
```

#### `place_suggestions` - AI recommendations
```sql
id                  UUID PRIMARY KEY
user_id             UUID
name                TEXT
category            TEXT              -- 'food' | 'activity' | 'entertainment'
description         TEXT
reason              TEXT              -- Why suggested
status              TEXT              -- 'suggested' | 'liked' | 'disliked'
expires_at          TIMESTAMPTZ       -- 7-day expiry
```

#### `saved_locations` - Geofence points
```sql
id                  UUID PRIMARY KEY
user_id             UUID
name                TEXT              -- "Home", "Work", "Gym"
type                TEXT              -- 'home' | 'work' | 'gym'
latitude            NUMERIC
longitude           NUMERIC
radius              NUMERIC           -- Meters
notifyOnEnter       BOOLEAN
notifyOnExit        BOOLEAN
```

### Row Level Security
All tables have RLS enabled - users can only access their own data via `auth.uid()`.

---

## 5. Core Features

### Voice Note Capture
1. **Hold-to-record** button with animated waveform
2. **Transcription** via native speech recognition OR Whisper API fallback
3. **Review modal** to edit transcription before saving
4. **AI parsing** extracts structured data (reminder, location, items)

### Smart Reminders
- **One-time**: Specific date/time with pre-event notifications
- **Recurring**: Daily, weekly, monthly, yearly patterns
- **Multiple times**: Same reminder at different times (e.g., 11am AND 2pm)
- **Location-triggered**: Notify when entering/leaving saved locations

### Location-Based Features
- **Saved locations**: Home, work, gym with custom radius
- **Auto-detection**: Recognize grocery stores, pharmacies, gyms
- **Smart filtering**: Only notify for relevant pending notes
- **Geofencing**: Background monitoring via TaskManager

### AI Place Suggestions
- Generates 5-8 personalized recommendations based on:
  - Recent notes (last 7 days)
  - User personality profile
  - Past like/dislike feedback
- Categories: Activity, food, park, shopping, entertainment, fitness
- **Learning**: Feedback trains future suggestions

### Personality Onboarding
5 questions with sliders (1-10):
1. Introvert ↔ Extrovert
2. Meticulous Planner ↔ Spontaneous
3. Comfort Zone ↔ Adventure Seeker
4. Relaxed ↔ High Energy
5. Quick Decisions ↔ Likes Options

### Tag System
| Tag | Color | Purpose |
|-----|-------|---------|
| `reminder` | Rose/Pink | Time-based notes |
| `preference` | Emerald/Green | "I like..." notes |
| `my_type` | Violet/Purple | Activity/food interests |
| `my_vibe` | Amber/Orange | Lifestyle notes |

---

## 6. Services Layer

### notesService.ts (563 lines)
```typescript
// CRUD operations
createNoteWithReminder(params) → Note
getNotes() → Note[]
deleteNote(id) → void
updateNoteTags(id, tags) → void

// Location-based
getPendingLocationNotes(category) → Note[]
markLocationNoteCompleted(id) → void
getShoppingList() → string[]
```

### claudeService.ts (633 lines)
```typescript
// AI parsing
parseNote(transcript) → ParsedNote
detectReminderLocally(text) → ParsedReminder  // Fallback (no API)
detectLocationCategoryLocally(text) → string

// Place suggestions
generatePlaceSuggestions(notes, profile, feedback) → PlaceSuggestion[]
```

### reminderService.ts (789 lines)
```typescript
// Scheduling
scheduleReminder(noteId, transcript, reminder) → string[]
scheduleRecurringNotification(pattern, day, time) → string

// Queries
getTodaysReminders() → TodaysReminder[]
getUpcomingReminders(days) → TodaysReminder[]

// State management
markReminderDone(noteId) → boolean
undoReminderDone(noteId) → boolean
rolloverPendingTasks() → void  // Move incomplete to today
```

### locationService.ts (839 lines)
```typescript
// Geofencing
initialize() → void
updateGeofencing() → void
startBackgroundLocationMonitoring() → void

// Saved locations
saveLocation(location) → SavedLocation
getLocations() → SavedLocation[]
deleteLocation(id) → void
```

### profileService.ts (785 lines)
```typescript
// Profile management
getUserProfile() → UserProfile
updateUserProfile(updates) → UserProfile
completeOnboarding() → void

// AI context
buildAIProfileContext(profile) → string  // For Claude prompts
analyzeNotesForInsights(notes) → Insights
```

---

## 7. Component Architecture

### Note Components
```
NoteInputBar
├── TextInput (editable text)
├── SendButton (submit text note)
└── MicButton (hold to record)

TranscriptionReview (Modal)
├── Header (title + close)
├── TextInput (editable transcription)
├── ReminderSection (optional reminder display)
├── AddReminderButton → ReminderPicker
├── ReRecordButton
└── SaveButton ("Save Note" / "Saving.....")

NoteCard
├── SwipeToDelete (gesture)
├── NoteText (transcript)
├── Timestamp
├── Tags (colored badges)
├── ReminderBadge (if applicable)
└── ActionMenu (edit tags, delete)
```

### Reminder Components
```
ReminderPicker (Modal)
├── QuickOptions ("In 1 hour", "Tomorrow morning", etc.)
├── CustomDateTime
│   ├── DatePicker
│   └── TimePicker
├── SelectedTimeDisplay
└── ConfirmButton ("Set Reminder" / "Set Reminder & Save")
```

### UI Components
```
PremiumButton    - Gradient button with press animation
AnimatedPressable - Pressable with scale animation
BottomSheet      - Modal from bottom
SkeletonLoader   - Loading placeholders
PremiumCard      - Content card with shadow
```

---

## 8. Navigation & Routing

### File-based Routing (Expo Router)
```
app/
├── _layout.tsx          → Root (auth check, providers)
├── (auth)/
│   ├── _layout.tsx      → Auth group layout
│   ├── login.tsx        → /login
│   └── signup.tsx       → /signup
├── (tabs)/
│   ├── _layout.tsx      → Tab bar config
│   ├── index.tsx        → / (Home)
│   ├── reminders.tsx    → /reminders
│   ├── plans.tsx        → /plans
│   └── settings.tsx     → /settings
├── onboarding.tsx       → /onboarding (modal)
├── profile.tsx          → /profile (modal)
└── locations.tsx        → /locations (modal)
```

### Auth Flow
```
App Start
    ↓
Check Supabase Session
    ↓
├── No Session → (auth)/login
└── Has Session → (tabs)/index
    ↓
    Check Onboarding
    ├── Not Complete → /onboarding
    └── Complete → Show Home
```

---

## 9. State Management

### React Context
**ThemeContext** - Dark/light mode
```typescript
const { isDark, themeMode, setThemeMode } = useTheme();
// themeMode: 'light' | 'dark' | 'system'
// Persisted to AsyncStorage
```

### Supabase Auth State
```typescript
// In _layout.tsx
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') router.replace('/(tabs)');
  if (event === 'SIGNED_OUT') router.replace('/(auth)/login');
});
```

### Local Component State
- Notes list in Home screen
- Reminders in Reminders screen
- Suggestions in Plans screen
- Form inputs in onboarding

### AsyncStorage Keys
```typescript
'@theme_mode'           // 'light' | 'dark' | 'system'
'@saved_locations'      // Location[] cache
'@location_settings'    // Geofencing preferences
'@last_detected_store'  // Cooldown tracking
```

---

## 10. Theme System

### Design Tokens (theme/index.ts)

#### Colors
```typescript
colors = {
  primary: { 50...900 },      // Indigo (#6366f1)
  accent: {
    rose: { light, base, dark },
    emerald: { ... },
    violet: { ... },
    amber: { ... },
    sky: { ... }
  },
  semantic: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6'
  },
  neutral: { 0...950 },       // Warm gray
  background: {
    primary, secondary, tertiary, elevated, overlay
  },
  backgroundDark: { ... }     // Dark mode variants
}
```

#### Typography
```typescript
typography = {
  fontSize: { xs: 11, sm: 13, base: 15, md: 17, lg: 19, xl: 23, ... },
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.625 }
}
```

#### Spacing (8px grid)
```typescript
spacing = { 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, ... }
```

#### Animation Presets
```typescript
animation = {
  duration: { instant: 100, fast: 200, normal: 300, slow: 500 },
  spring: {
    snappy: { damping: 20, stiffness: 300 },
    bouncy: { damping: 10, stiffness: 180 },
    gentle: { damping: 15, stiffness: 120 }
  }
}
```

### Theme Helper
```typescript
const themedColors = getThemedColors(isDark);
// Returns: { text, surface, input, background } with mode-appropriate colors
```

---

## 11. API Integrations

### Supabase
```typescript
// config/supabase.ts
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true }
});

// Usage
const { data, error } = await supabase
  .from('notes')
  .select('*')
  .eq('user_id', userId);
```

### Claude AI (Anthropic)
```typescript
// Endpoint: https://api.anthropic.com/v1/messages
// Model: claude-sonnet-4-20250514

// Note parsing
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'x-api-key': CLAUDE_API_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: parsePrompt }]
  })
});
```

### Whisper API (OpenAI)
```typescript
// Voice transcription fallback
const formData = new FormData();
formData.append('file', audioBlob, 'recording.m4a');
formData.append('model', 'whisper-1');

const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
  body: formData
});
```

### Google Places API
```typescript
// Place search for notes with place_intent
const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
  `location=${lat},${lng}&radius=5000&keyword=${query}&key=${API_KEY}`;
```

---

## 12. Key Flows

### Voice Note Creation
```
1. User holds mic button
2. voiceService.startRecording()
3. User releases → voiceService.stopRecording()
4. getTranscription(audioUri) → Whisper API
5. Show TranscriptionReview modal
6. User edits text (optional)
7. User sets reminder (optional) → ReminderPicker
8. User taps "Save Note"
9. claudeService.parseNote(text) → Extract structure
10. notesService.createNoteWithReminder()
11. If reminder: reminderService.scheduleReminder()
12. Save to Supabase → Done
```

### Reminder Scheduling
```
1. parseNote() detects reminder intent
2. Extract: type, date, time, recurrence
3. scheduleReminder() called with params
4. For one-time: Schedule Expo Notification at date/time
5. For recurring: Schedule repeating notification (daily/weekly/etc.)
6. Store notification_ids in notes table
7. On app open: rescheduleAllReminders() (re-register)
```

### Location-Based Reminder
```
1. User saves location (Home/Work/Gym)
2. locationService.updateGeofencing() registers region
3. TaskManager monitors location in background
4. On enter/exit region event:
   a. getPendingLocationNotes(category)
   b. If matching notes exist → Send notification
5. User marks note complete → markLocationNoteCompleted()
```

### AI Place Suggestions
```
1. User opens Plans tab
2. plansService.getSuggestions() checks for fresh suggestions
3. If expired/none:
   a. notesService.getRecentNotes(7)
   b. profileService.buildAIProfileContext()
   c. plansService.getPastFeedbackSummary()
   d. claudeService.generatePlaceSuggestions()
   e. Save to place_suggestions table
4. Display suggestion cards
5. User likes/dislikes → updateSuggestionStatus()
6. Feedback stored for future learning
```

---

## 13. Configuration

### Environment Variables
```bash
# .env.local (or EAS Secrets)
EXPO_PUBLIC_CLAUDE_API_KEY=sk-ant-...
EXPO_PUBLIC_OPENAI_API_KEY=sk-...
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIza...
```

### Supabase Config
```typescript
// config/supabase.ts
SUPABASE_URL = 'https://mdhuuckzdpnfyplqwwqf.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIs...'
```

### App Config (app.config.js)
```javascript
{
  name: 'Voice Notes',
  slug: 'voice-notes',
  ios: { bundleIdentifier: 'com.notesapp.voicenotes' },
  android: { package: 'com.notesapp.voicenotes' },
  plugins: [
    'expo-router',
    'expo-location',
    'expo-notifications',
    '@react-native-community/datetimepicker'
  ]
}
```

---

## Summary

This is a **production-grade voice notes app** with:
- **13 service modules** handling distinct concerns
- **File-based routing** with Expo Router
- **AI-powered features** using Claude for parsing and suggestions
- **Background processing** for geofencing and notifications
- **Complete design system** with dark mode support
- **Row-level security** for user data isolation

**Key architectural decisions:**
1. **Offline-first**: Local detection before API calls
2. **Service layer**: Business logic separated from UI
3. **Type safety**: Full TypeScript coverage
4. **Modular components**: Reusable UI building blocks
5. **Learning system**: AI improves with user feedback
