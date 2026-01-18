/**
 * OnboardingSlider - Animated slider for personality trait selection
 *
 * Features:
 * - Spring-based thumb animation
 * - Haptic feedback at key points
 * - Visual gradient track
 * - Animated labels
 */

import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  interpolate,
  interpolateColor,
  useAnimatedGestureHandler,
} from 'react-native-reanimated';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, animation } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_WIDTH = SCREEN_WIDTH - spacing[10] * 2;
const THUMB_SIZE = 32;
const TRACK_HEIGHT = 8;

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
  const translateX = useSharedValue(valueToPosition(value, min, max));
  const scale = useSharedValue(1);
  const lastHapticValue = useSharedValue(value);

  useEffect(() => {
    translateX.value = withSpring(valueToPosition(value, min, max), animation.spring.snappy);
  }, [value, min, max]);

  function valueToPosition(val: number, minVal: number, maxVal: number): number {
    const range = maxVal - minVal;
    const percent = (val - minVal) / range;
    return percent * (SLIDER_WIDTH - THUMB_SIZE);
  }

  function positionToValue(pos: number, minVal: number, maxVal: number, stepVal: number): number {
    const percent = Math.max(0, Math.min(1, pos / (SLIDER_WIDTH - THUMB_SIZE)));
    const range = maxVal - minVal;
    const rawValue = minVal + percent * range;
    return Math.round(rawValue / stepVal) * stepVal;
  }

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const triggerStrongHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const gestureHandler = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    { startX: number }
  >({
    onStart: (_, ctx) => {
      ctx.startX = translateX.value;
      scale.value = withSpring(1.2, animation.spring.snappy);
    },
    onActive: (event, ctx) => {
      const newX = Math.max(0, Math.min(SLIDER_WIDTH - THUMB_SIZE, ctx.startX + event.translationX));
      translateX.value = newX;

      const newValue = positionToValue(newX, min, max, step);
      if (newValue !== lastHapticValue.value) {
        lastHapticValue.value = newValue;
        // Stronger haptic at extremes
        if (newValue === min || newValue === max) {
          runOnJS(triggerStrongHaptic)();
        } else {
          runOnJS(triggerHaptic)();
        }
        runOnJS(onValueChange)(newValue);
      }
    },
    onEnd: () => {
      scale.value = withSpring(1, animation.spring.snappy);
      // Snap to nearest step
      const currentValue = positionToValue(translateX.value, min, max, step);
      translateX.value = withSpring(valueToPosition(currentValue, min, max), animation.spring.snappy);
    },
  });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  const leftLabelStyle = useAnimatedStyle(() => {
    const progress = translateX.value / (SLIDER_WIDTH - THUMB_SIZE);
    return {
      opacity: interpolate(progress, [0, 0.3, 0.7, 1], [1, 0.6, 0.4, 0.3]),
      transform: [
        { scale: interpolate(progress, [0, 0.5, 1], [1.1, 1, 0.9]) },
      ],
    };
  });

  const rightLabelStyle = useAnimatedStyle(() => {
    const progress = translateX.value / (SLIDER_WIDTH - THUMB_SIZE);
    return {
      opacity: interpolate(progress, [0, 0.3, 0.7, 1], [0.3, 0.4, 0.6, 1]),
      transform: [
        { scale: interpolate(progress, [0, 0.5, 1], [0.9, 1, 1.1]) },
      ],
    };
  });

  const fillStyle = useAnimatedStyle(() => {
    const progress = translateX.value / (SLIDER_WIDTH - THUMB_SIZE);
    return {
      backgroundColor: interpolateColor(
        progress,
        [0, 0.5, 1],
        [colors.accent.sky.base, colors.primary[500], colors.accent.violet.base]
      ),
    };
  });

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

      {/* Slider Track */}
      <View style={styles.sliderContainer}>
        <View style={styles.track}>
          <LinearGradient
            colors={[colors.accent.sky.light, colors.primary[100], colors.accent.violet.light]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.trackGradient}
          />
        </View>

        {/* Filled portion */}
        <Animated.View style={[styles.fill, fillStyle, { width: translateX.value + THUMB_SIZE / 2 }]} />

        {/* Thumb */}
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View style={[styles.thumb, thumbStyle]}>
            <View style={styles.thumbInner}>
              <Text style={styles.thumbValue}>{value}</Text>
            </View>
          </Animated.View>
        </PanGestureHandler>

        {/* Step indicators */}
        <View style={styles.stepsContainer}>
          {Array.from({ length: max - min + 1 }, (_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                i + min === value && styles.stepDotActive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Value indicator */}
      <View style={styles.valueContainer}>
        <Text style={styles.valueText}>
          {value <= 3 ? 'Strongly ' + leftLabel.toLowerCase() :
           value <= 4 ? 'Somewhat ' + leftLabel.toLowerCase() :
           value === 5 ? 'Balanced' :
           value <= 7 ? 'Somewhat ' + rightLabel.toLowerCase() :
           'Strongly ' + rightLabel.toLowerCase()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: spacing[5],
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
    height: 60,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  trackGradient: {
    flex: 1,
  },
  fill: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: borderRadius.full,
    top: (60 - TRACK_HEIGHT) / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    top: (60 - THUMB_SIZE) / 2,
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
    width: '100%',
    paddingHorizontal: THUMB_SIZE / 2 - 2,
    top: (60 - TRACK_HEIGHT) / 2 + TRACK_HEIGHT + 8,
  },
  stepDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
  },
  stepDotActive: {
    backgroundColor: colors.primary[500],
    transform: [{ scale: 1.5 }],
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
