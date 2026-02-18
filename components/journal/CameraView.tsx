/**
 * CameraView - Snapchat-style in-app camera
 *
 * Features:
 * - Full-screen camera viewfinder
 * - Flash toggle (off/on/auto)
 * - Front/back camera flip
 * - Pinch to zoom
 * - Capture button with animation
 * - Photo preview with retake/use options
 * - Category selection
 * - Caption input
 */

import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { CameraView as ExpoCameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { PhotoCategory, pickFromGallery } from '../../services/journalService';

const CATEGORY_OPTIONS: { value: PhotoCategory; label: string; icon: string }[] = [
  { value: 'food', label: 'Food', icon: 'restaurant-outline' },
  { value: 'selfie', label: 'Selfie', icon: 'person-circle-outline' },
  { value: 'other', label: 'Other', icon: 'heart-outline' },
];

const FLASH_MODES: { mode: FlashMode; icon: string }[] = [
  { mode: 'off', icon: 'flash-off' },
  { mode: 'on', icon: 'flash' },
  { mode: 'auto', icon: 'flash-outline' },
];

interface CameraViewProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (uri: string, category: PhotoCategory, caption: string) => Promise<void>;
}

type Step = 'camera' | 'preview' | 'details';

export function CameraView({ visible, onClose, onCapture }: CameraViewProps) {
  const cameraRef = useRef<ExpoCameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // Camera state - default to front camera for selfies
  const [facing, setFacing] = useState<CameraType>('front');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [zoom, setZoom] = useState(0);

  // Capture flow state
  const [step, setStep] = useState<Step>('camera');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [category, setCategory] = useState<PhotoCategory>('food');
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);

  // Animation values
  const shutterScale = useSharedValue(1);
  const flashOpacity = useSharedValue(0);

  // Reset state when closing
  const handleClose = () => {
    setStep('camera');
    setCapturedUri(null);
    setCategory('food');
    setCaption('');
    setSaving(false);
    setZoom(0);
    onClose();
  };

  // Toggle camera facing
  const toggleFacing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFacing(f => (f === 'back' ? 'front' : 'back'));
  };

  // Cycle flash mode
  const cycleFlash = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentIndex = FLASH_MODES.findIndex(f => f.mode === flash);
    const nextIndex = (currentIndex + 1) % FLASH_MODES.length;
    setFlash(FLASH_MODES[nextIndex].mode);
  };

  // Get current flash icon
  const getFlashIcon = () => {
    return FLASH_MODES.find(f => f.mode === flash)?.icon || 'flash-off';
  };

  // Pinch to zoom gesture
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newZoom = Math.min(1, Math.max(0, zoom + (event.scale - 1) * 0.01));
      setZoom(newZoom);
    });

  // Take photo
  const takePhoto = async () => {
    if (!cameraRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Shutter animation
    shutterScale.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withSpring(1)
    );

    // Flash effect for front camera
    if (facing === 'front') {
      flashOpacity.value = withSequence(
        withTiming(0.8, { duration: 50 }),
        withTiming(0, { duration: 200 })
      );
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        mirror: facing === 'front',
        skipProcessing: Platform.OS === 'android',
      });

      if (photo?.uri) {
        setCapturedUri(photo.uri);
        setStep('preview');
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
    }
  };

  // Pick from gallery
  const handlePickGallery = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const uri = await pickFromGallery();
    if (uri) {
      setCapturedUri(uri);
      setStep('preview');
    }
  };

  // Retake photo
  const handleRetake = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCapturedUri(null);
    setStep('camera');
  };

  // Use photo - go to details
  const handleUsePhoto = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('details');
  };

  // Save photo
  const handleSave = async () => {
    if (!capturedUri) return;

    setSaving(true);
    try {
      await onCapture(capturedUri, category, caption.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleClose();
    } catch (error) {
      console.error('Failed to save:', error);
      setSaving(false);
    }
  };

  // Animated styles
  const shutterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }],
  }));

  const flashAnimatedStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  if (!visible) return null;

  // Permission check
  if (!permission) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={colors.neutral[400]} />
          <Text style={styles.permissionText}>Loading camera...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={colors.neutral[400]} />
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionText}>
            Allow camera access to take photos for your journal
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButtonAlt} onPress={handleClose}>
            <Text style={styles.closeButtonAltText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Camera Step */}
      {step === 'camera' && (
        <Animated.View entering={FadeIn} style={StyleSheet.absoluteFill}>
          <GestureDetector gesture={pinchGesture}>
            <ExpoCameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              flash={flash}
              zoom={zoom}
              mirror={facing === 'front'}
            />
          </GestureDetector>

          {/* Flash overlay for front camera selfie light */}
          <Animated.View
            style={[styles.flashOverlay, flashAnimatedStyle]}
            pointerEvents="none"
          />

          {/* Top controls */}
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.controlButton} onPress={handleClose}>
              <Ionicons name="close" size={28} color={colors.neutral[0]} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={cycleFlash}>
              <Ionicons name={getFlashIcon() as any} size={24} color={colors.neutral[0]} />
            </TouchableOpacity>
          </View>

          {/* Bottom controls */}
          <View style={styles.bottomControls}>
            {/* Gallery button */}
            <TouchableOpacity style={styles.galleryButton} onPress={handlePickGallery}>
              <Ionicons name="images-outline" size={28} color={colors.neutral[0]} />
            </TouchableOpacity>

            {/* Shutter button */}
            <Animated.View style={shutterAnimatedStyle}>
              <TouchableOpacity style={styles.shutterButton} onPress={takePhoto}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            </Animated.View>

            {/* Camera flip button */}
            <TouchableOpacity style={styles.galleryButton} onPress={toggleFacing}>
              <Ionicons name="camera-reverse-outline" size={28} color={colors.neutral[0]} />
            </TouchableOpacity>
          </View>

          {/* Zoom indicator */}
          {zoom > 0 && (
            <View style={styles.zoomIndicator}>
              <Text style={styles.zoomText}>{(1 + zoom * 4).toFixed(1)}x</Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* Preview Step */}
      {step === 'preview' && capturedUri && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFill}>
          <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} />

          {/* Top controls */}
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.controlButton} onPress={handleClose}>
              <Ionicons name="close" size={28} color={colors.neutral[0]} />
            </TouchableOpacity>
          </View>

          {/* Bottom controls */}
          <View style={styles.previewBottomControls}>
            <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
              <Ionicons name="refresh" size={24} color={colors.neutral[0]} />
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.usePhotoButton} onPress={handleUsePhoto}>
              <Text style={styles.usePhotoText}>Use Photo</Text>
              <Ionicons name="arrow-forward" size={24} color={colors.neutral[0]} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Details Step */}
      {step === 'details' && capturedUri && (
        <Animated.View
          entering={SlideInDown}
          exiting={SlideOutDown}
          style={[StyleSheet.absoluteFill, styles.detailsContainer]}
        >
          {/* Preview thumbnail */}
          <View style={styles.detailsHeader}>
            <TouchableOpacity onPress={() => setStep('preview')}>
              <Ionicons name="arrow-back" size={24} color={colors.neutral[0]} />
            </TouchableOpacity>
            <Text style={styles.detailsTitle}>Add Details</Text>
            <View style={{ width: 24 }} />
          </View>

          <Image source={{ uri: capturedUri }} style={styles.detailsPreview} />

          {/* Category selection */}
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.categoryRow}>
            {CATEGORY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.categoryChip,
                  category === option.value && styles.categoryChipSelected,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCategory(option.value);
                }}
              >
                <Ionicons
                  name={option.icon as any}
                  size={20}
                  color={category === option.value ? colors.neutral[0] : colors.neutral[300]}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    category === option.value && styles.categoryChipTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Caption input */}
          <Text style={styles.sectionLabel}>Caption (optional)</Text>
          <TextInput
            style={styles.captionInput}
            placeholder="What's this about?"
            placeholderTextColor={colors.neutral[500]}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={200}
          />

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Text style={styles.saveButtonText}>Saving...</Text>
            ) : (
              <>
                <Ionicons name="checkmark" size={24} color={colors.neutral[0]} />
                <Text style={styles.saveButtonText}>Save to Journal</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[900],
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
    gap: spacing[4],
  },
  permissionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    marginTop: spacing[4],
  },
  permissionText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[400],
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    borderRadius: borderRadius.lg,
    marginTop: spacing[4],
  },
  permissionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  closeButtonAlt: {
    marginTop: spacing[4],
  },
  closeButtonAltText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[400],
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.neutral[0],
  },
  topControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
  },
  topRightControls: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.neutral[0],
  },
  zoomIndicator: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
  },
  zoomText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  previewBottomControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.full,
  },
  retakeText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  usePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.full,
  },
  usePhotoText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  detailsContainer: {
    backgroundColor: colors.neutral[900],
    padding: spacing[4],
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  detailsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  detailsPreview: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
    marginBottom: spacing[6],
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[400],
    marginBottom: spacing[2],
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  categoryChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[800],
  },
  categoryChipSelected: {
    backgroundColor: colors.primary[500],
  },
  categoryChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[300],
  },
  categoryChipTextSelected: {
    color: colors.neutral[0],
  },
  captionInput: {
    backgroundColor: colors.neutral[800],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    fontSize: typography.fontSize.base,
    color: colors.neutral[0],
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: spacing[6],
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default CameraView;
