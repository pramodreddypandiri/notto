/**
 * Onboarding Flow
 *
 * Multi-step onboarding to collect user preferences for AI personalization.
 * Questions: Age, Gender, Wake/Bed times, Hobbies, Tone, Self-description
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  OnboardingOption,
  OnboardingProgress,
  OnboardingScreen,
  OnboardingTimePicker,
  OnboardingTextInput,
} from '../components/onboarding';
import { PremiumButton } from '../components/ui/PremiumButton';
import { AnimatedPressable } from '../components/ui/AnimatedPressable';
import {
  getUserProfile,
  updateUserProfile,
  completeOnboarding,
} from '../services/profileService';
import { colors, typography, spacing, borderRadius, animation, textPresets } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Onboarding question options
const AGE_OPTIONS = [
  { value: '18-24', label: '18-24', emoji: '🌱', description: 'Just getting started' },
  { value: '25-34', label: '25-34', emoji: '🚀', description: 'Building momentum' },
  { value: '35-44', label: '35-44', emoji: '⭐', description: 'In your prime' },
  { value: '45-54', label: '45-54', emoji: '🎯', description: 'Experienced & focused' },
  { value: '55-64', label: '55-64', emoji: '🏆', description: 'Seasoned achiever' },
  { value: '65+', label: '65+', emoji: '👑', description: 'Wisdom & experience' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male', emoji: '👨', description: '' },
  { value: 'female', label: 'Female', emoji: '👩', description: '' },
  { value: 'non_binary', label: 'Non-binary', emoji: '🧑', description: '' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say', emoji: '🤐', description: '' },
];

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional', emoji: '💼', description: 'Formal and business-like' },
  { value: 'friendly', label: 'Friendly', emoji: '😊', description: 'Warm and approachable' },
  { value: 'casual', label: 'Casual', emoji: '✌️', description: 'Relaxed and informal' },
  { value: 'motivational', label: 'Motivational', emoji: '🔥', description: 'Energetic and inspiring' },
];

const TOTAL_STEPS = 9; // welcome + 7 questions + complete

type Step = 'welcome' | 'age' | 'gender' | 'wake_time' | 'bed_time' | 'hobbies' | 'tone' | 'self_description' | 'complete';

const STEP_ORDER: Step[] = ['welcome', 'age', 'gender', 'wake_time', 'bed_time', 'hobbies', 'tone', 'self_description', 'complete'];

export default function OnboardingFlow() {
  const { retake } = useLocalSearchParams<{ retake?: string }>();
  const isRetake = retake === 'true';

  const [step, setStep] = useState<Step>(isRetake ? 'age' : 'welcome');

  // Profile data
  const [profileData, setProfileData] = useState({
    age_range: null as string | null,
    gender: null as string | null,
    wake_up_time: null as string | null,
    bed_time: null as string | null,
    hobbies: '',
    tone: null as string | null,
    self_description: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  // When retaking, load existing profile data
  useEffect(() => {
    if (isRetake) {
      getUserProfile().then((profile) => {
        if (profile) {
          setProfileData({
            age_range: profile.age_range ?? null,
            gender: profile.gender ?? null,
            wake_up_time: profile.wake_up_time ?? null,
            bed_time: profile.bed_time ?? null,
            hobbies: profile.hobbies ?? '',
            tone: profile.tone ?? null,
            self_description: profile.self_description ?? '',
          });
        }
      });
    }
  }, [isRetake]);

  const getCurrentStepNumber = (): number => {
    return STEP_ORDER.indexOf(step) + 1;
  };

  const handleNext = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const currentIndex = STEP_ORDER.indexOf(step);
    if (currentIndex < STEP_ORDER.length - 2) {
      // Not at self_description yet
      setStep(STEP_ORDER[currentIndex + 1]);
    } else if (step === 'self_description') {
      await handleComplete();
    }
  }, [step, profileData]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const currentIndex = STEP_ORDER.indexOf(step);
    const minIndex = isRetake ? STEP_ORDER.indexOf('age') : 0;
    if (currentIndex > minIndex && step !== 'complete') {
      setStep(STEP_ORDER[currentIndex - 1]);
    } else if (isRetake && step === 'age') {
      router.back();
    }
  }, [step, isRetake]);

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Save all profile data
      await updateUserProfile({
        age_range: profileData.age_range as any,
        gender: profileData.gender as any,
        wake_up_time: profileData.wake_up_time,
        bed_time: profileData.bed_time,
        hobbies: profileData.hobbies || null,
        tone: profileData.tone as any,
        self_description: profileData.self_description || null,
      });

      await completeOnboarding();

      setStep('complete');

      // Navigate to main app after animation
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 2000);
    } catch (error) {
      console.error('Failed to save onboarding data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  const updateProfile = (key: keyof typeof profileData, value: any) => {
    setProfileData(prev => ({ ...prev, [key]: value }));
  };

  // Check if current step has valid input
  const canProceed = (): boolean => {
    switch (step) {
      case 'age':
        return !!profileData.age_range;
      case 'gender':
        return !!profileData.gender;
      case 'wake_time':
        return !!profileData.wake_up_time;
      case 'bed_time':
        return !!profileData.bed_time;
      case 'hobbies':
        return profileData.hobbies.trim().length > 0;
      case 'tone':
        return !!profileData.tone;
      case 'self_description':
        return profileData.self_description.trim().length > 0;
      default:
        return true;
    }
  };

  // Render current step
  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return <WelcomeStep onGetStarted={handleNext} onSkip={handleSkip} />;

      case 'age':
        return (
          <SelectionStep
            title="What's your age range?"
            subtitle="This helps us personalize your experience"
            options={AGE_OPTIONS}
            value={profileData.age_range}
            onSelect={(value) => updateProfile('age_range', value)}
            onNext={handleNext}
            onBack={handleBack}
            canProceed={canProceed()}
          />
        );

      case 'gender':
        return (
          <SelectionStep
            title="How do you identify?"
            subtitle="Optional - helps us personalize content"
            options={GENDER_OPTIONS}
            value={profileData.gender}
            onSelect={(value) => updateProfile('gender', value)}
            onNext={handleNext}
            onBack={handleBack}
            canProceed={canProceed()}
          />
        );

      case 'wake_time':
        return (
          <TimeStep
            title="When do you usually wake up?"
            subtitle="We'll optimize notifications and reminders for your schedule"
            icon="sunny-outline"
            value={profileData.wake_up_time}
            onChange={(value) => updateProfile('wake_up_time', value)}
            onNext={handleNext}
            onBack={handleBack}
            canProceed={canProceed()}
          />
        );

      case 'bed_time':
        return (
          <TimeStep
            title="When do you usually go to bed?"
            subtitle="We'll respect your wind-down time"
            icon="moon-outline"
            value={profileData.bed_time}
            onChange={(value) => updateProfile('bed_time', value)}
            onNext={handleNext}
            onBack={handleBack}
            canProceed={canProceed()}
          />
        );

      case 'hobbies':
        return (
          <TextInputStep
            title="What are your hobbies?"
            subtitle="This helps the AI understand you better"
            placeholder="e.g., Reading, hiking, photography, cooking..."
            value={profileData.hobbies}
            onChange={(value) => updateProfile('hobbies', value)}
            onNext={handleNext}
            onBack={handleBack}
            canProceed={canProceed()}
            icon="heart-outline"
            multiline
          />
        );

      case 'tone':
        return (
          <SelectionStep
            title="How should the app sound to you?"
            subtitle="Choose the communication style you prefer"
            options={TONE_OPTIONS}
            value={profileData.tone}
            onSelect={(value) => updateProfile('tone', value)}
            onNext={handleNext}
            onBack={handleBack}
            canProceed={canProceed()}
          />
        );

      case 'self_description':
        return (
          <TextInputStep
            title="Who do you think you are?"
            subtitle="Describe yourself briefly - this helps personalize your experience"
            placeholder="e.g., A creative entrepreneur who loves learning new things..."
            value={profileData.self_description}
            onChange={(value) => updateProfile('self_description', value)}
            onNext={handleNext}
            onBack={handleBack}
            canProceed={canProceed()}
            isLoading={isLoading}
            isLast
            maxLength={150}
            icon="person-outline"
          />
        );

      case 'complete':
        return <CompleteStep />;

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Progress bar (not shown on welcome/complete) */}
      {step !== 'welcome' && step !== 'complete' && (
        <SafeAreaView edges={['top']} style={styles.progressContainer}>
          <OnboardingProgress
            currentStep={getCurrentStepNumber()}
            totalSteps={TOTAL_STEPS}
          />
        </SafeAreaView>
      )}

      {/* Step content */}
      {renderStep()}
    </View>
  );
}

