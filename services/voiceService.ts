import { Audio } from 'expo-av';
import { ENV } from '../config/env';
import speechRecognitionService from './speechRecognitionService';

// Transcription method preference
export type TranscriptionMethod = 'native' | 'whisper' | 'auto';

// Placeholder for empty/garbage transcription
export const EMPTY_TRANSCRIPTION_PLACEHOLDER = '___EMPTY_RECORDING___';

// Characters/patterns that indicate garbage output from silence/noise
const GARBAGE_PATTERNS = [
  // Non-Latin scripts that typically appear with noise
  /[\u4e00-\u9fff]/g, // Chinese characters
  /[\u0600-\u06ff]/g, // Arabic
  /[\u0400-\u04ff]/g, // Cyrillic
  /[\u3040-\u309f\u30a0-\u30ff]/g, // Japanese
  /[\uac00-\ud7af]/g, // Korean
  /[\u0900-\u097f]/g, // Devanagari
  /[\u0980-\u09ff]/g, // Bengali
  /[\u0a00-\u0a7f]/g, // Gurmukhi
  /[\u0b00-\u0b7f]/g, // Oriya
  /[\u0c00-\u0c7f]/g, // Telugu
  /[\u0c80-\u0cff]/g, // Kannada
  /[\u0d00-\u0d7f]/g, // Malayalam
  /[\u0e00-\u0e7f]/g, // Thai
];

// Common whisper hallucination phrases for silence
const HALLUCINATION_PHRASES = [
  'thank you',
  'thanks for watching',
  'please subscribe',
  'like and subscribe',
  'see you next time',
  'bye bye',
  'goodbye',
  'the end',
  '...',
  'music',
  '[music]',
  'silence',
  '[silence]',
  'applause',
  '[applause]',
];

/**
 * Check if transcription is garbage/empty audio output
 */
export function isGarbageTranscription(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return true;
  }

  const trimmed = text.trim().toLowerCase();

  // Too short to be meaningful (less than 3 chars excluding punctuation)
  const alphanumericOnly = trimmed.replace(/[^a-z0-9]/gi, '');
  if (alphanumericOnly.length < 3) {
    return true;
  }

  // Check for non-English characters (likely noise hallucination)
  let nonEnglishCount = 0;
  for (const pattern of GARBAGE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      nonEnglishCount += matches.length;
    }
  }
  // If more than 30% non-English characters, consider it garbage
  if (nonEnglishCount > text.length * 0.3) {
    return true;
  }

  // Check for known hallucination phrases
  for (const phrase of HALLUCINATION_PHRASES) {
    if (trimmed === phrase || trimmed === phrase.replace(/[\[\]]/g, '')) {
      return true;
    }
  }

  // Check for emoji-only or mostly emoji content
  const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const emojiMatches = text.match(emojiPattern);
  if (emojiMatches && emojiMatches.length > text.length / 3) {
    return true;
  }

  // Check for repetitive single character/word (like "aaaaa" or "yeah yeah yeah yeah")
  const words = trimmed.split(/\s+/);
  if (words.length > 2) {
    const uniqueWords = new Set(words);
    if (uniqueWords.size === 1) {
      return true;
    }
  }

  return false;
}

class VoiceService {
  private recording: Audio.Recording | null = null;
  private isRecording: boolean = false;

