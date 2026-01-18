/**
 * TranscriptionReview - Review transcription before saving
 *
 * Features:
 * - Shows transcribed text for review/editing
 * - Save, re-record, or edit options
 * - Animated modal appearance
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

interface TranscriptionReviewProps {
  visible: boolean;
  transcription: string;
  isProcessing: boolean;
  onSave: (text: string) => void;
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

  // Update edited text when transcription changes
  useEffect(() => {
    setEditedText(transcription);
    setIsEditing(false);
  }, [transcription]);

  const handleSave = () => {
    if (editedText.trim().length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSave(editedText.trim());
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

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
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
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown.duration(200)}
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
              style={[styles.closeButton, { backgroundColor: themedColors.surface.secondary }]}
              hapticType="light"
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
                />
              </View>

              {/* Edit hint */}
              <Text style={[styles.hint, { color: themedColors.text.tertiary }]}>
                Tap to edit the transcription before saving
              </Text>

              {/* Action buttons */}
              <View style={styles.actions}>
                {/* Re-record button */}
                <AnimatedPressable
                  onPress={handleReRecord}
                  style={[
                    styles.secondaryButton,
                    { backgroundColor: themedColors.surface.secondary },
                  ]}
                  hapticType="medium"
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
                    disabled={editedText.trim().length === 0}
                    icon={<Ionicons name="checkmark" size={20} color={colors.neutral[0]} />}
                  >
                    Save Note
                  </PremiumButton>
                </View>
              </View>
            </>
          )}
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
    minHeight: 120,
    maxHeight: 200,
  },
  transcriptionText: {
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
  },
  hint: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing[2],
    marginBottom: spacing[5],
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
});

export default TranscriptionReview;
