/**
 * BottomSheet - Premium animated bottom sheet modal
 *
 * Features:
 * - Spring-based open/close animation
 * - Drag to dismiss
 * - Backdrop tap to dismiss
 * - Smooth backdrop fade
 * - Handle indicator
 */

import React, { ReactNode, useEffect } from 'react';
import { StyleSheet, View, Dimensions, BackHandler, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, animation } from '../../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_TRANSLATE_Y = -SCREEN_HEIGHT * 0.85;

// Gentler spring for sheet open/close — less overshoot than the default
const SHEET_SPRING = { damping: 28, stiffness: 300, mass: 1 };

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  // Height as percentage of screen (0-100)
  height?: number;
  // Show drag handle indicator
  showHandle?: boolean;
  // Allow backdrop tap to close
  closeOnBackdrop?: boolean;
  // Background color
  backgroundColor?: string;
}

export function BottomSheet({
  visible,
  onClose,
  children,
  height = 50,
  showHandle = true,
  closeOnBackdrop = true,
  backgroundColor = colors.neutral[0],
}: BottomSheetProps) {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const context = useSharedValue({ y: 0 });
  const backdropOpacity = useSharedValue(0);

  const maxHeight = (SCREEN_HEIGHT * height) / 100;
  const closeThreshold = maxHeight * 0.3;

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(-maxHeight, SHEET_SPRING);
      backdropOpacity.value = withTiming(1, { duration: animation.duration.normal });
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, SHEET_SPRING);
      backdropOpacity.value = withTiming(0, { duration: animation.duration.fast });
    }
  }, [visible, maxHeight]);

  // Handle Android back button
  useEffect(() => {
    if (Platform.OS === 'android' && visible) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleClose();
        return true;
      });
      return () => backHandler.remove();
    }
  }, [visible]);

  const gesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      'worklet';
      // Allow dragging down, limit dragging up
      const newY = event.translationY + context.value.y;
      translateY.value = Math.min(Math.max(newY, -maxHeight - 50), SCREEN_HEIGHT);
    })
    .onEnd((event) => {
      'worklet';
      // If dragged down more than threshold, close
      if (event.translationY > closeThreshold || event.velocityY > 500) {
        translateY.value = withSpring(SCREEN_HEIGHT, SHEET_SPRING);
        backdropOpacity.value = withTiming(0, { duration: animation.duration.fast });
        runOnJS(handleClose)();
      } else {
        // Snap back to open position
        translateY.value = withSpring(-maxHeight, SHEET_SPRING);
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
    pointerEvents: backdropOpacity.value > 0 ? 'auto' : 'none',
  }));

  const animatedHandleStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateY.value,
      [-maxHeight, 0],
      [0, 10],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ rotate: `${rotation}deg` }],
    };
  });

  const handleBackdropPress = () => {
    if (closeOnBackdrop) {
      handleClose();
    }
  };

  if (!visible && translateY.value >= SCREEN_HEIGHT - 10) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <GestureDetector gesture={Gesture.Tap().onEnd(() => runOnJS(handleBackdropPress)())}>
        <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />
      </GestureDetector>

      {/* Sheet */}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor, maxHeight: maxHeight + 100 },
            animatedSheetStyle,
          ]}
        >
          {/* Handle */}
          {showHandle && (
            <Animated.View style={[styles.handleContainer, animatedHandleStyle]}>
              <View style={styles.handle} />
            </Animated.View>
          )}

          {/* Content */}
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background.overlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: SCREEN_HEIGHT,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.neutral[300],
    borderRadius: borderRadius.full,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
  },
});

export default BottomSheet;
