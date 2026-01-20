# Google Sign-In Setup Guide

This guide will help you configure Google Sign-In for your Notes app.

---

## Prerequisites

- Google Cloud Console account (free)
- Supabase project (already configured)

---

## Step 1: Google Cloud Console Setup

### 1.1 Create/Select Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Note your **Project ID**

### 1.2 Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** → Click **Create**
3. Fill in the required fields:
   - **App name**: `Notes App`
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Click **Save and Continue**
5. On **Scopes** page, click **Add or Remove Scopes**
   - Add: `.../auth/userinfo.email`
   - Add: `.../auth/userinfo.profile`
   - Add: `openid`
6. Click **Save and Continue**
7. On **Test users** page, click **Add Users**
   - Add your email address (required while app is in "Testing" status)
8. Click **Save and Continue** → **Back to Dashboard**

### 1.3 Create OAuth Credentials

#### Create Web Client (Required for Supabase)

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Name: `Notes App Web`
5. Under **Authorized JavaScript origins**, add:
   ```
   https://mdhuuckzdpnfyplqwwqf.supabase.co
   ```
6. Under **Authorized redirect URIs**, add:
   ```
   https://mdhuuckzdpnfyplqwwqf.supabase.co/auth/v1/callback
   ```
7. Click **Create**
8. **SAVE these values** - you'll need them:
   - **Client ID**: `xxxx.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxxx`

---

## Step 2: Supabase Configuration

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `mdhuuckzdpnfyplqwwqf`
3. Navigate to **Authentication** → **Providers**
4. Find **Google** and toggle it **ON**
5. Enter your credentials:
   - **Client ID (for OAuth)**: Paste your Web Client ID
   - **Client Secret**: Paste your Web Client Secret
6. Click **Save**

---

## Step 3: Test in Development

### Option A: Using Expo Go (Limited)

Google OAuth will open a browser and redirect back. This should work in Expo Go:

```bash
cd /Users/pramodreddypandiri/Desktop/Projects/MobileApp/notes
npx expo start
```

### Option B: Development Build (Recommended)

For the best experience, create a development build:

```bash
# Generate native project
npx expo prebuild --platform ios

# Run on iOS Simulator
npx expo run:ios
```

---

## Step 4: Verify It Works

1. Launch your app
2. On the login screen, tap **"Continue with Google"**
3. A browser should open with Google's sign-in page
4. Select your Google account (must be added as test user)
5. Grant permissions
6. You should be redirected back to the app and signed in

---

## Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `redirect_uri_mismatch` | Redirect URI doesn't match | Verify the redirect URI in Google Console matches exactly: `https://mdhuuckzdpnfyplqwwqf.supabase.co/auth/v1/callback` |
| `Access blocked: App not verified` | Not a test user | Add your email as a test user in OAuth consent screen |
| `invalid_client` | Wrong credentials | Double-check Client ID and Secret in Supabase |
| `No access token received` | OAuth flow interrupted | Try again, check browser allowed to redirect |
| Browser opens but never returns | URL scheme issue | Verify `scheme: "notes"` is in app.json |

### Debug Steps

1. Check the console logs for the redirect URI being used
2. Verify Google provider is enabled in Supabase
3. Make sure you're using a test user email
4. Try clearing app data and signing in again

---

## Production Checklist

Before going live:

1. **Verify OAuth consent screen**:
   - Go to Google Cloud Console → OAuth consent screen
   - Click **Publish App** (moves from Testing to Production)
   - This removes the 100-user limit

2. **App verification** (if using sensitive scopes):
   - Google may require verification for production apps
   - Basic scopes (email, profile) usually don't require it

---

## Quick Reference

| Item | Value |
|------|-------|
| Supabase URL | `https://mdhuuckzdpnfyplqwwqf.supabase.co` |
| Callback URL | `https://mdhuuckzdpnfyplqwwqf.supabase.co/auth/v1/callback` |
| App URL Scheme | `notes` |
| Bundle ID | `com.notesapp.notes` |
