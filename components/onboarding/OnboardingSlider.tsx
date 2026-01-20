/**
 * OnboardingSlider - Animated slider for personality trait selection
 *
 * Features:
 * - Smooth thumb animation
 * - Haptic feedback at key points
 * - Visual gradient track
 * - Animated labels
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  interpolate,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_PADDING = spacing[5];
const CONTAINER_WIDTH = SCREEN_WIDTH - SLIDER_PADDING * 2 - spacing[10] * 2;
const THUMB_SIZE = 36;
const TRACK_HEIGHT = 8;

// The thumb travels from 0 to TRACK_WIDTH
// Track visual should match this range
const TRACK_WIDTH = CONTAINER_WIDTH - THUMB_SIZE;

// Smooth timing config
const SMOOTH_TIMING = {
  duration: 200,
  easing: Easing.out(Easing.cubic),
};

interface OnboardingSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  leftLabel: string;
  rightLabel: string;
  leftEmoji?: string;
  rightEmoji?: string;
  min?: number;
  max?: number;
  step?: number;
}

export function OnboardingSlider({
  value,
  onValueChange,
  leftLabel,
  rightLabel,
  leftEmoji = '',
  rightEmoji = '',
  min = 1,
  max = 10,
  step = 1,
}: OnboardingSliderProps) {
  // Calculate position from value (0 to TRACK_WIDTH)
  const getPosition = (val: number) => {
    const range = max - min;
    const percent = (val - min) / range;
    return percent * TRACK_WIDTH;
  };

  const translateX = useSharedValue(getPosition(value));
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const isActiveRef = useRef(false);
  const lastValueRef = useRef(value);

  // Sync position when value changes externally
  useEffect(() => {
    if (!isActiveRef.current && value !== lastValueRef.current) {
      translateX.value = withTiming(getPosition(value), SMOOTH_TIMING);
      lastValueRef.current = value;
    }
  }, [value]);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const triggerStrongHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleValueChange = useCallback((newValue: number) => {
    if (newValue !== lastValueRef.current) {
      lastValueRef.current = newValue;
      // Haptic feedback
      if (newValue === min || newValue === max) {
        triggerStrongHaptic();
      } else {
        triggerHaptic();
      }
      onValueChange(newValue);
    }
  }, [onValueChange, min, max, triggerHaptic, triggerStrongHaptic]);

  const onGestureStart = useCallback(() => {
    isActiveRef.current = true;
  }, []);

  const onGestureEnd = useCallback(() => {
    isActiveRef.current = false;
  }, []);

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .onStart(() => {
        'worklet';
        startX.value = translateX.value;
        scale.value = withTiming(1.08, { duration: 100 });
        runOnJS(onGestureStart)();
      })
      .onUpdate((event) => {
        'worklet';
        const newX = Math.max(0, Math.min(TRACK_WIDTH, startX.value + event.translationX));
        translateX.value = newX;

        // Calculate value
        const percent = newX / TRACK_WIDTH;
        const range = max - min;
        const rawValue = min + percent * range;
        const newValue = Math.round(rawValue / step) * step;
        runOnJS(handleValueChange)(newValue);
      })
      .onEnd(() => {
        'worklet';
        scale.value = withTiming(1, { duration: 100 });
        // Snap to value position
        const percent = translateX.value / TRACK_WIDTH;
        const range = max - min;
        const rawValue = min + percent * range;
        const snappedValue = Math.round(rawValue / step) * step;
        const snappedPos = ((snappedValue - min) / range) * TRACK_WIDTH;
        translateX.value = withTiming(snappedPos, { duration: 150 });
        runOnJS(onGestureEnd)();
      });
  }, [min, max, step, handleValueChange, onGestureStart, onGestureEnd]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  const leftLabelStyle = useAnimatedStyle(() => {
    const progress = translateX.value / TRACK_WIDTH;
    return {
      opacity: interpolate(progress, [0, 0.5, 1], [1, 0.6, 0.4]),
    };
  });

  const rightLabelStyle = useAnimatedStyle(() => {
    const progress = translateX.value / TRACK_WIDTH;
    return {
      opacity: interpolate(progress, [0, 0.5, 1], [0.4, 0.6, 1]),
    };
  });

  const fillStyle = useAnimatedStyle(() => {
    const progress = translateX.value / TRACK_WIDTH;
    return {
      backgroundColor: interpolateColor(
        progress,
        [0, 0.5, 1],
        [colors.accent.sky.base, colors.primary[500], colors.accent.violet.base]
      ),
    };
  });

  // Fill width: from left edge of track to center of thumb
  const fillWidthStyle = useAnimatedStyle(() => ({
    width: translateX.value + THUMB_SIZE / 2,
  }));

  // Calculate step dots - show 5 key positions
  const stepPositions = useMemo(() => {
    const positions = [];
    const numSteps = 5;
    for (let i = 0; i < numSteps; i++) {
      const percent = i / (numSteps - 1);
      const stepValue = Math.round(min + percent * (max - min));
      positions.push(stepValue);
    }
    return positions;
  }, [min, max]);

  const getValueLabel = () => {
    if (value <= 3) return 'Strongly ' + leftLabel.toLowerCase();
    if (value <= 4) return 'Somewhat ' + leftLabel.toLowerCase();
    if (value >= 5 && value <= 6) return 'Balanced';
    if (value <= 7) return 'Somewhat ' + rightLabel.toLowerCase();
    return 'Strongly ' + rightLabel.toLowerCase();
  };

  return (
    <View style={styles.container}>
      {/* Labels */}
      <View style={styles.labelsContainer}>
        <Animated.View style={[styles.labelWrapper, leftLabelStyle]}>
          <Text style={styles.emoji}>{leftEmoji}</Text>
          <Text style={styles.labelText}>{leftLabel}</Text>
        </Animated.View>
        <Animated.View style={[styles.labelWrapper, rightLabelStyle]}>
          <Text style={styles.emoji}>{rightEmoji}</Text>
          <Text style={styles.labelText}>{rightLabel}</Text>
        </Animated.View>
      </View>

      {/* Slider Track Area */}
      <View style={styles.sliderContainer}>
        {/* Track visual - positioned to align with thumb center positions */}
        <View style={styles.trackWrapper}>
          <View style={styles.track}>
            <LinearGradient
              colors={[colors.accent.sky.light, colors.primary[100], colors.accent.violet.light]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.trackGradient}
            />
          </View>

          {/* Filled portion */}
          <Animated.View style={[styles.fill, fillStyle, fillWidthStyle]} />
        </View>

        {/* Thumb with gesture - positioned from left edge */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.thumbHitArea, thumbStyle]}>
            <View style={styles.thumbInner}>
              <Text style={styles.thumbValue}>{value}</Text>
            </View>
          </Animated.View>
        </GestureDetector>

        {/* Step indicators - aligned with track */}
        <View style={styles.stepsContainer}>
          {stepPositions.map((stepValue, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                stepValue === value && styles.stepDotActive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Value indicator */}
      <View style={styles.valueContainer}>
        <Text style={styles.valueText}>{getValueLabel()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: SLIDER_PADDING,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  labelWrapper: {
    alignItems: 'center',
    maxWidth: '40%',
  },
  emoji: {
    fontSize: 28,
    marginBottom: spacing[1],
  },
  labelText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[700],
    textAlign: 'center',
  },
  sliderContainer: {
    height: 70,
    justifyContent: 'center',
    // Add padding so thumb doesn't overflow container
    paddingHorizontal: THUMB_SIZE / 2,
  },
  trackWrapper: {
    position: 'relative',
    height: TRACK_HEIGHT,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    // Track width matches the draggable range
    width: TRACK_WIDTH,
  },
  trackGradient: {
    flex: 1,
  },
  fill: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: borderRadius.full,
    top: 0,
    left: 0,
  },
  thumbHitArea: {
    position: 'absolute',
    width: THUMB_SIZE + 20,
    height: THUMB_SIZE + 30,
    // Center vertically in the container
    top: (70 - THUMB_SIZE - 30) / 2,
    // Offset by half thumb to center on track edge
    left: THUMB_SIZE / 2 - 10 - THUMB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbInner: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: colors.primary[500],
  },
  thumbValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  stepsContainer: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    // Match track width
    width: TRACK_WIDTH,
    // Align with track (account for container padding)
    left: THUMB_SIZE / 2,
    top: (70 + TRACK_HEIGHT) / 2 + 6,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neutral[300],
  },
  stepDotActive: {
    backgroundColor: colors.primary[500],
    transform: [{ scale: 1.3 }],
  },
  valueContainer: {
    alignItems: 'center',
    marginTop: spacing[4],
  },
  valueText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[500],
  },
});

export default OnboardingSlider;
