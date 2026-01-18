/**
 * OnboardingProgress - Animated progress indicator
 *
 * Features:
 * - Spring-based progress animation
 * - Step indicators with completion state
 * - Smooth color transitions
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius, animation } from '../../theme';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

export function OnboardingProgress({
  currentStep,
  totalSteps,
  labels,
}: OnboardingProgressProps) {
  const progress = useSharedValue(currentStep / totalSteps);

  React.useEffect(() => {
    progress.value = withSpring(currentStep / totalSteps, animation.spring.default);
  }, [currentStep, totalSteps]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressBarStyle]} />
      </View>

      {/* Step indicators */}
      <View style={styles.stepsContainer}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <StepIndicator
            key={i}
            index={i}
            currentStep={currentStep}
            totalSteps={totalSteps}
            label={labels?.[i]}
          />
        ))}
      </View>

      {/* Step counter */}
      <View style={styles.counterContainer}>
        <Text style={styles.counterText}>
          Step {currentStep} of {totalSteps}
        </Text>
      </View>
    </View>
  );
}

interface StepIndicatorProps {
  index: number;
  currentStep: number;
  totalSteps: number;
  label?: string;
}

function StepIndicator({ index, currentStep, totalSteps, label }: StepIndicatorProps) {
  const stepNumber = index + 1;
  const isCompleted = stepNumber < currentStep;
  const isCurrent = stepNumber === currentStep;
  const isUpcoming = stepNumber > currentStep;

  const animValue = useSharedValue(isCompleted ? 1 : isCurrent ? 0.5 : 0);

  React.useEffect(() => {
    animValue.value = withSpring(isCompleted ? 1 : isCurrent ? 0.5 : 0, animation.spring.snappy);
  }, [isCompleted, isCurrent]);

  const dotStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      animValue.value,
      [0, 0.5, 1],
      [colors.neutral[200], colors.primary[400], colors.primary[500]]
    ),
    transform: [
      { scale: interpolate(animValue.value, [0, 0.5, 1], [0.8, 1, 1]) },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animValue.value, [0, 0.5, 1], [0.4, 1, 0.7]),
    color: interpolateColor(
      animValue.value,
      [0, 0.5, 1],
      [colors.neutral[400], colors.primary[600], colors.neutral[600]]
    ),
  }));

  return (
    <View style={styles.stepIndicator}>
      <Animated.View style={[styles.stepDot, dotStyle]}>
        {isCompleted && (
          <Text style={styles.checkmark}>✓</Text>
        )}
        {isCurrent && (
          <View style={styles.currentDotInner} />
        )}
      </Animated.View>
      {label && (
        <Animated.Text style={[styles.stepLabel, labelStyle]}>
          {label}
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.neutral[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[4],
    paddingHorizontal: spacing[2],
  },
  stepIndicator: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentDotInner: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[0],
  },
  checkmark: {
    fontSize: 14,
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
  },
  stepLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing[1],
    textAlign: 'center',
  },
  counterContainer: {
    alignItems: 'center',
    marginTop: spacing[3],
  },
  counterText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    fontWeight: typography.fontWeight.medium,
  },
});

export default OnboardingProgress;
