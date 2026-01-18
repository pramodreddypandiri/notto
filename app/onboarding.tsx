/**
 * Premium Onboarding Flow
 *
 * Multi-step onboarding to collect user personality traits and preferences
 * for AI-powered plan personalization.
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  OnboardingSlider,
  OnboardingOption,
  OnboardingProgress,
  OnboardingScreen,
} from '../components/onboarding';
import { PremiumButton } from '../components/ui/PremiumButton';
import { AnimatedPressable } from '../components/ui/AnimatedPressable';
import {
  updateUserProfile,
  saveOnboardingResponse,
  completeOnboarding,
} from '../services/profileService';
import { colors, typography, spacing, borderRadius, animation, textPresets } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Onboarding question data
const PERSONALITY_QUESTIONS = [
  {
    id: 'introvert_extrovert',
    title: 'Social Energy',
    subtitle: 'How do you prefer to spend your free time?',
    leftLabel: 'Introvert',
    rightLabel: 'Extrovert',
    leftEmoji: '🏠',
    rightEmoji: '🎉',
    leftDesc: 'Prefer quiet, intimate settings',
    rightDesc: 'Love buzzing, social atmospheres',
  },
  {
    id: 'spontaneous_planner',
    title: 'Planning Style',
    subtitle: 'When it comes to making plans...',
    leftLabel: 'Planner',
    rightLabel: 'Spontaneous',
    leftEmoji: '📅',
    rightEmoji: '✨',
    leftDesc: 'I like to plan ahead in detail',
    rightDesc: 'I prefer going with the flow',
  },
  {
    id: 'adventurous_comfort',
    title: 'Adventure Level',
    subtitle: 'When trying new things...',
    leftLabel: 'Comfort',
    rightLabel: 'Adventure',
    leftEmoji: '🛋️',
    rightEmoji: '🎢',
    leftDesc: 'I stick to what I know and love',
    rightDesc: 'I\'m always ready to try something new',
  },
  {
    id: 'energy_level',
    title: 'Activity Preference',
    subtitle: 'What kind of activities do you enjoy?',
    leftLabel: 'Relaxed',
    rightLabel: 'Active',
    leftEmoji: '🧘',
    rightEmoji: '⚡',
    leftDesc: 'Chill vibes and laid-back activities',
    rightDesc: 'High-energy and physically active',
  },
];

const SOCIAL_OPTIONS = {
  group_size: {
    title: 'Who do you usually go out with?',
    subtitle: 'This helps us suggest the right venues',
    options: [
      { value: 'solo', label: 'Just Me', emoji: '🙋', description: 'Solo adventures' },
      { value: 'couple', label: 'With Partner', emoji: '💑', description: 'Date nights' },
      { value: 'small_group', label: 'Small Group', emoji: '👯', description: '2-4 friends' },
      { value: 'large_group', label: 'Large Group', emoji: '🎊', description: '5+ people' },
      { value: 'flexible', label: 'It Varies', emoji: '🔄', description: 'Depends on the occasion' },
    ],
  },
  social_context: {
    title: 'What\'s your typical outing vibe?',
    subtitle: 'We\'ll tailor recommendations to your context',
    options: [
      { value: 'date_night', label: 'Date Night', emoji: '🌹', description: 'Romantic evenings out' },
      { value: 'friends', label: 'Friend Hangouts', emoji: '🍻', description: 'Casual time with friends' },
      { value: 'family', label: 'Family Time', emoji: '👨‍👩‍👧', description: 'Family-friendly activities' },
      { value: 'solo', label: 'Me Time', emoji: '🎧', description: 'Self-care and solo fun' },
      { value: 'mixed', label: 'All of the Above', emoji: '🎭', description: 'A bit of everything' },
    ],
  },
};

const PRACTICAL_OPTIONS = {
  budget: {
    title: 'What\'s your spending style?',
    subtitle: 'No judgment—we\'ll find great options for any budget',
    options: [
      { value: 'budget', label: 'Budget-Friendly', emoji: '💰', description: 'Keep it affordable' },
      { value: 'moderate', label: 'Moderate', emoji: '💳', description: 'Balance quality and cost' },
      { value: 'splurge', label: 'Treat Yourself', emoji: '💎', description: 'Worth the splurge' },
      { value: 'flexible', label: 'Depends', emoji: '🤷', description: 'Varies by occasion' },
    ],
  },
  time: {
    title: 'When do you like to go out?',
    subtitle: 'We\'ll find places that are perfect for your schedule',
    options: [
      { value: 'morning', label: 'Morning Person', emoji: '🌅', description: 'Brunch and early activities' },
      { value: 'afternoon', label: 'Afternoon', emoji: '☀️', description: 'Daytime adventures' },
      { value: 'evening', label: 'Evening', emoji: '🌆', description: 'Dinner and sunset vibes' },
      { value: 'night', label: 'Night Owl', emoji: '🌙', description: 'Late night fun' },
      { value: 'flexible', label: 'Anytime', emoji: '🕐', description: 'Flexible with timing' },
    ],
  },
  pace: {
    title: 'How packed should your plans be?',
    subtitle: 'We\'ll create the perfect itinerary density',
    options: [
      { value: 'relaxed', label: 'Relaxed', emoji: '🐢', description: 'One or two things, plenty of downtime' },
      { value: 'balanced', label: 'Balanced', emoji: '⚖️', description: 'A good mix of activity and rest' },
      { value: 'packed', label: 'Packed', emoji: '🚀', description: 'Maximize the day!' },
    ],
  },
};

const TOTAL_STEPS = 6;

type Step = 'welcome' | 'personality' | 'social' | 'context' | 'practical' | 'complete';

export default function OnboardingFlow() {
  const [step, setStep] = useState<Step>('welcome');
  const [currentPersonalityIndex, setCurrentPersonalityIndex] = useState(0);

  // Profile data
  const [personality, setPersonality] = useState({
    introvert_extrovert: 5,
    spontaneous_planner: 5,
    adventurous_comfort: 5,
    energy_level: 5,
  });
  const [social, setSocial] = useState({
    preferred_group_size: 'flexible' as string,
    social_context: 'mixed' as string,
  });
  const [practical, setPractical] = useState({
    budget_sensitivity: 'moderate' as string,
    time_preference: 'flexible' as string,
    pace_preference: 'balanced' as string,
  });

  const [isLoading, setIsLoading] = useState(false);

  const getCurrentStepNumber = (): number => {
    switch (step) {
      case 'welcome': return 1;
      case 'personality': return 2;
      case 'social': return 3;
      case 'context': return 4;
      case 'practical': return 5;
      case 'complete': return 6;
      default: return 1;
    }
  };

  const handleNext = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    switch (step) {
      case 'welcome':
        setStep('personality');
        break;
      case 'personality':
        if (currentPersonalityIndex < PERSONALITY_QUESTIONS.length - 1) {
          setCurrentPersonalityIndex(prev => prev + 1);
        } else {
          setStep('social');
        }
        break;
      case 'social':
        setStep('context');
        break;
      case 'context':
        setStep('practical');
        break;
      case 'practical':
        await handleComplete();
        break;
    }
  }, [step, currentPersonalityIndex]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    switch (step) {
      case 'personality':
        if (currentPersonalityIndex > 0) {
          setCurrentPersonalityIndex(prev => prev - 1);
        } else {
          setStep('welcome');
        }
        break;
      case 'social':
        setCurrentPersonalityIndex(PERSONALITY_QUESTIONS.length - 1);
        setStep('personality');
        break;
      case 'context':
        setStep('social');
        break;
      case 'practical':
        setStep('context');
        break;
    }
  }, [step, currentPersonalityIndex]);

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Save all profile data
      await updateUserProfile({
        introvert_extrovert: personality.introvert_extrovert,
        spontaneous_planner: personality.spontaneous_planner,
        adventurous_comfort: personality.adventurous_comfort,
        energy_level: personality.energy_level,
        preferred_group_size: social.preferred_group_size as any,
        social_context: social.social_context as any,
        budget_sensitivity: practical.budget_sensitivity as any,
        time_preference: practical.time_preference as any,
        pace_preference: practical.pace_preference as any,
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

  // Render current step
  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return <WelcomeStep onGetStarted={handleNext} onSkip={handleSkip} />;

      case 'personality':
        const currentQuestion = PERSONALITY_QUESTIONS[currentPersonalityIndex];
        const currentValue = personality[currentQuestion.id as keyof typeof personality];
        return (
          <PersonalityStep
            key={currentQuestion.id}
            question={currentQuestion}
            value={currentValue}
            onValueChange={(value) => {
              setPersonality(prev => ({
                ...prev,
                [currentQuestion.id]: value,
              }));
            }}
            onNext={handleNext}
            onBack={handleBack}
            currentIndex={currentPersonalityIndex}
            totalQuestions={PERSONALITY_QUESTIONS.length}
          />
        );

      case 'social':
        return (
          <OptionStep
            key="social"
            config={SOCIAL_OPTIONS.group_size}
            value={social.preferred_group_size}
            onSelect={(value) => setSocial(prev => ({ ...prev, preferred_group_size: value }))}
            onNext={handleNext}
            onBack={handleBack}
          />
        );

      case 'context':
        return (
          <OptionStep
            key="context"
            config={SOCIAL_OPTIONS.social_context}
            value={social.social_context}
            onSelect={(value) => setSocial(prev => ({ ...prev, social_context: value }))}
            onNext={handleNext}
            onBack={handleBack}
          />
        );

      case 'practical':
        return (
          <PracticalStep
            budget={practical.budget_sensitivity}
            time={practical.time_preference}
            pace={practical.pace_preference}
            onBudgetChange={(value) => setPractical(prev => ({ ...prev, budget_sensitivity: value }))}
            onTimeChange={(value) => setPractical(prev => ({ ...prev, time_preference: value }))}
            onPaceChange={(value) => setPractical(prev => ({ ...prev, pace_preference: value }))}
            onNext={handleNext}
            onBack={handleBack}
            isLoading={isLoading}
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
          Answer a few quick questions so we can create plans that are perfectly tailored to you.
        </Text>
      </Animated.View>

      {/* Benefits */}
      <Animated.View style={[styles.benefitsContainer, textStyle]}>
        <BenefitItem icon="heart" text="Plans that match your personality" />
        <BenefitItem icon="time" text="Recommendations for your schedule" />
        <BenefitItem icon="sparkles" text="Better suggestions over time" />
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

