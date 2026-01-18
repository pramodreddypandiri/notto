# Backend Setup Guide

## Overview

This guide will help you set up the complete backend infrastructure for your Weekend Planner app.

## Backend Components

1. **Supabase** - Database, Authentication, Real-time sync
2. **Claude API (Anthropic)** - AI parsing and plan generation
3. **OpenAI Whisper** - Voice transcription
4. **Google Places API** (optional) - Real place data

---

## Part 1: Supabase Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name:** weekend-planner
   - **Database Password:** (save this!)
   - **Region:** Choose closest to you
5. Wait for project to be created (~2 minutes)

### Step 2: Get Your Credentials

Once project is ready:

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon/public key:** `eyJhbGc...` (long string)

### Step 3: Create Database Schema

Go to **SQL Editor** in Supabase dashboard and run this SQL:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (handled by Supabase Auth automatically)
-- We'll create additional tables

-- 1. User Preferences Table
CREATE TABLE user_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  location_city TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. Notes Table
CREATE TABLE notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  transcript TEXT NOT NULL,
  audio_url TEXT,
  parsed_data JSONB,
  tags TEXT[],
  reminder_time TIMESTAMP WITH TIME ZONE,
  notification_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Plans Table
CREATE TABLE plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_data JSONB NOT NULL,
  for_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Feedback Table
