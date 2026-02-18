/**
 * EditNoteModal - Edit an existing note's text and type
 *
 * Features:
 * - Edit transcription text
 * - Change note type (Task/Journal)
 * - Similar UI to TranscriptionReview modal
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
import { colors, typography, spacing, borderRadius, shadows, getThemedColors } from '../../theme';
import { NoteType } from '../../services/notesService';

interface EditNoteModalProps {
  visible: boolean;
  noteId: string | null;
  transcript: string;
  noteType: NoteType;
  onSave: (noteId: string, transcript: string, noteType: NoteType) => void | Promise<void>;
  onCancel: () => void;
  themedColors: ReturnType<typeof getThemedColors>;
}

export function EditNoteModal({
  visible,
  noteId,
  transcript,
  noteType: initialNoteType,
  onSave,
  onCancel,
  themedColors,
}: EditNoteModalProps) {
  const [editedText, setEditedText] = useState(transcript);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [noteType, setNoteType] = useState<NoteType>(initialNoteType);

  // Reset state when modal opens with new note
  useEffect(() => {
    setEditedText(transcript);
    setNoteType(initialNoteType);
    setIsSaving(false);
  }, [transcript, initialNoteType, noteId]);

  const handleSave = async () => {
    if (!noteId || editedText.trim().length === 0 || isSaving) return;
    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await onSave(noteId, editedText.trim(), noteType);
    } catch {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  const hasChanges = editedText.trim() !== transcript || noteType !== initialNoteType;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleCancel}
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
              Edit Note
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

          {/* Transcription edit */}
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
              placeholder="Edit your note..."
              placeholderTextColor={themedColors.input.placeholder}
              editable={!isSaving}
            />
          </View>

          {/* Edit hint */}
          <Text style={[styles.hint, { color: themedColors.text.tertiary }]}>
            Tap to edit the text
          </Text>

          {/* Note Type Selector */}
          <View style={[styles.noteTypeContainer, { opacity: isSaving ? 0.5 : 1 }]}>
            <AnimatedPressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setNoteType('task');
              }}
              style={[
                styles.noteTypeButton,
                noteType === 'task' && { backgroundColor: colors.primary[500] },
                noteType !== 'task' && { backgroundColor: themedColors.surface.secondary },
              ]}
              hapticType="light"
              disabled={isSaving}
            >
              <Ionicons
                name="checkbox-outline"
                size={18}
                color={noteType === 'task' ? colors.neutral[0] : themedColors.text.secondary}
              />
              <Text
                style={[
                  styles.noteTypeText,
                  { color: noteType === 'task' ? colors.neutral[0] : themedColors.text.secondary },
                ]}
              >
                Task
              </Text>
            </AnimatedPressable>

            <AnimatedPressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setNoteType('journal');
              }}
              style={[
                styles.noteTypeButton,
                noteType === 'journal' && { backgroundColor: colors.accent.violet.base },
                noteType !== 'journal' && { backgroundColor: themedColors.surface.secondary },
              ]}
              hapticType="light"
              disabled={isSaving}
            >
              <Ionicons
                name="book-outline"
                size={18}
                color={noteType === 'journal' ? colors.neutral[0] : themedColors.text.secondary}
              />
              <Text
                style={[
                  styles.noteTypeText,
                  { color: noteType === 'journal' ? colors.neutral[0] : themedColors.text.secondary },
                ]}
              >
                Journal
              </Text>
            </AnimatedPressable>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <AnimatedPressable
              onPress={handleCancel}
              style={[
                styles.secondaryButton,
                { backgroundColor: themedColors.surface.secondary, opacity: isSaving ? 0.5 : 1 },
              ]}
              hapticType="light"
              disabled={isSaving}
            >
              <Text style={[styles.secondaryButtonText, { color: themedColors.text.secondary }]}>
                Cancel
              </Text>
            </AnimatedPressable>

            <View style={styles.saveButtonContainer}>
              <PremiumButton
                onPress={handleSave}
                gradient
                disabled={editedText.trim().length === 0 || !hasChanges || isSaving}
                icon={!isSaving ? <Ionicons name="checkmark" size={20} color={colors.neutral[0]} /> : undefined}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </PremiumButton>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
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
    marginBottom: spacing[3],
  },
  noteTypeContainer: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  noteTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: 10,
    borderRadius: borderRadius.lg,
  },
  noteTypeText: {
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
});

export default EditNoteModal;