  /**
   * Request microphone permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Check if microphone permissions are granted
   */
  async hasPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(): Promise<void> {
    try {
      // Check permissions first
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          throw new Error('Microphone permission not granted');
        }
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create and start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.isRecording = true;

      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording and return the audio file URI
   */
  async stopRecording(): Promise<string | null> {
    try {
      if (!this.recording) {
        console.warn('No recording in progress');
        return null;
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      this.isRecording = false;
      this.recording = null;

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      console.log('Recording stopped, file saved at:', uri);
      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  /**
   * Cancel recording without saving
   */
  async cancelRecording(): Promise<void> {
    try {
      if (!this.recording) {
        return;
      }

      await this.recording.stopAndUnloadAsync();
      this.isRecording = false;
      this.recording = null;

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      console.log('Recording cancelled');
    } catch (error) {
      console.error('Failed to cancel recording:', error);
      throw error;
    }
  }

  /**
   * Get current recording status
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get recording duration in milliseconds
   */
  async getRecordingDuration(): Promise<number> {
    if (!this.recording) {
      return 0;
    }

    try {
      const status = await this.recording.getStatusAsync();
      return status.durationMillis || 0;
    } catch (error) {
      console.error('Failed to get recording duration:', error);
      return 0;
    }
  }

  /**
   * Check if native speech recognition is available
   */
  async isNativeSpeechAvailable(): Promise<boolean> {
    return await speechRecognitionService.isAvailable();
  }

  /**
   * Get the recommended transcription method
   * Returns 'native' if available (free), otherwise 'whisper' if API key configured
   */
  async getRecommendedMethod(): Promise<TranscriptionMethod | null> {
    // Check native first (free)
    const nativeAvailable = await this.isNativeSpeechAvailable();
    if (nativeAvailable) {
      return 'native';
    }

    // Fall back to Whisper if configured
    if (ENV.OPENAI_API_KEY && ENV.OPENAI_API_KEY !== 'sk-YOUR_OPENAI_API_KEY_HERE') {
      return 'whisper';
    }

    return null;
  }

  /**
   * Convert audio file to text using OpenAI Whisper API
   * This is the FALLBACK method when native speech recognition is not available
   */
  async transcribeAudioWithWhisper(audioUri: string): Promise<string> {
    try {
      // Check if API key is configured
      if (!ENV.OPENAI_API_KEY || ENV.OPENAI_API_KEY === 'sk-YOUR_OPENAI_API_KEY_HERE') {
        throw new Error('OpenAI API key not configured. Please add your key to config/env.ts');
      }

      // Get filename from URI
      const filename = audioUri.split('/').pop() || 'audio.m4a';

      // Create form data - React Native style
      // In React Native, FormData.append for files requires an object with uri, type, and name
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: filename,
      } as any);
      formData.append('model', 'whisper-1');

      // Call OpenAI Whisper API
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ENV.OPENAI_API_KEY}`,
          // Note: Don't set Content-Type for FormData, fetch will set it automatically with boundary
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Whisper API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      if (!data.text) {
        throw new Error('No transcription returned from Whisper API');
      }

      return data.text;
    } catch (error) {
      console.error('Failed to transcribe audio with Whisper:', error);
      throw error;
    }
  }

  /**
   * Convert audio file to text - uses best available method
   * Priority: Native speech recognition (free) > Whisper API (paid)
   */
  async transcribeAudio(audioUri: string): Promise<string> {
    const method = await this.getRecommendedMethod();

    if (method === 'whisper') {
      // Use Whisper API as fallback
      console.log('Using Whisper API for transcription (native not available)');
      return this.transcribeAudioWithWhisper(audioUri);
    }

    // If native is available, we should use real-time transcription instead
    // This method is primarily for Whisper fallback now
    if (method === 'native') {
      console.warn('Native speech recognition available - use startRealtimeTranscription() instead for better UX');
      // Fall through to Whisper if API key available
      if (ENV.OPENAI_API_KEY && ENV.OPENAI_API_KEY !== 'sk-YOUR_OPENAI_API_KEY_HERE') {
        return this.transcribeAudioWithWhisper(audioUri);
      }
    }

    throw new Error('No transcription method available. Native speech recognition not supported and OpenAI API key not configured.');
  }

  /**
   * Get the speech recognition service for real-time transcription
   * Use this in components for native speech recognition
   */
  getSpeechRecognitionService() {
    return speechRecognitionService;
  }
}

export default new VoiceService();