CREATE TABLE feedback (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  rating TEXT CHECK (rating IN ('up', 'down')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX idx_plans_user_id ON plans(user_id);
CREATE INDEX idx_plans_for_date ON plans(for_date);
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_plan_id ON feedback(plan_id);

-- Enable Row Level Security (RLS)
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- User Preferences Policies
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Notes Policies
CREATE POLICY "Users can view own notes"
  ON notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE
  USING (auth.uid() = user_id);

-- Plans Policies
CREATE POLICY "Users can view own plans"
  ON plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plans"
  ON plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans"
  ON plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plans"
  ON plans FOR DELETE
  USING (auth.uid() = user_id);

-- Feedback Policies
CREATE POLICY "Users can view own feedback"
  ON feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

Click **Run** to execute the SQL.

### Step 3b: Create User Profile Schema (For AI Personalization)

Run this additional SQL to enable AI-powered personalization:

```sql
-- ============================================
-- USER PROFILE & PERSONALITY TRAITS SCHEMA
-- ============================================
-- Stores personality traits and preferences for AI personalization

-- 1. USER PROFILES TABLE
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- PERSONALITY SPECTRUM (1-10 scale)
  -- 1 = strongly left trait, 10 = strongly right trait
  introvert_extrovert INTEGER DEFAULT 5 CHECK (introvert_extrovert BETWEEN 1 AND 10),
  spontaneous_planner INTEGER DEFAULT 5 CHECK (spontaneous_planner BETWEEN 1 AND 10),
  adventurous_comfort INTEGER DEFAULT 5 CHECK (adventurous_comfort BETWEEN 1 AND 10),
  energy_level INTEGER DEFAULT 5 CHECK (energy_level BETWEEN 1 AND 10),
  decisiveness INTEGER DEFAULT 5 CHECK (decisiveness BETWEEN 1 AND 10),

  -- SOCIAL PREFERENCES
  preferred_group_size TEXT DEFAULT 'flexible'
    CHECK (preferred_group_size IN ('solo', 'couple', 'small_group', 'large_group', 'flexible')),
  social_openness TEXT DEFAULT 'moderate'
    CHECK (social_openness IN ('low', 'moderate', 'high')),
  social_context TEXT DEFAULT 'mixed'
    CHECK (social_context IN ('date_night', 'friends', 'family', 'solo', 'mixed')),

  -- PRACTICAL PREFERENCES
  budget_sensitivity TEXT DEFAULT 'moderate'
    CHECK (budget_sensitivity IN ('budget', 'moderate', 'splurge', 'flexible')),
  time_preference TEXT DEFAULT 'flexible'
    CHECK (time_preference IN ('morning', 'afternoon', 'evening', 'night', 'flexible')),
  crowd_tolerance TEXT DEFAULT 'moderate'
    CHECK (crowd_tolerance IN ('low', 'moderate', 'high')),
  pace_preference TEXT DEFAULT 'balanced'
    CHECK (pace_preference IN ('relaxed', 'balanced', 'packed')),
  max_travel_distance INTEGER DEFAULT 15 CHECK (max_travel_distance BETWEEN 1 AND 100),

  -- AI-INFERRED DATA (Updated automatically from notes)
  inferred_interests JSONB DEFAULT '[]'::jsonb,
  inferred_dislikes JSONB DEFAULT '[]'::jsonb,
  mood_signals JSONB DEFAULT '{}'::jsonb,
  food_preferences JSONB DEFAULT '{}'::jsonb,
  activity_frequency JSONB DEFAULT '{}'::jsonb,

  -- ONBOARDING & METADATA
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 0,
  profile_completeness INTEGER DEFAULT 0 CHECK (profile_completeness BETWEEN 0 AND 100),
  last_ai_analysis TIMESTAMPTZ,
  notes_analyzed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PLAN PATTERNS TABLE (Tracks what worked and didn't)
CREATE TABLE plan_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Positive patterns
  liked_activity_types JSONB DEFAULT '[]'::jsonb,
  liked_time_slots JSONB DEFAULT '[]'::jsonb,
  liked_venues JSONB DEFAULT '[]'::jsonb,
  liked_plan_structures JSONB DEFAULT '[]'::jsonb,

  -- Negative patterns
  disliked_activity_types JSONB DEFAULT '[]'::jsonb,
  disliked_time_slots JSONB DEFAULT '[]'::jsonb,
  disliked_venues JSONB DEFAULT '[]'::jsonb,
  negative_feedback_reasons JSONB DEFAULT '[]'::jsonb,

  -- Statistics
  avg_activities_liked DECIMAL(3,1),
  avg_duration_liked DECIMAL(3,1),
  avg_distance_liked DECIMAL(4,1),
  total_plans_generated INTEGER DEFAULT 0,
  positive_feedback_count INTEGER DEFAULT 0,
  negative_feedback_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ONBOARDING RESPONSES TABLE
CREATE TABLE onboarding_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  response_value TEXT NOT NULL,
  response_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_plan_patterns_user_id ON plan_patterns(user_id);
CREATE INDEX idx_onboarding_responses_user_id ON onboarding_responses(user_id);
CREATE INDEX idx_user_profiles_interests ON user_profiles USING GIN (inferred_interests);
CREATE INDEX idx_user_profiles_dislikes ON user_profiles USING GIN (inferred_dislikes);
CREATE INDEX idx_plan_patterns_liked_activities ON plan_patterns USING GIN (liked_activity_types);

-- ROW LEVEL SECURITY
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_responses ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Plan Patterns Policies
CREATE POLICY "Users can view own patterns"
  ON plan_patterns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own patterns"
  ON plan_patterns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own patterns"
  ON plan_patterns FOR UPDATE USING (auth.uid() = user_id);

-- Onboarding Responses Policies
CREATE POLICY "Users can view own responses"
  ON onboarding_responses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own responses"
  ON onboarding_responses FOR INSERT WITH CHECK (auth.uid() = user_id);

-- TRIGGERS
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_patterns_updated_at
  BEFORE UPDATE ON plan_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- AUTO-CREATE PROFILE ON USER SIGNUP
CREATE OR REPLACE FUNCTION create_user_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO plan_patterns (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile_on_signup();
```

This schema enables:
- **Personality traits** - 1-10 scales for introvert/extrovert, spontaneous/planner, etc.
- **Social preferences** - Group size, social openness, context (date night, friends, etc.)
- **Practical preferences** - Budget, time of day, pace, travel distance
- **AI-inferred data** - Interests, dislikes, mood signals extracted from notes
- **Plan patterns** - Tracks what plans the user liked/disliked for learning

### Step 4: Configure Supabase in App

Edit `config/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// REPLACE THESE WITH YOUR ACTUAL VALUES FROM STEP 2
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

---

## Part 2: Claude API Setup

### Step 1: Get Claude API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Go to **API Keys**
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-...`)

### Step 2: Create Environment Config

Create a new file `config/env.ts`:

```typescript
// IMPORTANT: In production, use environment variables
// For now, hardcode here (but DO NOT commit to git!)

export const ENV = {
  CLAUDE_API_KEY: 'sk-ant-YOUR_KEY_HERE',
  OPENAI_API_KEY: '', // For Whisper (later)
  GOOGLE_PLACES_API_KEY: '', // Optional
};
```

Add to `.gitignore`:
```
config/env.ts
```

### Step 3: Update Claude Service

Edit `services/claudeService.ts`:

```typescript
import { ENV } from '../config/env';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export const parseNote = async (transcript: string): Promise<ParsedNote> => {
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
}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const content = data.content[0].text;
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse note:', error);
    return {
      type: 'intent',
      summary: transcript,
    };
  }
};
```

---

## Part 3: Authentication Setup

### Step 1: Enable Email Auth in Supabase

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Configure:
   - **Enable email confirmations:** ON (recommended)
   - **Secure email change:** ON

### Step 2: Create Auth Screens

Create `app/(auth)/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
```

Create `app/(auth)/login.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../config/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // @ts-ignore
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Sign in to your account</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/(auth)/signup')}
      >
        <Text style={styles.link}>
          Don't have an account? <Text style={styles.linkBold}>Sign Up</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  linkBold: {
    color: '#6366f1',
    fontWeight: '600',
  },
});
```

Create `app/(auth)/signup.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../config/supabase';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        'Account created! Please check your email to verify.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Sign up to get started</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleSignUp}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Creating account...' : 'Sign Up'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.link}>
          Already have an account? <Text style={styles.linkBold}>Sign In</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  linkBold: {
    color: '#6366f1',
    fontWeight: '600',
  },
});
```

### Step 3: Add Auth Check to App

Update `app/_layout.tsx`:

```typescript
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import './globals.css';

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsAuthenticated(!!session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthenticated === null) return; // Still loading

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Not authenticated, redirect to login
      // @ts-ignore
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Authenticated but in auth screens, redirect to tabs
      // @ts-ignore
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
```

---

## Part 4: Voice Transcription (OpenAI Whisper)

### Step 1: Get OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Go to **API Keys**
4. Click **Create new secret key**
5. Copy the key (starts with `sk-...`)

### Step 2: Add to env.ts

```typescript
export const ENV = {
  CLAUDE_API_KEY: 'sk-ant-YOUR_CLAUDE_KEY',
  OPENAI_API_KEY: 'sk-YOUR_OPENAI_KEY', // Add this
  GOOGLE_PLACES_API_KEY: '',
};
```

### Step 3: Update Voice Service

Edit `services/voiceService.ts` - replace the `transcribeAudio` method:

```typescript
import { ENV } from '../config/env';
import * as FileSystem from 'expo-file-system';

async transcribeAudio(audioUri: string): Promise<string> {
  try {
    // Read the audio file
    const audioFile = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to blob
    const blob = await fetch(`data:audio/m4a;base64,${audioFile}`).then(r => r.blob());

    // Create form data
    const formData = new FormData();
    formData.append('file', blob, 'audio.m4a');
    formData.append('model', 'whisper-1');

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ENV.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error('Failed to transcribe audio:', error);
    throw error;
  }
}
```

---

## Quick Start Checklist

- [ ] Create Supabase project
- [ ] Copy Supabase URL and anon key
- [ ] Run SQL schema in Supabase (Step 3)
- [ ] Run User Profile schema in Supabase (Step 3b - for AI personalization)
- [ ] Update `config/supabase.ts` with credentials
- [ ] Get Claude API key
- [ ] Get OpenAI API key
- [ ] Create `config/env.ts` with API keys
- [ ] Create auth screens (`app/(auth)/login.tsx` and `signup.tsx`)
- [ ] Update `app/_layout.tsx` with auth check
- [ ] Set `DEMO_MODE = false` in `app/(tabs)/index.tsx`
- [ ] Test sign up
- [ ] Test login
- [ ] Test voice recording → transcription
- [ ] Test note creation
- [ ] Test plan generation
- [ ] Test onboarding flow (Settings → Take the Quiz)

---

## Testing the Backend

### 1. Sign Up
```bash
npx expo start
```
- Tap "Sign Up"
- Enter email/password
- Check email for verification link

### 2. Login
- Enter credentials
- Should redirect to home screen

### 3. Record Note
- Tap microphone
- Speak
- Should transcribe and save to database

### 4. Check Supabase
- Go to Supabase dashboard
- Table Editor → notes
- See your saved note!

---

## Troubleshooting

### "Failed to get notes: Not authenticated"
- Make sure you're logged in
- Check `supabase.auth.getSession()` returns a session

### "Invalid API key"
- Double-check keys in `config/env.ts`
- Make sure no extra spaces or quotes

### "Transcription failed"
- Check OpenAI API key
- Check audio file exists
- Check internet connection

---

**Ready to connect the backend!** Follow the steps above in order and you'll have a fully functional backend. 🚀
