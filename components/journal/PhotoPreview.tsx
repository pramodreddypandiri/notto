/**
 * PhotoPreview - Full-screen photo preview modal
 *
 * Features:
 * - Full-screen photo display
 * - Pinch to zoom
 * - Caption and category display
 * - Tap to dismiss
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Modal,
  Dimensions,
  StatusBar,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AnimatedPressable from '../ui/AnimatedPressable';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { JournalPhoto, PhotoCategory } from '../../services/journalService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CATEGORY_CONFIG: Record<PhotoCategory, { label: string; icon: string; color: typeof colors.accent.violet }> = {
  food: { label: 'Food', icon: 'restaurant-outline', color: colors.accent.amber },
  selfie: { label: 'Selfie', icon: 'person-circle-outline', color: colors.accent.rose },
  other: { label: 'Other', icon: 'heart-outline', color: colors.accent.violet },
};

interface PhotoPreviewProps {
  photo: JournalPhoto | null;
  visible: boolean;
  onClose: () => void;
}

export function PhotoPreview({ photo, visible, onClose }: PhotoPreviewProps) {
  const insets = useSafeAreaInsets();

  // Pinch to zoom
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  // Pan for zoomed image
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(Math.max(savedScale.value * event.scale, 1), 4);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const tapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .runOnJS(true)
    .onEnd(() => {
      // Only close if not zoomed
      if (scale.value <= 1.1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onEnd(() => {
      if (scale.value > 1) {
        // Reset zoom
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });

  const composedGesture = Gesture.Exclusive(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
    tapGesture
  );

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Reset zoom state
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    onClose();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (!photo) return null;

  const categoryConfig = CATEGORY_CONFIG[photo.category];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Background */}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.background}
        />

        {/* Close button */}
        <Animated.View
          entering={FadeIn.delay(100)}
          style={[styles.closeButtonContainer, { top: insets.top + spacing[2] }]}
        >
          <AnimatedPressable
            onPress={handleClose}
            style={styles.closeButton}
            hapticType="light"
          >
            <Ionicons name="close" size={28} color={colors.neutral[0]} />
          </AnimatedPressable>
        </Animated.View>

        {/* Photo */}
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={styles.imageContainer}>
            <Animated.Image
              source={{ uri: photo.localUri }}
              style={[styles.image, animatedImageStyle]}
              resizeMode="contain"
            />
          </Animated.View>
        </GestureDetector>

        {/* Info overlay */}
        <Animated.View
          entering={FadeIn.delay(100)}
          style={[styles.infoContainer, { paddingBottom: insets.bottom + spacing[4] }]}
        >
          {/* Category badge */}
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: categoryConfig.color.light },
            ]}
          >
            <Ionicons
              name={categoryConfig.icon as any}
              size={14}
              color={categoryConfig.color.base}
            />
            <Text style={[styles.categoryText, { color: categoryConfig.color.dark }]}>
              {categoryConfig.label}
            </Text>
          </View>

          {/* Caption */}
          {photo.caption ? (
            <Text style={styles.caption}>{photo.caption}</Text>
          ) : null}

          {/* Date and time */}
          <Text style={styles.dateTime}>
            {formatDate(photo.createdAt)} at {formatTime(photo.createdAt)}
          </Text>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  closeButtonContainer: {
    position: 'absolute',
    left: spacing[4],
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
  },
  infoContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    marginBottom: spacing[2],
  },
  categoryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  caption: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[0],
    marginBottom: spacing[2],
    lineHeight: typography.fontSize.lg * 1.4,
  },
  dateTime: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[400],
  },
});

export default PhotoPreview;
