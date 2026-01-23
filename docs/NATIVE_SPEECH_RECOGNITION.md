# Native Speech Recognition Setup

This guide explains how to enable free, native speech recognition in your app using `expo-speech-recognition`.

## Overview

| Environment | Transcription Method | Cost | Real-time |
|-------------|---------------------|------|-----------|
| Expo Go | OpenAI Whisper API | ~$0.006/min | No |
| Development Build | Native (Siri/Google) | **Free** | Yes |
| Production Build | Native (Siri/Google) | **Free** | Yes |

## Why Native Speech Recognition?

- **Free**: Uses device's built-in speech engine (Siri on iOS, Google on Android)
- **Real-time**: See transcription as you speak
- **Offline**: Works without internet on iOS (Android may require internet)
- **Privacy**: Audio stays on device

## Current State (Expo Go)

The app currently uses a **stub implementation** for `speechRecognitionService.ts` that always returns "not available". This allows the app to run in Expo Go while falling back to Whisper API.

## Enabling Native Speech Recognition

### Step 1: Create a Development Build

```bash
# Install EAS CLI (if not already installed)
npm install -g eas-cli

# Login to Expo
eas login

# Create development build for iOS
eas build --profile development --platform ios

# Or for Android
eas build --profile development --platform android

# Or build locally (requires Xcode/Android Studio)
npx expo prebuild
npx expo run:ios  # or run:android
```

### Step 2: Replace the Stub Implementation

Replace the contents of `services/speechRecognitionService.ts` with the full implementation:

```typescript
/**
 * Speech Recognition Service (Full Implementation)
 *
 * Uses expo-speech-recognition for native device speech-to-text.
 */

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
}

export interface SpeechRecognitionCallbacks {
  onResult?: (result: TranscriptionResult) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

class SpeechRecognitionService {
  private isListening: boolean = false;
  private callbacks: SpeechRecognitionCallbacks = {};

  isModuleAvailable(): boolean {
    return true;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return result.granted;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  async hasPermissions(): Promise<boolean> {
    try {
      const result = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      return result.granted;
    } catch (error) {
      return false;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch (error) {
      return false;
    }
  }

  async startListening(callbacks: SpeechRecognitionCallbacks = {}): Promise<boolean> {
    try {
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          callbacks.onError?.('Permission not granted');
          return false;
        }
      }

      const available = await this.isAvailable();
      if (!available) {
        callbacks.onError?.('Speech recognition not available');
        return false;
      }

      this.callbacks = callbacks;
      this.isListening = true;

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
        contextualStrings: [
          'remind me',
          "don't forget",
          'tomorrow',
          'next week',
          'meeting',
          'call',
          'email',
        ],
      });

      callbacks.onStart?.();
      return true;
    } catch (error) {
      console.error('Failed to start:', error);
      callbacks.onError?.(`Failed: ${error}`);
      return false;
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isListening) return;
    try {
      ExpoSpeechRecognitionModule.stop();
      this.isListening = false;
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  }

  async abort(): Promise<void> {
    try {
      ExpoSpeechRecognitionModule.abort();
      this.isListening = false;
    } catch (error) {
      console.error('Failed to abort:', error);
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  getCallbacks(): SpeechRecognitionCallbacks {
    return this.callbacks;
  }
}

export const speechRecognitionService = new SpeechRecognitionService();
export { useSpeechRecognitionEvent };
export default speechRecognitionService;
```

### Step 3: Update Home Screen Event Handlers

The home screen (`app/(tabs)/index.tsx`) already has the event handlers set up. They will automatically work once the native module is available:

```typescript
// These event handlers are already in place
useSpeechRecognitionEvent('result', (event) => {
  if (event.results && event.results.length > 0) {
    const result = event.results[event.results.length - 1];
    if (result && result.transcript) {
      setRealtimeTranscript(result.transcript);
      if (event.isFinal) {
        setCurrentTranscription(result.transcript);
        setIsProcessing(false);
      }
    }
  }
});
```

## Configuration (Already Done)

### app.json

The following permissions are already configured:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSSpeechRecognitionUsageDescription": "This app uses speech recognition to convert your voice notes to text.",
        "NSMicrophoneUsageDescription": "This app needs microphone access to record voice notes."
      }
    },
    "plugins": [
      "expo-speech-recognition"
    ]
  }
}
```

## How It Works

### Recording Flow (Development Build)

```
1. User presses record button
   │
2. Audio recording starts (expo-av)
   │
3. Native speech recognition starts simultaneously
   │
4. Real-time transcripts appear as user speaks
   │
5. User stops recording
   │
6. Final transcript is used (no API call needed!)
   │
7. Note is saved with transcription
```

### Fallback Behavior

If native speech recognition fails or produces no results:

```
Native fails → Check for audio file → Call Whisper API → Use result
```

## Troubleshooting

### "Cannot find native module 'ExpoSpeechRecognition'"

This error means you're running in Expo Go. You need a development build:

```bash
npx expo prebuild
npx expo run:ios
```

### Speech recognition not working on Android

- Android may require internet connection for speech recognition
- Some older devices may not support speech recognition
- Check that Google app is installed and updated

### Speech recognition not working on iOS

- Ensure Siri is enabled in device settings
- Check that speech recognition is enabled in Settings > Privacy > Speech Recognition
- iOS 13+ is required

## Cost Comparison

| Monthly Usage | Whisper API | Native Speech |
|---------------|-------------|---------------|
| 100 minutes | $0.60 | **$0** |
| 1,000 minutes | $6.00 | **$0** |
| 10,000 minutes | $60.00 | **$0** |

## Files Reference

| File | Purpose |
|------|---------|
| `services/speechRecognitionService.ts` | Main service (stub in Expo Go, full in dev build) |
| `services/voiceService.ts` | Orchestrates recording + transcription |
| `app/(tabs)/index.tsx` | Home screen with event handlers |
| `app.json` | Permissions and plugin config |

## Next Steps

1. Create a development build
2. Replace the stub implementation
3. Test native speech recognition
4. Build for production

For questions, see the [expo-speech-recognition documentation](https://docs.expo.dev/versions/latest/sdk/speech-recognition/).
