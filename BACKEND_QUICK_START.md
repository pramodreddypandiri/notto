# Backend Setup - Quick Start Guide

## 📋 What You Need

1. **Supabase Account** (Database & Auth) - FREE
2. **Anthropic API Key** (Claude AI) - Pay-as-you-go
3. **OpenAI API Key** (Whisper transcription) - Pay-as-you-go

Total estimated cost for testing: **$5-10/month**

---

## 🚀 5-Minute Setup

### Step 1: Supabase (2 minutes)

1. **Create project:** [supabase.com/dashboard](https://supabase.com/dashboard)
   - Click "New Project"
   - Name: `weekend-planner`
   - Choose region nearest to you
   - Set database password (save it!)

2. **Get credentials:**
   - Go to Settings → API
   - Copy **Project URL** and **anon/public key**

3. **Create tables:**
   - Go to SQL Editor
   - Paste SQL from [BACKEND_SETUP.md](BACKEND_SETUP.md) (Part 1, Step 3)
   - Click Run

4. **Update app:**
   - Edit [config/supabase.ts](config/supabase.ts)
   - Replace `SUPABASE_URL` and `SUPABASE_ANON_KEY`

### Step 2: API Keys (2 minutes)

1. **Claude API:**
   - Go to [console.anthropic.com](https://console.anthropic.com)
   - Create API key
   - Copy it (starts with `sk-ant-...`)

2. **OpenAI API:**
   - Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Create API key
   - Copy it (starts with `sk-...`)

3. **Save keys:**
   ```bash
   cd config
   cp env.example.ts env.ts
   ```
   - Edit `env.ts` with your actual keys

### Step 3: Disable Demo Mode (30 seconds)

Edit these files and change `DEMO_MODE`:

1. **[app/(tabs)/index.tsx](app/(tabs)/index.tsx#L23)**
   ```typescript
   const DEMO_MODE = false; // Change to false
   ```

2. **[app/(tabs)/plans.tsx](app/(tabs)/plans.tsx#L15)**
   ```typescript
   const DEMO_MODE = false; // Change to false
   ```

---

## ✅ Backend is Ready!

Now you can:
- ✅ Sign up / Login
- ✅ Record voice notes → transcribed automatically
- ✅ Notes saved to database
- ✅ AI parses notes into tasks/preferences
- ✅ Generate weekend plans with Claude
- ✅ All data persists

---

## 📊 Database Schema

Your Supabase database now has these tables:

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `user_preferences` | User location & settings | location_city, location_lat, location_lng |
| `notes` | Voice notes & transcriptions | transcript, parsed_data, tags, reminder_time |
| `plans` | Weekend plans | plan_data, for_date |
| `feedback` | Plan ratings (👍/👎) | rating, reason |

All tables have **Row Level Security (RLS)** enabled - users can only see their own data.

---

## 🧪 Testing Your Backend

### 1. Sign Up
```bash
npx expo start
```
- App should redirect to login screen
- Tap "Sign Up"
- Enter email/password
- Check email for confirmation

### 2. Login
- Enter your credentials
- Should redirect to Home screen

### 3. Record a Note
- Tap microphone button
- Say: "I want to go bowling this weekend"
- Wait for transcription
- Note appears with AI-parsed summary

### 4. Check Database
- Go to Supabase dashboard
- Click "Table Editor" → "notes"
- Your note is there! 🎉

### 5. Generate Plans
- Navigate to Plans tab
- Tap "Generate Plans"
- Claude creates 2-3 weekend plans
- Based on your notes and location

---

## 🔧 Files You Need to Edit

### Must Edit (Required)

1. **[config/supabase.ts](config/supabase.ts)**
   ```typescript
   const SUPABASE_URL = 'https://xxxxx.supabase.co'; // YOUR URL
   const SUPABASE_ANON_KEY = 'eyJhbGc...'; // YOUR KEY
   ```

2. **[config/env.ts](config/env.ts)** (create from env.example.ts)
   ```typescript
   export const ENV = {
     CLAUDE_API_KEY: 'sk-ant-...',  // YOUR CLAUDE KEY
     OPENAI_API_KEY: 'sk-...',       // YOUR OPENAI KEY
     GOOGLE_PLACES_API_KEY: '',      // Optional
   };
   ```

3. **[app/(tabs)/index.tsx](app/(tabs)/index.tsx#L23)**
   ```typescript
   const DEMO_MODE = false; // Disable demo mode
   ```

4. **[app/(tabs)/plans.tsx](app/(tabs)/plans.tsx#L15)**
   ```typescript
   const DEMO_MODE = false; // Disable demo mode
   ```

### Already Created (No edits needed)

- ✅ Database schema (in BACKEND_SETUP.md)
- ✅ Auth screens (need to be created - see below)
- ✅ Voice transcription service
- ✅ Notification service

---

## 🔐 Authentication Screens (To Do)

You need to create these files:

### 1. Auth Layout
**File:** `app/(auth)/_layout.tsx`

See [BACKEND_SETUP.md Part 3, Step 2](BACKEND_SETUP.md) for full code.

### 2. Login Screen
**File:** `app/(auth)/login.tsx`

Features:
- Email/password input
- Sign in button
- Link to sign up

### 3. Sign Up Screen
**File:** `app/(auth)/signup.tsx`

Features:
- Email/password input
- Password confirmation
- Create account button
- Link to login

### 4. Update Root Layout
**File:** `app/_layout.tsx`

Add auth state listener and redirect logic.

Full code in [BACKEND_SETUP.md Part 3, Step 3](BACKEND_SETUP.md).

---

## 💰 Cost Estimates

### Supabase
- **Free tier:** 500MB database, 2GB bandwidth
- Good for: 100s of users
- Upgrade: $25/month for unlimited

### Claude API (Anthropic)
- **Cost:** ~$0.003 per note parsed
- **Cost:** ~$0.015 per plan generated
- **Example:** 100 notes + 10 plans = $0.45

### OpenAI Whisper
- **Cost:** $0.006 per minute of audio
- **Example:** 100 notes (30 seconds each) = $0.30

### Total for Testing
- First month: ~$5-10 depending on usage
- Production: Scales with usage

---

## 🐛 Common Issues & Fixes

### "Not authenticated" error
**Fix:** Make sure you've logged in and session exists.
```typescript
const { data: { session } } = await supabase.auth.getSession();
console.log(session); // Should not be null
```

### "Invalid API key" for Claude
**Fix:** Check `config/env.ts`
- No extra spaces
- Starts with `sk-ant-`
- No quotes around the key in the file

### "Failed to transcribe audio"
**Fix:** Check OpenAI key and internet connection.
```typescript
console.log(ENV.OPENAI_API_KEY); // Verify key is loaded
```

### "Table doesn't exist"
**Fix:** Run the SQL schema in Supabase dashboard.
- Go to SQL Editor
- Paste schema from BACKEND_SETUP.md
- Click Run

### App crashes on startup
**Fix:** Make sure auth layout is created.
- Create `app/(auth)/_layout.tsx`
- Create `app/(auth)/login.tsx`
- Create `app/(auth)/signup.tsx`

---

## 📱 What Works Now

### With Backend Connected

✅ **Authentication**
- Sign up with email
- Email verification
- Login/logout
- Session persistence

✅ **Voice Notes**
- Record audio
- Transcribe with Whisper
- Parse with Claude AI
- Save to database
- Tag & delete

✅ **Weekend Plans**
- Generate 2-3 plans
- Use Claude AI + web search
- Save to database
- Like/dislike feedback

✅ **Notifications**
- Schedule reminders
- Badge count
- System notifications

✅ **Settings**
- Save location
- User preferences

---

## 🎯 Next Steps

1. **Complete auth screens** (30 minutes)
   - Copy code from BACKEND_SETUP.md Part 3
   - Create 3 files in `app/(auth)/`
   - Update `app/_layout.tsx`

2. **Get API keys** (5 minutes)
   - Anthropic Console
   - OpenAI Platform

3. **Configure credentials** (5 minutes)
   - Update supabase.ts
   - Create env.ts from example

4. **Test!** (10 minutes)
   - Sign up
   - Record note
   - Generate plan
   - Check database

---

## 📚 Documentation

- **[BACKEND_SETUP.md](BACKEND_SETUP.md)** - Complete setup guide with all code
- **[NEW_FEATURES.md](NEW_FEATURES.md)** - Frontend features documentation
- **[DEMO_MODE.md](DEMO_MODE.md)** - How demo mode works
- **THIS FILE** - Quick reference

---

## 🎉 You're Almost There!

The backend infrastructure is designed and ready. Just need to:

1. ☐ Create Supabase project (2 min)
2. ☐ Get API keys (3 min)
3. ☐ Update config files (2 min)
4. ☐ Create auth screens (30 min)
5. ☐ Disable demo mode (30 sec)
6. ☐ Test! (10 min)

**Total time: ~45 minutes** and you'll have a fully functional backend! 🚀

---

**Need help?** Check [BACKEND_SETUP.md](BACKEND_SETUP.md) for detailed step-by-step instructions with complete code examples.
