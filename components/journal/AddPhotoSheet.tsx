/**
 * AddPhotoSheet - Bottom sheet for adding photos to journal
 *
 * Features:
 * - Camera / Gallery picker
 * - Category selection
 * - Caption input
 * - Preview before save
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AnimatedPressable from '../ui/AnimatedPressable';
import { colors, typography, spacing, borderRadius, shadows, getThemedColors } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { PhotoCategory, pickFromCamera, pickFromGallery } from '../../services/journalService';

const CATEGORY_OPTIONS: { value: PhotoCategory; label: string; icon: string; description: string }[] = [
  {
    value: 'food',
    label: 'Food',
    icon: 'restaurant-outline',
    description: 'Meals, snacks, drinks',
  },
  {
    value: 'selfie',
    label: 'Selfie',
    icon: 'person-circle-outline',
    description: 'Track your glow',
  },
  {
    value: 'other',
    label: 'Other',
    icon: 'heart-outline',
    description: 'Places, cute things',
  },
];

interface AddPhotoSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (imageUri: string, category: PhotoCategory, caption: string) => Promise<void>;
}

type Step = 'source' | 'category' | 'caption';

export function AddPhotoSheet({ visible, onClose, onSave }: AddPhotoSheetProps) {
  const { isDark } = useTheme();
  const themedColors = getThemedColors(isDark);

  const [step, setStep] = useState<Step>('source');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [category, setCategory] = useState<PhotoCategory | null>(null);
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset state when sheet closes
  useEffect(() => {
    if (!visible) {
      setStep('source');
      setImageUri(null);
      setCategory(null);
      setCaption('');
      setSaving(false);
    }
  }, [visible]);

  const handlePickFromCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const uri = await pickFromCamera();
    if (uri) {
      setImageUri(uri);
      setStep('category');
    }
  };

  const handlePickFromGallery = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const uri = await pickFromGallery();
    if (uri) {
      setImageUri(uri);
      setStep('category');
    }
  };

  const handleCategorySelect = (cat: PhotoCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCategory(cat);
    setStep('caption');
  };

  const handleSave = async () => {
    if (!imageUri || !category) return;

    setSaving(true);
    try {
      await onSave(imageUri, category, caption.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (error) {
      console.error('Failed to save photo:', error);
      Alert.alert('Error', 'Failed to save photo. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 'category') {
      setStep('source');
      setImageUri(null);
    } else if (step === 'caption') {
      setStep('category');
      setCategory(null);
    }
  };

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      style={[styles.overlay, { backgroundColor: themedColors.background.overlay }]}
    >
      <AnimatedPressable onPress={onClose} style={styles.backdrop} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <Animated.View
          entering={SlideInUp.springify().damping(20)}
          style={[styles.sheet, shadows.xl, { backgroundColor: themedColors.surface.primary }]}
        >
          {/* Header */}
          <View style={styles.header}>
            {step !== 'source' ? (
              <AnimatedPressable onPress={handleBack} hapticType="light">
                <Ionicons name="arrow-back" size={24} color={themedColors.text.primary} />
              </AnimatedPressable>
            ) : (
              <View style={{ width: 24 }} />
            )}
            <Text style={[styles.headerTitle, { color: themedColors.text.primary }]}>
              {step === 'source' && 'Add Photo'}
              {step === 'category' && 'Select Category'}
              {step === 'caption' && 'Add Caption'}
            </Text>
            <AnimatedPressable onPress={onClose} hapticType="light">
              <Ionicons name="close" size={24} color={themedColors.text.secondary} />
            </AnimatedPressable>
          </View>

          {/* Step: Source selection */}
          {step === 'source' && (
            <View style={styles.content}>
              <AnimatedPressable
                onPress={handlePickFromCamera}
                style={[styles.sourceButton, { backgroundColor: themedColors.surface.secondary }]}
                hapticType="medium"
              >
                <View style={[styles.sourceIconContainer, { backgroundColor: colors.primary[50] }]}>
                  <Ionicons name="camera" size={32} color={colors.primary[500]} />
                </View>
                <View style={styles.sourceTextContainer}>
                  <Text style={[styles.sourceTitle, { color: themedColors.text.primary }]}>
                    Take Photo
                  </Text>
                  <Text style={[styles.sourceSubtitle, { color: themedColors.text.tertiary }]}>
                    Use camera to capture now
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={themedColors.text.tertiary} />
              </AnimatedPressable>

              <AnimatedPressable
                onPress={handlePickFromGallery}
                style={[styles.sourceButton, { backgroundColor: themedColors.surface.secondary }]}
                hapticType="medium"
              >
                <View style={[styles.sourceIconContainer, { backgroundColor: colors.accent.violet.light }]}>
                  <Ionicons name="images" size={32} color={colors.accent.violet.base} />
                </View>
                <View style={styles.sourceTextContainer}>
                  <Text style={[styles.sourceTitle, { color: themedColors.text.primary }]}>
                    Choose from Gallery
                  </Text>
                  <Text style={[styles.sourceSubtitle, { color: themedColors.text.tertiary }]}>
                    Select an existing photo
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={themedColors.text.tertiary} />
              </AnimatedPressable>
            </View>
          )}

          {/* Step: Category selection */}
          {step === 'category' && imageUri && (
            <View style={styles.content}>
              {/* Preview */}
              <Image source={{ uri: imageUri }} style={styles.preview} />

              <Text style={[styles.sectionLabel, { color: themedColors.text.secondary }]}>
                What is this photo of?
              </Text>

              <View style={styles.categoryGrid}>
                {CATEGORY_OPTIONS.map((option) => (
                  <AnimatedPressable
                    key={option.value}
                    onPress={() => handleCategorySelect(option.value)}
                    style={[
                      styles.categoryOption,
                      { backgroundColor: themedColors.surface.secondary },
                    ]}
                    hapticType="light"
                  >
                    <Ionicons
                      name={option.icon as any}
                      size={28}
                      color={colors.primary[500]}
                    />
                    <Text style={[styles.categoryLabel, { color: themedColors.text.primary }]}>
                      {option.label}
                    </Text>
                    <Text style={[styles.categoryDesc, { color: themedColors.text.tertiary }]}>
                      {option.description}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>
          )}

          {/* Step: Caption */}
          {step === 'caption' && imageUri && category && (
            <View style={styles.content}>
              {/* Preview */}
              <Image source={{ uri: imageUri }} style={styles.previewSmall} />

              <Text style={[styles.sectionLabel, { color: themedColors.text.secondary }]}>
                Add a caption (optional)
              </Text>

              <TextInput
                style={[
                  styles.captionInput,
                  {
                    backgroundColor: themedColors.surface.secondary,
                    color: themedColors.text.primary,
                    borderColor: themedColors.surface.border,
                  },
                ]}
                placeholder="What's this about?"
                placeholderTextColor={themedColors.text.tertiary}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={200}
                autoFocus
              />

              <Text style={[styles.charCount, { color: themedColors.text.tertiary }]}>
                {caption.length}/200
              </Text>

              <AnimatedPressable
                onPress={handleSave}
                style={[
                  styles.saveButton,
                  { backgroundColor: colors.primary[500], opacity: saving ? 0.7 : 1 },
                ]}
                hapticType="medium"
                disabled={saving}
              >
                {saving ? (
                  <Text style={styles.saveButtonText}>Saving...</Text>
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color={colors.neutral[0]} />
                    <Text style={styles.saveButtonText}>Save to Journal</Text>
                  </>
                )}
              </AnimatedPressable>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    paddingBottom: spacing[8],
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  content: {
    padding: spacing[4],
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
  },
  sourceIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  sourceTextContainer: {
    flex: 1,
  },
  sourceTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  sourceSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
  },
  previewSmall: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing[3],
  },
  categoryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  categoryOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[2],
  },
  categoryLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  categoryDesc: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  captionInput: {
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    fontSize: typography.fontSize.base,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  charCount: {
    fontSize: typography.fontSize.xs,
    textAlign: 'right',
    marginTop: spacing[2],
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    marginTop: spacing[4],
    gap: spacing[2],
  },
  saveButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default AddPhotoSheet;
