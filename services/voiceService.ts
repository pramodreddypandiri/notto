import { Audio } from 'expo-av';
import { ENV } from '../config/env';

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
   * Convert audio file to text using OpenAI Whisper API
   */
  async transcribeAudio(audioUri: string): Promise<string> {
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
      console.error('Failed to transcribe audio:', error);
      throw error;
    }
  }
}

export default new VoiceService();