// ============================================
// Step Components
// ============================================

function WelcomeStep({
  onGetStarted,
  onSkip,
}: {
  onGetStarted: () => void;
  onSkip: () => void;
}) {
  const logoScale = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  React.useEffect(() => {
    logoScale.value = withDelay(200, withSpring(1, animation.spring.bouncy));
    textOpacity.value = withDelay(600, withSpring(1, animation.spring.gentle));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <SafeAreaView style={styles.welcomeContainer}>
      {/* Logo/Illustration */}
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <LinearGradient
          colors={colors.gradients.primary as [string, string]}
          style={styles.logoGradient}
        >
          <Ionicons name="sparkles" size={48} color={colors.neutral[0]} />
        </LinearGradient>
      </Animated.View>

      {/* Text */}
      <Animated.View style={[styles.welcomeTextContainer, textStyle]}>
        <Text style={styles.welcomeTitle}>Let's personalize{'\n'}your experience</Text>
        <Text style={styles.welcomeSubtitle}>
          Answer a few quick questions so we can tailor the app to your preferences.
        </Text>
      </Animated.View>

      {/* Benefits */}
      <Animated.View style={[styles.benefitsContainer, textStyle]}>
        <BenefitItem icon="time" text="Smart scheduling based on your routine" />
        <BenefitItem icon="chatbubble" text="Communication in your preferred tone" />
        <BenefitItem icon="sparkles" text="AI that truly understands you" />
      </Animated.View>

      {/* CTA */}
      <Animated.View style={[styles.welcomeFooter, textStyle]}>
        <PremiumButton onPress={onGetStarted} gradient fullWidth size="lg">
          Let's Get Started
        </PremiumButton>
        <AnimatedPressable onPress={onSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip for now</Text>
        </AnimatedPressable>
      </Animated.View>
    </SafeAreaView>
  );
}

function BenefitItem({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.benefitItem}>
      <View style={styles.benefitIcon}>
        <Ionicons name={icon} size={20} color={colors.primary[500]} />
      </View>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function SelectionStep({
  title,
  subtitle,
  options,
  value,
  onSelect,
  onNext,
  onBack,
  canProceed,
}: {
  title: string;
  subtitle: string;
  options: Array<{ value: string; label: string; emoji: string; description: string }>;
  value: string | null;
  onSelect: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}) {
  return (
    <OnboardingScreen
      title={title}
      subtitle={subtitle}
      footer={
        <View style={styles.footerButtons}>
          <AnimatedPressable onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.neutral[600]} />
          </AnimatedPressable>
          <View style={styles.nextButtonContainer}>
            <PremiumButton onPress={onNext} gradient size="lg" disabled={!canProceed}>
              Continue
            </PremiumButton>
          </View>
        </View>
      }
    >
      <ScrollView style={styles.optionsScrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.optionsContainer}>
          {options.map((option) => (
            <OnboardingOption
              key={option.value}
              label={option.label}
              description={option.description}
              emoji={option.emoji}
              selected={value === option.value}
              onSelect={() => onSelect(option.value)}
            />
          ))}
        </View>
      </ScrollView>
    </OnboardingScreen>
  );
}

function TimeStep({
  title,
  subtitle,
  icon,
  value,
  onChange,
  onNext,
  onBack,
  canProceed,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string | null;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}) {
  return (
    <OnboardingScreen
      title={title}
      subtitle={subtitle}
      footer={
        <View style={styles.footerButtons}>
          <AnimatedPressable onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.neutral[600]} />
          </AnimatedPressable>
          <View style={styles.nextButtonContainer}>
            <PremiumButton onPress={onNext} gradient size="lg" disabled={!canProceed}>
              Continue
            </PremiumButton>
          </View>
        </View>
      }
    >
      <View style={styles.timePickerContainer}>
        <OnboardingTimePicker
          label="Select time"
          value={value}
          onChange={onChange}
          icon={icon}
        />
      </View>
    </OnboardingScreen>
  );
}

function TextInputStep({
  title,
  subtitle,
  placeholder,
  value,
  onChange,
  onNext,
  onBack,
  canProceed,
  isLoading = false,
  isLast = false,
  maxLength,
  icon,
  multiline = false,
}: {
  title: string;
  subtitle: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
  isLoading?: boolean;
  isLast?: boolean;
  maxLength?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  multiline?: boolean;
}) {
  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <OnboardingScreen
        title={title}
        subtitle={subtitle}
        footer={
          <View style={styles.footerButtons}>
            <AnimatedPressable onPress={onBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.neutral[600]} />
            </AnimatedPressable>
            <View style={styles.nextButtonContainer}>
              <PremiumButton
                onPress={onNext}
                gradient
                size="lg"
                disabled={!canProceed}
                loading={isLoading}
              >
                {isLast ? 'Finish Setup' : 'Continue'}
              </PremiumButton>
            </View>
          </View>
        }
      >
        <View style={styles.textInputContainer}>
          <OnboardingTextInput
            label=""
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            maxLength={maxLength}
            icon={icon}
            multiline={multiline}
            numberOfLines={multiline ? 4 : 1}
          />
        </View>
      </OnboardingScreen>
    </KeyboardAvoidingView>
  );
}

