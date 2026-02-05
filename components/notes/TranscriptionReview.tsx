/**
 * TranscriptionReview - Review transcription before saving
 *
 * Features:
 * - Shows transcribed text for review/editing
 * - Option to manually set reminder time
 * - Save, re-record, or edit options
 * - Smooth animated modal appearance
 * - Dark mode support
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AnimatedPressable from '../ui/AnimatedPressable';
import PremiumButton from '../ui/PremiumButton';
import ReminderPicker from './ReminderPicker';
import notificationService from '../../services/notificationService';
import { EMPTY_TRANSCRIPTION_PLACEHOLDER } from '../../services/voiceService';
import { colors, typography, spacing, borderRadius, shadows, getThemedColors } from '../../theme';

interface TranscriptionReviewProps {
  visible: boolean;
  transcription: string;
  isProcessing: boolean;
  onSave: (text: string, reminderDate?: Date) => void | Promise<void>;
  onReRecord: () => void;
  onCancel: () => void;
  themedColors: ReturnType<typeof getThemedColors>;
}

export function TranscriptionReview({
  visible,
  transcription,
  isProcessing,
  onSave,
  onReRecord,
  onCancel,
  themedColors,
}: TranscriptionReviewProps) {
  const [editedText, setEditedText] = useState(transcription);
  const [isEditing, setIsEditing] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [customReminderDate, setCustomReminderDate] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Check if this is an empty recording
  const isEmptyRecording = transcription === EMPTY_TRANSCRIPTION_PLACEHOLDER;

  // Update edited text when transcription changes
  useEffect(() => {
    // Don't set the placeholder as editable text
    setEditedText(isEmptyRecording ? '' : transcription);
    setIsEditing(false);
    setCustomReminderDate(null);
    setIsSaving(false);
  }, [transcription, isEmptyRecording]);

  // Get the active reminder display (only custom - auto-detection happens after saving)
  const activeReminder = customReminderDate ? {
    date: customReminderDate,
    displayText: notificationService.formatReminderDisplay(customReminderDate),
    isValid: true,
  } : null;

  const handleSave = async () => {
    if (editedText.trim().length > 0 && !isSaving) {
      setIsSaving(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        await onSave(editedText.trim(), activeReminder?.date);
      } catch {
        setIsSaving(false);
      }
    }
  };

  const handleReRecord = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReRecord();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  const handleReminderPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowReminderPicker(true);
  };

  const handleReminderSelect = (date: Date) => {
    setCustomReminderDate(date);
    setShowReminderPicker(false);
  };

  const handleSaveWithReminder = async (date: Date) => {
    if (editedText.trim().length > 0 && !isSaving) {
      setShowReminderPicker(false);
      setIsSaving(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        await onSave(editedText.trim(), date);
      } catch {
        setIsSaving(false);
      }
    }
  };

  const handleReminderPickerClose = () => {
    setShowReminderPicker(false);
  };

  const handleRemoveReminder = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCustomReminderDate(null);
  };

  if (!visible) return null;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={showReminderPicker ? handleReminderPickerClose : handleCancel}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          {/* Backdrop */}
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.backdrop}
          >
            <AnimatedPressable
              onPress={handleCancel}
              style={StyleSheet.absoluteFill}
              hapticType="light"
            >
              <View style={StyleSheet.absoluteFill} />
            </AnimatedPressable>
          </Animated.View>

          {/* Content */}
          <Animated.View
            entering={SlideInDown.duration(350).damping(0.8)}
            exiting={SlideOutDown.duration(250)}
            style={[
              styles.content,
              {
                backgroundColor: themedColors.surface.primary,
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: themedColors.text.primary }]}>
                {isProcessing ? 'Processing...' : 'Review Your Note'}
              </Text>
              <AnimatedPressable
                onPress={handleCancel}
                style={[styles.closeButton, { backgroundColor: themedColors.surface.secondary, opacity: isSaving ? 0.5 : 1 }]}
                hapticType="light"
                disabled={isSaving}
              >
                <Ionicons name="close" size={20} color={themedColors.text.tertiary} />
              </AnimatedPressable>
            </View>

            {isProcessing ? (
              // Processing state
              <View style={styles.processingContainer}>
                <View style={styles.processingIcon}>
                  <Ionicons name="sync" size={32} color={colors.primary[500]} />
                </View>
                <Text style={[styles.processingText, { color: themedColors.text.secondary }]}>
                  Transcribing your voice note...
                </Text>
              </View>
            ) : isEmptyRecording ? (
              // Empty recording state
              <View style={styles.emptyRecordingContainer}>
                <View style={[styles.emptyRecordingIcon, { backgroundColor: themedColors.surface.secondary }]}>
                  <Ionicons name="mic-off-outline" size={40} color={themedColors.text.tertiary} />
                </View>
                <Text style={[styles.emptyRecordingTitle, { color: themedColors.text.primary }]}>
                  Nothing recorded
                </Text>
                <Text style={[styles.emptyRecordingSubtitle, { color: themedColors.text.tertiary }]}>
                  We couldn't detect any speech in your recording. Please try again and speak clearly.
                </Text>

                {/* Re-record button for empty state */}
                <View style={styles.emptyRecordingActions}>
                  <PremiumButton
                    onPress={handleReRecord}
                    gradient
                    icon={<Ionicons name="mic-outline" size={20} color={colors.neutral[0]} />}
                  >
                    Try Again
                  </PremiumButton>
                </View>
              </View>
            ) : (
              <>
                {/* Transcription display/edit */}
                <View
                  style={[
                    styles.transcriptionContainer,
                    {
                      backgroundColor: themedColors.input.background,
                      borderColor: isEditing ? colors.primary[500] : themedColors.input.border,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.transcriptionText, { color: themedColors.text.primary }]}
                    value={editedText}
                    onChangeText={setEditedText}
                    onFocus={() => setIsEditing(true)}
                    onBlur={() => setIsEditing(false)}
                    multiline
                    placeholder="Your transcribed note will appear here..."
                    placeholderTextColor={themedColors.input.placeholder}
                    editable={!isSaving}
                  />
                </View>

                {/* Edit hint */}
                <Text style={[styles.hint, { color: themedColors.text.tertiary }]}>
                  Tap to edit the transcription before saving
                </Text>

                {/* Reminder Section - only shows custom reminder set by user */}
                {activeReminder ? (
                  // Custom reminder set by user
                  <View style={[styles.reminderSection, { backgroundColor: colors.accent.rose.light }]}>
                    <View style={styles.reminderContent}>
                      <Ionicons name="notifications" size={20} color={colors.accent.rose.base} />
                      <View style={styles.reminderTextContainer}>
                        <Text style={styles.reminderLabel}>Reminder</Text>
                        <Text style={[styles.reminderTime, { color: colors.accent.rose.dark }]}>
                          {activeReminder.displayText}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.reminderActions, { opacity: isSaving ? 0.5 : 1 }]}>
                      <AnimatedPressable
                        onPress={handleReminderPress}
                        style={styles.reminderEditButton}
                        hapticType="light"
                        disabled={isSaving}
                      >
                        <Ionicons name="pencil" size={16} color={colors.accent.rose.base} />
                      </AnimatedPressable>
                      <AnimatedPressable
                        onPress={handleRemoveReminder}
                        style={styles.reminderRemoveButton}
                        hapticType="light"
                        disabled={isSaving}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.accent.rose.base} />
                      </AnimatedPressable>
                    </View>
                  </View>
                ) : (
                  // Add reminder option
                  <AnimatedPressable
                    onPress={handleReminderPress}
                    style={[styles.addReminderButton, { backgroundColor: themedColors.surface.secondary, opacity: isSaving ? 0.5 : 1 }]}
                    hapticType="light"
                    disabled={isSaving}
                  >
                    <Ionicons name="notifications-outline" size={20} color={colors.primary[500]} />
                    <Text style={[styles.addReminderText, { color: colors.primary[500] }]}>
                      Add reminder
                    </Text>
                  </AnimatedPressable>
                )}

                {/* Action buttons */}
                <View style={styles.actions}>
                  {/* Re-record button */}
                  <AnimatedPressable
                    onPress={handleReRecord}
                    style={[
                      styles.secondaryButton,
                      { backgroundColor: themedColors.surface.secondary, opacity: isSaving ? 0.5 : 1 },
                    ]}
                    hapticType="medium"
                    disabled={isSaving}
                  >
                    <Ionicons name="mic-outline" size={20} color={colors.primary[500]} />
                    <Text style={[styles.secondaryButtonText, { color: colors.primary[500] }]}>
                      Re-record
                    </Text>
                  </AnimatedPressable>

                  {/* Save button */}
                  <View style={styles.saveButtonContainer}>
                    <PremiumButton
                      onPress={handleSave}
                      gradient
                      disabled={editedText.trim().length === 0 || isSaving}
                      icon={!isSaving ? <Ionicons name="checkmark" size={20} color={colors.neutral[0]} /> : undefined}
                    >
                      {isSaving ? 'Saving.....' : activeReminder ? 'Save with Reminder' : 'Save Note'}
                    </PremiumButton>
                  </View>
                </View>
              </>
            )}
          </Animated.View>

          {/* Reminder Picker - rendered as inline overlay within same modal */}
          {showReminderPicker && (
            <View style={StyleSheet.absoluteFill}>
              <ReminderPicker
                visible={showReminderPicker}
                onClose={handleReminderPickerClose}
                onSelectReminder={handleReminderSelect}
                onSaveWithReminder={handleSaveWithReminder}
                themedColors={themedColors}
                initialDate={activeReminder?.date}
                inline
              />
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background.overlayDark,
  },
  content: {
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    padding: spacing[5],
    paddingBottom: spacing[8],
    ...shadows.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transcriptionContainer: {
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    padding: spacing[4],
    minHeight: 100,
    maxHeight: 150,
  },
  transcriptionText: {
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
  },
  hint: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing[2],
    marginBottom: spacing[4],
  },
  reminderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
  },
  reminderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  reminderTextContainer: {
    flex: 1,
  },
  reminderLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.accent.rose.dark,
    opacity: 0.7,
    marginBottom: 2,
  },
  reminderTime: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  reminderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  reminderEditButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderRemoveButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addReminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
  },
  addReminderText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  secondaryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  saveButtonContainer: {
    flex: 1.5,
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: spacing[10],
  },
  processingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  processingText: {
    fontSize: typography.fontSize.base,
  },
  emptyRecordingContainer: {
    alignItems: 'center',
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[4],
  },
  emptyRecordingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  emptyRecordingTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  emptyRecordingSubtitle: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
    marginBottom: spacing[6],
  },
  emptyRecordingActions: {
    width: '100%',
    maxWidth: 200,
  },
});

export default TranscriptionReview;
