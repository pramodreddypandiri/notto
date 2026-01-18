/**
 * OnboardingScreen - Container for each onboarding step
 *
 * Features:
 * - Animated entrance/exit
 * - Consistent layout
 * - Keyboard-aware scrolling
 */

import React, { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, textPresets } from '../../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingScreenProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  illustration?: ReactNode;
}

export function OnboardingScreen({
  title,
  subtitle,
  children,
  footer,
  illustration,
}: OnboardingScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Illustration */}
          {illustration && (
            <Animated.View
              entering={FadeIn.delay(200).duration(400)}
              style={styles.illustrationContainer}
            >
              {illustration}
            </Animated.View>
          )}

          {/* Header */}
          <Animated.View
            entering={SlideInRight.delay(100).springify().damping(15)}
            style={styles.header}
          >
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </Animated.View>

          {/* Content */}
          <Animated.View
            entering={SlideInRight.delay(200).springify().damping(15)}
            style={styles.content}
          >
            {children}
          </Animated.View>
        </ScrollView>

        {/* Footer */}
        {footer && (
          <Animated.View
            entering={FadeIn.delay(400).duration(300)}
            style={styles.footer}
          >
            {footer}
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  header: {
    marginBottom: spacing[6],
  },
  title: {
    ...textPresets.h2,
    marginBottom: spacing[2],
  },
  subtitle: {
    ...textPresets.bodyLarge,
    color: colors.neutral[600],
  },
  content: {
    flex: 1,
    marginBottom: spacing[6],
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
    paddingTop: spacing[3],
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
});

export default OnboardingScreen;