function CompleteStep() {
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    scale.value = withSequence(
      withSpring(1.2, animation.spring.bouncy),
      withSpring(1, animation.spring.default)
    );
    rotation.value = withSpring(360, { ...animation.spring.default, damping: 12 });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  return (
    <SafeAreaView style={styles.completeContainer}>
      <Animated.View style={[styles.completeIcon, iconStyle]}>
        <LinearGradient
          colors={colors.gradients.success as [string, string]}
          style={styles.completeIconGradient}
        >
          <Ionicons name="checkmark" size={48} color={colors.neutral[0]} />
        </LinearGradient>
      </Animated.View>

      <Animated.Text
        entering={FadeIn.delay(400)}
        style={styles.completeTitle}
      >
        You're all set!
      </Animated.Text>

      <Animated.Text
        entering={FadeIn.delay(600)}
        style={styles.completeSubtitle}
      >
        We'll use your preferences to create a personalized experience just for you.
      </Animated.Text>
    </SafeAreaView>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  progressContainer: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
  },
  keyboardAvoidingView: {
    flex: 1,
  },

  // Welcome step
  welcomeContainer: {
    flex: 1,
    paddingHorizontal: spacing[6],
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  welcomeTextContainer: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  welcomeTitle: {
    ...textPresets.h1,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  welcomeSubtitle: {
    ...textPresets.bodyLarge,
    textAlign: 'center',
    color: colors.neutral[600],
    paddingHorizontal: spacing[4],
  },
  benefitsContainer: {
    marginBottom: spacing[10],
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  benefitText: {
    ...textPresets.body,
    color: colors.neutral[700],
    flex: 1,
  },
  welcomeFooter: {
    alignItems: 'center',
  },
  skipButton: {
    marginTop: spacing[4],
    paddingVertical: spacing[2],
  },
  skipText: {
    ...textPresets.body,
    color: colors.neutral[500],
  },

  // Options step
  optionsScrollView: {
    flex: 1,
  },
  optionsContainer: {
    paddingTop: spacing[2],
  },

  // Time picker step
  timePickerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing[4],
  },

  // Text input step
  textInputContainer: {
    flex: 1,
    paddingTop: spacing[4],
  },

  // Footer
  footerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonContainer: {
    flex: 1,
  },

  // Complete step
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  completeIcon: {
    marginBottom: spacing[6],
  },
  completeIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeTitle: {
    ...textPresets.h1,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  completeSubtitle: {
    ...textPresets.bodyLarge,
    textAlign: 'center',
    color: colors.neutral[600],
  },
});