function PersonalityStep({
  question,
  value,
  onValueChange,
  onNext,
  onBack,
  currentIndex,
  totalQuestions,
}: {
  question: typeof PERSONALITY_QUESTIONS[0];
  value: number;
  onValueChange: (value: number) => void;
  onNext: () => void;
  onBack: () => void;
  currentIndex: number;
  totalQuestions: number;
}) {
  return (
    <OnboardingScreen
      title={question.title}
      subtitle={question.subtitle}
      footer={
        <View style={styles.footerButtons}>
          <AnimatedPressable onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.neutral[600]} />
          </AnimatedPressable>
          <View style={styles.nextButtonContainer}>
            <PremiumButton onPress={onNext} gradient size="lg">
              {currentIndex < totalQuestions - 1 ? 'Next' : 'Continue'}
            </PremiumButton>
          </View>
        </View>
      }
    >
      <View style={styles.personalityContent}>
        <OnboardingSlider
          value={value}
          onValueChange={onValueChange}
          leftLabel={question.leftLabel}
          rightLabel={question.rightLabel}
          leftEmoji={question.leftEmoji}
          rightEmoji={question.rightEmoji}
        />

        {/* Description cards */}
        <View style={styles.descriptionCards}>
          <View style={[styles.descriptionCard, value <= 5 && styles.descriptionCardActive]}>
            <Text style={styles.descriptionEmoji}>{question.leftEmoji}</Text>
            <Text style={styles.descriptionText}>{question.leftDesc}</Text>
          </View>
          <View style={[styles.descriptionCard, value > 5 && styles.descriptionCardActive]}>
            <Text style={styles.descriptionEmoji}>{question.rightEmoji}</Text>
            <Text style={styles.descriptionText}>{question.rightDesc}</Text>
          </View>
        </View>
      </View>
    </OnboardingScreen>
  );
}

