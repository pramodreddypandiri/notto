/**
 * Speech Recognition Service (Stub for Expo Go)
 *
 * This is a stub implementation that always returns "not available".
 * The app will fall back to using Whisper API for transcription.
 *
 * To enable native speech recognition:
 * 1. Create a development build: npx expo prebuild && npx expo run:ios
 * 2. Uncomment the expo-speech-recognition imports and implementation
 *
 * Native speech recognition benefits:
 * - Free (no API costs)
 * - Real-time transcription
 * - Works offline (iOS)
 */

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

/**
 * Stub implementation for Expo Go compatibility
 * All methods return false/no-op to signal Whisper API should be used
 */
class SpeechRecognitionService {
  private isListening: boolean = false;

  /**
   * Check if the native module is available
   * Returns false in Expo Go
   */
  isModuleAvailable(): boolean {
    return false;
  }

  /**
   * Check if speech recognition is available
   * Returns false in Expo Go
   */
  async isAvailable(): Promise<boolean> {
    return false;
  }

  /**
   * Request permissions - no-op in Expo Go
   */
  async requestPermissions(): Promise<boolean> {
    return false;
  }

  /**
   * Check permissions - no-op in Expo Go
   */
  async hasPermissions(): Promise<boolean> {
    return false;
  }

  /**
   * Start listening - no-op in Expo Go
   */
  async startListening(_callbacks: SpeechRecognitionCallbacks = {}): Promise<boolean> {
    console.log('[SpeechRecognition] Not available in Expo Go - using Whisper API');
    return false;
  }

  /**
   * Stop listening - no-op
   */
  async stopListening(): Promise<void> {
    this.isListening = false;
  }

  /**
   * Abort listening - no-op
   */
  async abort(): Promise<void> {
    this.isListening = false;
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  getCallbacks(): SpeechRecognitionCallbacks {
    return {};
  }
}

// Singleton instance
export const speechRecognitionService = new SpeechRecognitionService();

/**
 * Hook for speech recognition events - no-op in Expo Go
 */
export const useSpeechRecognitionEvent = (_eventName: string, _callback: (event: any) => void): void => {
  // No-op - native module not available in Expo Go
};

export default speechRecognitionService;
