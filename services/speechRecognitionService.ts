// Dynamic import to handle when native module is not available (Expo Go)
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = () => {}; // No-op fallback

// Try to load the native module
try {
  const speechRecognition = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = speechRecognition.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = speechRecognition.useSpeechRecognitionEvent;
} catch (error) {
  console.log('expo-speech-recognition not available (running in Expo Go?) - will use Whisper API fallback');
}

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
  private isModuleAvailable: boolean = ExpoSpeechRecognitionModule !== null;

  /**
   * Request speech recognition permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return result.granted;
    } catch (error) {
      console.error('Error requesting speech recognition permissions:', error);
      return false;
    }
  }

  /**
   * Check if speech recognition permissions are granted
   */
  async hasPermissions(): Promise<boolean> {
    try {
      const result = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      return result.granted;
    } catch (error) {
      console.error('Error checking speech recognition permissions:', error);
      return false;
    }
  }

  /**
   * Check if speech recognition is available on this device
   */
  async isAvailable(): Promise<boolean> {
    try {
      const available = await ExpoSpeechRecognitionModule.isRecognitionAvailable();
      return available;
    } catch (error) {
      console.error('Error checking speech recognition availability:', error);
      return false;
    }
  }

  /**
   * Start listening for speech with real-time transcription
   */
  async startListening(callbacks: SpeechRecognitionCallbacks = {}): Promise<boolean> {
    try {
      // Check permissions first
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          callbacks.onError?.('Speech recognition permission not granted');
          return false;
        }
      }

      // Check availability
      const available = await this.isAvailable();
      if (!available) {
        callbacks.onError?.('Speech recognition is not available on this device');
        return false;
      }

      this.callbacks = callbacks;
      this.isListening = true;

      // Start speech recognition
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true, // Get results while speaking
        maxAlternatives: 1,
        continuous: true, // Keep listening until stopped
        requiresOnDeviceRecognition: false, // Use on-device if available, fallback to cloud
        addsPunctuation: true, // Auto-add punctuation
        contextualStrings: [
          // Help recognition with common reminder phrases
          'remind me',
          'don\'t forget',
          'tomorrow',
          'next week',
          'meeting',
          'call',
          'email',
        ],
      });

      callbacks.onStart?.();
      console.log('Speech recognition started');
      return true;
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      callbacks.onError?.(`Failed to start: ${error}`);
      return false;
    }
  }

  /**
   * Stop listening and get final transcription
   */
  async stopListening(): Promise<void> {
    try {
      if (!this.isListening) {
        return;
      }

      ExpoSpeechRecognitionModule.stop();
      this.isListening = false;
      console.log('Speech recognition stopped');
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
    }
  }

  /**
   * Abort listening without processing
   */
  async abort(): Promise<void> {
    try {
      ExpoSpeechRecognitionModule.abort();
      this.isListening = false;
      console.log('Speech recognition aborted');
    } catch (error) {
      console.error('Failed to abort speech recognition:', error);
    }
  }

  /**
   * Get current listening status
   */
  getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * Handle recognition result event
   * Call this from the component using useSpeechRecognitionEvent
   */
  handleResult(event: { results: Array<{ transcript: string; confidence: number }[]>; isFinal: boolean }): void {
    if (event.results && event.results.length > 0) {
      const result = event.results[event.results.length - 1];
      if (result && result.length > 0) {
        this.callbacks.onResult?.({
          text: result[0].transcript,
          isFinal: event.isFinal,
          confidence: result[0].confidence,
        });
      }
    }
  }

  /**
   * Handle recognition error event
   */
  handleError(event: { error: string; message?: string }): void {
    console.error('Speech recognition error:', event);
    this.isListening = false;
    this.callbacks.onError?.(event.message || event.error);
  }

  /**
   * Handle recognition end event
   */
  handleEnd(): void {
    this.isListening = false;
    this.callbacks.onEnd?.();
  }
}

// Export singleton instance
export const speechRecognitionService = new SpeechRecognitionService();

// Export hook for use in components
export { useSpeechRecognitionEvent };

export default speechRecognitionService;
