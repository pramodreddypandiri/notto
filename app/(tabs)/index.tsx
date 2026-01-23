/**
 * Home Screen - Premium notes interface with voice capture
 *
 * Features:
 * - Animated note cards with swipe-to-delete
 * - WhatsApp-style input bar (text + hold-to-record mic)
 * - Transcription review before saving
 * - Pull-to-refresh
 * - Skeleton loading states
 * - Bottom sheet tag selector
 * - Smooth transitions and haptic feedback
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  StatusBar,
  Alert,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

// Theme
import { colors, typography, spacing, borderRadius, layout, getThemedColors } from '../../theme';

// Context
import { useTheme } from '../../context/ThemeContext';

// Components
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import PremiumButton from '../../components/ui/PremiumButton';
import BottomSheet from '../../components/ui/BottomSheet';
import { NotesListSkeleton } from '../../components/ui/SkeletonLoader';
import NoteCard from '../../components/notes/NoteCard';
import NoteInputBar from '../../components/notes/NoteInputBar';
import TranscriptionReview from '../../components/notes/TranscriptionReview';
import TopBar from '../../components/common/TopBar';

// Services
import voiceService, { isGarbageTranscription, EMPTY_TRANSCRIPTION_PLACEHOLDER } from '../../services/voiceService';
import speechRecognitionService, { useSpeechRecognitionEvent } from '../../services/speechRecognitionService';
import { createNoteWithReminder, getNotes, updateNoteTags, deleteNote } from '../../services/notesService';
import soundService from '../../services/soundService';
import notificationService from '../../services/notificationService';
import { getUserProfile } from '../../services/profileService';

// Demo mode
const DEMO_MODE = false;

type NoteTag = 'reminder' | 'preference' | 'my_type' | 'my_vibe';

interface Note {
  id: string;
  transcript: string;
  parsed_data?: {
    summary: string;
    type: string;
  };
  created_at: string;
  tags?: NoteTag[];
  reminder_time?: string;
}

const DEMO_NOTES: Note[] = [
  {
    id: '1',
    transcript: 'I want to go bowling this weekend',
    parsed_data: { summary: 'Want to: go bowling', type: 'intent' },
    created_at: new Date().toISOString(),
    tags: ['preference'],
  },
  {
    id: '2',
    transcript: 'Try Mexican food',
    parsed_data: { summary: 'Preference: Mexican food', type: 'preference' },
    created_at: new Date(Date.now() - 3600000).toISOString(),
    tags: ['my_type'],
  },
  {
    id: '3',
    transcript: 'Email Jack about interview on Thursday',
    parsed_data: { summary: 'Task: Email Jack about interview', type: 'task' },
    created_at: new Date(Date.now() - 7200000).toISOString(),
    tags: ['reminder'],
    reminder_time: 'Thursday, 9:00 AM',
  },
];

const TAG_OPTIONS: {
  tag: NoteTag;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    tag: 'reminder',
    title: 'Reminder',
    description: 'Get notified at a specific time',
    icon: 'alarm',
  },
  {
    tag: 'preference',
    title: 'Preference',
    description: 'Things you like or want to try',
    icon: 'heart',
  },
  {
    tag: 'my_type',
    title: 'My Type',
    description: 'Activities that match your style',
    icon: 'star',
  },
  {
    tag: 'my_vibe',
    title: 'My Vibe',
    description: 'Mood and atmosphere preferences',
    icon: 'musical-notes',
  },
];

export default function HomeScreen() {
  const router = useRouter();

  // Theme
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  // State
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Voice recording state (new hold-to-record flow)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTranscriptionReview, setShowTranscriptionReview] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [currentAudioUri, setCurrentAudioUri] = useState<string | null>(null);
  const [externalRecordingStart, setExternalRecordingStart] = useState(false);
  const [useNativeSpeech, setUseNativeSpeech] = useState(false);
  const [realtimeTranscript, setRealtimeTranscript] = useState('');

  // Tag modal state
  const [showTagSheet, setShowTagSheet] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Onboarding state
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);

  // Recording duration timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isRecording) {
      setRecordingDuration(0);
      interval = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Initialize
  useEffect(() => {
    loadNotes();
    soundService.initialize();

    // Check if native speech recognition is available
    const checkNativeSpeech = async () => {
      const available = await speechRecognitionService.isAvailable();
      setUseNativeSpeech(available);
      console.log('Native speech recognition available:', available);
    };
    checkNativeSpeech();

    // Check if user needs onboarding
    const checkOnboarding = async () => {
      const profile = await getUserProfile();
      if (profile && !profile.onboarding_completed) {
        setShowOnboardingBanner(true);
      }
    };
    checkOnboarding();

    // Debug: Log scheduled notifications on app load
    notificationService.debugLogScheduledNotifications();
  }, []);

  // Whisper fallback handler
  const handleWhisperFallback = async (audioUri: string) => {
    try {
      const transcript = await voiceService.transcribeAudioWithWhisper(audioUri);
      if (isGarbageTranscription(transcript)) {
        setCurrentTranscription(EMPTY_TRANSCRIPTION_PLACEHOLDER);
      } else {
        setCurrentTranscription(transcript);
      }
    } catch (error) {
      console.error('Whisper fallback failed:', error);
      Alert.alert('Error', 'Failed to transcribe audio. Please try again.');
      setShowTranscriptionReview(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // Native speech recognition event listeners
  useSpeechRecognitionEvent('result', (event) => {
    if (event.results && event.results.length > 0) {
      // Get the last result (most recent)
      const result = event.results[event.results.length - 1];
      if (result && result.transcript) {
        setRealtimeTranscript(result.transcript);
        // If final result, set as current transcription
        if (event.isFinal) {
          const transcript = result.transcript;
          if (isGarbageTranscription(transcript)) {
            setCurrentTranscription(EMPTY_TRANSCRIPTION_PLACEHOLDER);
          } else {
            setCurrentTranscription(transcript);
          }
          setIsProcessing(false);
        }
      }
    }
  });

  useSpeechRecognitionEvent('end', () => {
    console.log('Speech recognition ended');
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.error('Speech recognition error:', event);
    // Fallback to Whisper if native fails and we have audio
    if (currentAudioUri) {
      console.log('Falling back to Whisper API...');
      handleWhisperFallback(currentAudioUri);
    } else {
      setIsProcessing(false);
      Alert.alert('Error', 'Speech recognition failed. Please try again.');
    }
  });

  const loadNotes = async () => {
    try {
      if (DEMO_MODE) {
        // Simulate loading delay
        await new Promise((resolve) => setTimeout(resolve, 800));
        setNotes(DEMO_NOTES);
        return;
      }
      const data = await getNotes(20);
      setNotes(data || []);
    } catch (error) {
      console.error('Failed to load notes:', error);
      setNotes(DEMO_NOTES);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadNotes();
    setRefreshing(false);
  }, []);

  // Text note handler
  const handleSendText = async (text: string) => {
    try {
      if (DEMO_MODE) {
        const newNote: Note = {
          id: Date.now().toString(),
          transcript: text,
          parsed_data: {
            summary: text.slice(0, 50),
            type: 'intent',
          },
          created_at: new Date().toISOString(),
        };
        setNotes([newNote, ...notes]);
        await soundService.playSuccess();
      } else {
        await createNoteWithReminder({ transcript: text });
        await loadNotes();
        await soundService.playSuccess();
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to save text note:', error);
      await soundService.playError();
      Alert.alert('Error', 'Failed to save note. Please try again.');
    }
  };

  // Voice recording handlers (hold-to-record flow)
  const handleRecordingStart = async () => {
    try {
      // Reset transcription state
      setRealtimeTranscript('');
      setCurrentTranscription('');

      // Start audio recording (for backup/storage)
      await voiceService.startRecording();
      await soundService.playRecordStart();
      setIsRecording(true);

      // If native speech recognition is available, start it for real-time transcription
      if (useNativeSpeech) {
        await speechRecognitionService.startListening({
          onStart: () => console.log('Native speech recognition started'),
          onError: (error) => console.error('Native speech error:', error),
        });
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please check permissions.');
    }
  };

  const handleRecordingEnd = async () => {
    if (!isRecording) return;

    setIsRecording(false);
    setExternalRecordingStart(false);
    setIsProcessing(true);
    setShowTranscriptionReview(true);

    try {
      // Stop audio recording
      const audioUri = await voiceService.stopRecording();
      await soundService.playRecordStop();

      if (audioUri) {
        setCurrentAudioUri(audioUri);
      }

      if (DEMO_MODE) {
        // Simulate transcription
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setCurrentTranscription('This is a demo transcription of your voice note.');
        setIsProcessing(false);
        return;
      }

      // Stop native speech recognition if it was running
      if (useNativeSpeech) {
        await speechRecognitionService.stopListening();

        // If we got a real-time transcript, use it (already set by event listener)
        if (realtimeTranscript && !isGarbageTranscription(realtimeTranscript)) {
          setCurrentTranscription(realtimeTranscript);
          setIsProcessing(false);
          console.log('Using native speech recognition result');
          return;
        }
      }

      // Fallback to Whisper API if native didn't produce results
      if (audioUri) {
        console.log('Using Whisper API for transcription');
        const transcript = await voiceService.transcribeAudioWithWhisper(audioUri);

        // Check if transcription is garbage (empty audio, noise, non-English hallucination)
        if (isGarbageTranscription(transcript)) {
          setCurrentTranscription(EMPTY_TRANSCRIPTION_PLACEHOLDER);
        } else {
          setCurrentTranscription(transcript);
        }
      }
    } catch (error) {
      console.error('Recording/transcription error:', error);
      await soundService.playError();
      setShowTranscriptionReview(false);
      Alert.alert('Error', 'Failed to process recording. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecordingCancel = async () => {
    if (isRecording) {
      voiceService.cancelRecording();
      // Also stop native speech recognition if running
      if (useNativeSpeech) {
        await speechRecognitionService.abort();
      }
      setIsRecording(false);
      setExternalRecordingStart(false);
      setRealtimeTranscript('');
    }
  };

  const handleSaveTranscription = async (text: string, reminderDate?: Date) => {
    try {
      if (DEMO_MODE) {
        const newNote: Note = {
          id: Date.now().toString(),
          transcript: text,
          parsed_data: {
            summary: text.slice(0, 50),
            type: 'intent',
          },
          created_at: new Date().toISOString(),
          tags: reminderDate ? ['reminder'] : undefined,
          reminder_time: reminderDate?.toISOString(),
        };
        setNotes([newNote, ...notes]);
      } else {
        await createNoteWithReminder({
          transcript: text,
          audioUrl: currentAudioUri || undefined,
          customReminderTime: reminderDate,
          forceReminder: !!reminderDate,
        });
        await loadNotes();
      }
      await soundService.playSuccess();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to save note:', error);
      await soundService.playError();
      Alert.alert('Error', 'Failed to save note. Please try again.');
    } finally {
      setShowTranscriptionReview(false);
      setCurrentTranscription('');
      setCurrentAudioUri(null);
    }
  };

  const handleReRecord = () => {
    setShowTranscriptionReview(false);
    setCurrentTranscription('');
    setCurrentAudioUri(null);
    // Mark as external recording start (tap-to-stop mode)
    setExternalRecordingStart(true);
    // Small delay before allowing re-record
    setTimeout(() => {
      handleRecordingStart();
    }, 300);
  };

  const handleCancelReview = () => {
    setShowTranscriptionReview(false);
    setCurrentTranscription('');
    setCurrentAudioUri(null);
  };

  // Note actions
  const handleDeleteNote = (noteId: string) => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Optimistically remove from UI
          setNotes(notes.filter((note) => note.id !== noteId));

          // Actually delete from database
          if (!DEMO_MODE) {
            try {
              await deleteNote(noteId);
            } catch (error) {
              console.error('Failed to delete note:', error);
              // Reload notes if delete failed
              await loadNotes();
              Alert.alert('Error', 'Failed to delete note. Please try again.');
            }
          }
        },
      },
    ]);
  };

  const handleTagPress = (noteId: string) => {
    setSelectedNoteId(noteId);
    setShowTagSheet(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const applyTag = async (tag: NoteTag) => {
    if (!selectedNoteId) return;

    const note = notes.find((n) => n.id === selectedNoteId);
    if (!note) return;

    const currentTags = note.tags || [];
    const hasTag = currentTags.includes(tag);
    const newTags = hasTag
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];

    // Update local state immediately for responsive UI
    setNotes(
      notes.map((n) => {
        if (n.id === selectedNoteId) {
          return { ...n, tags: newTags };
        }
        return n;
      })
    );

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowTagSheet(false);
    setSelectedNoteId(null);

    // Save to database (don't block UI)
    if (!DEMO_MODE) {
      const success = await updateNoteTags(selectedNoteId, newTags);
      if (!success) {
        // Revert on failure
        setNotes(
          notes.map((n) => {
            if (n.id === selectedNoteId) {
              return { ...n, tags: currentTags };
            }
            return n;
          })
        );
        Alert.alert('Error', 'Failed to update tag. Please try again.');
      }
    }
  };

  const navigateToPlans = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/plans');
  };

  const navigateToOnboarding = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/onboarding');
  };

  return (
    <View style={[styles.container, { backgroundColor: themedColors.background.primary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Bar with greeting and profile */}
      <TopBar themedColors={themedColors} />

      {/* Onboarding Banner for new users */}
      {showOnboardingBanner && (
        <Animated.View
          entering={FadeInDown.delay(200).springify()}
          style={styles.onboardingBanner}
        >
          <AnimatedPressable
            onPress={navigateToOnboarding}
            style={styles.onboardingCard}
            hapticType="medium"
            scaleIntensity="subtle"
          >
            <LinearGradient
              colors={[colors.accent.violet.base, colors.accent.violet.dark] as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.onboardingCardGradient}
            >
              <View style={styles.onboardingCardContent}>
                <View style={styles.onboardingCardIcon}>
                  <Ionicons name="person-add" size={24} color={colors.neutral[0]} />
                </View>
                <View style={styles.onboardingCardText}>
                  <Text style={styles.onboardingCardTitle}>Personalize Your Experience</Text>
                  <Text style={styles.onboardingCardSubtitle}>Take a quick quiz to get better recommendations</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.neutral[0]} />
              </View>
            </LinearGradient>
          </AnimatedPressable>
        </Animated.View>
      )}

      {/* Plan Weekend Card */}
      <View style={styles.planCardContainer}>
        <AnimatedPressable
          onPress={navigateToPlans}
          style={styles.planCard}
          hapticType="medium"
          scaleIntensity="subtle"
        >
          <LinearGradient
            colors={colors.gradients.primary as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.planCardGradient}
          >
            <View style={styles.planCardContent}>
              <View style={styles.planCardIcon}>
                <Ionicons name="sparkles" size={24} color={colors.neutral[0]} />
              </View>
              <View style={styles.planCardText}>
                <Text style={styles.planCardTitle}>Plan My Weekend</Text>
                <Text style={styles.planCardSubtitle}>Generate personalized plans</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[0]} />
            </View>
          </LinearGradient>
        </AnimatedPressable>
      </View>

      {/* Notes List */}
      <View style={styles.notesSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: themedColors.text.primary }]}>Recent Notes</Text>
          <Text style={[styles.noteCount, { color: themedColors.text.tertiary }]}>{notes.length} notes</Text>
        </View>

        {loading ? (
          <NotesListSkeleton count={3} />
        ) : (
          <Animated.ScrollView
            entering={FadeIn.delay(300)}
            style={styles.notesList}
            contentContainerStyle={styles.notesListContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary[500]}
                colors={[colors.primary[500]]}
              />
            }
          >
            {notes.length === 0 ? (
              <EmptyState onRecord={handleRecordingStart} themedColors={themedColors} />
            ) : (
              notes.map((note, index) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  index={index}
                  onDelete={handleDeleteNote}
                  onTagPress={handleTagPress}
                />
              ))
            )}
          </Animated.ScrollView>
        )}
      </View>

      {/* Input Bar - WhatsApp style (text input + hold-to-record mic) */}
      <View style={styles.inputBarContainer}>
        <NoteInputBar
          onSendText={handleSendText}
          onRecordingStart={handleRecordingStart}
          onRecordingEnd={handleRecordingEnd}
          onRecordingCancel={handleRecordingCancel}
          isRecording={isRecording}
          recordingDuration={recordingDuration}
          themedColors={themedColors}
          externalRecordingStart={externalRecordingStart}
        />
      </View>

      {/* Transcription Review Modal */}
      <TranscriptionReview
        visible={showTranscriptionReview}
        transcription={currentTranscription}
        isProcessing={isProcessing}
        onSave={handleSaveTranscription}
        onReRecord={handleReRecord}
        onCancel={handleCancelReview}
        themedColors={themedColors}
      />

      {/* Tag Selection Bottom Sheet */}
      <BottomSheet
        visible={showTagSheet}
        onClose={() => {
          setShowTagSheet(false);
          setSelectedNoteId(null);
        }}
        height={55}
      >
        <Text style={[styles.sheetTitle, { color: themedColors.text.primary }]}>Tag Note</Text>
        <Text style={[styles.sheetSubtitle, { color: themedColors.text.tertiary }]}>
          Choose a tag to organize your note
        </Text>

        <View style={styles.tagOptions}>
          {TAG_OPTIONS.map((option, index) => (
            <TagOption
              key={option.tag}
              option={option}
              index={index}
              onPress={() => applyTag(option.tag)}
              isSelected={
                selectedNoteId
                  ? notes
                      .find((n) => n.id === selectedNoteId)
                      ?.tags?.includes(option.tag) || false
                  : false
              }
              themedColors={themedColors}
            />
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

// Tag Option Component
function TagOption({
  option,
  index,
  onPress,
  isSelected,
  themedColors,
}: {
  option: (typeof TAG_OPTIONS)[0];
  index: number;
  onPress: () => void;
  isSelected: boolean;
  themedColors?: ReturnType<typeof getThemedColors>;
}) {
  const tagColor = {
    reminder: colors.accent.rose,
    preference: colors.accent.emerald,
    my_type: colors.accent.violet,
    my_vibe: colors.accent.amber,
  }[option.tag];

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).springify()}
    >
      <AnimatedPressable
        onPress={onPress}
        style={[
          styles.tagOption,
          {
            backgroundColor: isSelected ? tagColor.light : (themedColors?.surface.secondary || colors.neutral[50]),
            borderColor: isSelected ? tagColor.base : (themedColors?.surface.border || colors.neutral[200]),
          },
        ]}
        hapticType="light"
      >
        <View
          style={[
            styles.tagOptionIcon,
            { backgroundColor: tagColor.light },
          ]}
        >
          <Ionicons
            name={option.icon as any}
            size={20}
            color={tagColor.base}
          />
        </View>
        <View style={styles.tagOptionText}>
          <Text style={[styles.tagOptionTitle, { color: themedColors?.text.primary || colors.neutral[900] }]}>{option.title}</Text>
          <Text style={[styles.tagOptionDesc, { color: themedColors?.text.tertiary || colors.neutral[500] }]}>{option.description}</Text>
        </View>
        {isSelected && (
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={tagColor.base}
          />
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

// Empty State Component
function EmptyState({ onRecord, themedColors }: { onRecord: () => void; themedColors?: ReturnType<typeof getThemedColors> }) {
  return (
    <Animated.View
      entering={FadeIn.delay(300)}
      style={styles.emptyState}
    >
      <View style={[styles.emptyIcon, { backgroundColor: themedColors?.primary[50] || colors.primary[50] }]}>
        <Ionicons name="mic-outline" size={48} color={colors.primary[300]} />
      </View>
      <Text style={[styles.emptyTitle, { color: themedColors?.text.primary || colors.neutral[900] }]}>No notes yet</Text>
      <Text style={[styles.emptyText, { color: themedColors?.text.tertiary || colors.neutral[500] }]}>
        Tap the microphone to capture your first note
      </Text>
      <PremiumButton
        onPress={onRecord}
        gradient
        icon={<Ionicons name="mic" size={20} color={colors.neutral[0]} />}
      >
        Start Recording
      </PremiumButton>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  onboardingBanner: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  onboardingCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  onboardingCardGradient: {
    padding: spacing[4],
  },
  onboardingCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  onboardingCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onboardingCardText: {
    flex: 1,
  },
  onboardingCardTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
    marginBottom: spacing[1],
  },
  onboardingCardSubtitle: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  planCardContainer: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  planCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  planCardGradient: {
    padding: spacing[4],
  },
  planCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  planCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planCardText: {
    flex: 1,
  },
  planCardTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
    marginBottom: spacing[1],
  },
  planCardSubtitle: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  notesSection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[900],
  },
  noteCount: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
  },
  notesList: {
    flex: 1,
  },
  notesListContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[20], // Space for input bar + tab bar
  },
  inputBarContainer: {
    // Positioned above the tab bar
    marginBottom: layout.tabBarHeight,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
    paddingTop: spacing[12],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[900],
    marginBottom: spacing[2],
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[500],
    textAlign: 'center',
    marginBottom: spacing[6],
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
  },
  sheetTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[900],
    marginBottom: spacing[1],
  },
  sheetSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    marginBottom: spacing[5],
  },
  tagOptions: {
    gap: spacing[3],
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    gap: spacing[3],
  },
  tagOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagOptionText: {
    flex: 1,
  },
  tagOptionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[900],
    marginBottom: 2,
  },
  tagOptionDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
  },
});