function OptionStep({
  config,
  value,
  onSelect,
  onNext,
  onBack,
}: {
  config: typeof SOCIAL_OPTIONS.group_size;
  value: string;
  onSelect: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <OnboardingScreen
      title={config.title}
      subtitle={config.subtitle}
      footer={
        <View style={styles.footerButtons}>
          <AnimatedPressable onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.neutral[600]} />
          </AnimatedPressable>
          <View style={styles.nextButtonContainer}>
            <PremiumButton onPress={onNext} gradient size="lg" disabled={!value}>
              Continue
            </PremiumButton>
          </View>
        </View>
      }
    >
      <View style={styles.optionsContainer}>
        {config.options.map((option) => (
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
    </OnboardingScreen>
  );
}

function PracticalStep({
  budget,
  time,
  pace,
  onBudgetChange,
  onTimeChange,
  onPaceChange,
  onNext,
  onBack,
  isLoading,
}: {
  budget: string;
  time: string;
  pace: string;
  onBudgetChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onPaceChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  isLoading: boolean;
}) {
  const [section, setSection] = useState<'budget' | 'time' | 'pace'>('budget');

  const handleSectionNext = () => {
    if (section === 'budget') {
      setSection('time');
    } else if (section === 'time') {
      setSection('pace');
    } else {
      onNext();
    }
  };

  const handleSectionBack = () => {
    if (section === 'budget') {
      onBack();
    } else if (section === 'time') {
      setSection('budget');
    } else {
      setSection('time');
    }
  };

  const getCurrentConfig = () => {
    switch (section) {
      case 'budget':
        return { ...PRACTICAL_OPTIONS.budget, value: budget, onChange: onBudgetChange };
      case 'time':
        return { ...PRACTICAL_OPTIONS.time, value: time, onChange: onTimeChange };
      case 'pace':
        return { ...PRACTICAL_OPTIONS.pace, value: pace, onChange: onPaceChange };
    }
  };

  const config = getCurrentConfig();

  return (
    <OnboardingScreen
      title={config.title}
      subtitle={config.subtitle}
      footer={
        <View style={styles.footerButtons}>
          <AnimatedPressable onPress={handleSectionBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.neutral[600]} />
          </AnimatedPressable>
          <View style={styles.nextButtonContainer}>
            <PremiumButton
              onPress={handleSectionNext}
              gradient
              size="lg"
              loading={isLoading}
              disabled={!config.value}
            >
              {section === 'pace' ? 'Finish Setup' : 'Continue'}
            </PremiumButton>
          </View>
        </View>
      }
    >
      <View style={styles.optionsContainer}>
        {config.options.map((option) => (
          <OnboardingOption
            key={option.value}
            label={option.label}
            description={option.description}
            emoji={option.emoji}
            selected={config.value === option.value}
            onSelect={() => config.onChange(option.value)}
          />
        ))}
      </View>
    </OnboardingScreen>
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
        We'll use your preferences to create personalized plans just for you.
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

  // Personality step
  personalityContent: {
    flex: 1,
    justifyContent: 'center',
  },
  descriptionCards: {
    flexDirection: 'row',
    marginTop: spacing[8],
    gap: spacing[3],
  },
  descriptionCard: {
    flex: 1,
    padding: spacing[4],
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    opacity: 0.6,
  },
  descriptionCardActive: {
    backgroundColor: colors.primary[50],
    opacity: 1,
  },
  descriptionEmoji: {
    fontSize: 24,
    marginBottom: spacing[2],
  },
  descriptionText: {
    ...textPresets.bodySmall,
    textAlign: 'center',
    color: colors.neutral[600],
  },

  // Options step
  optionsContainer: {
    paddingTop: spacing[2],
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
