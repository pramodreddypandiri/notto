/**
 * NoteInputBar - WhatsApp-style input bar with text input and hold-to-record mic
 *
 * Features:
 * - Text input on the left, mic button on the right
 * - Hold microphone to record (like WhatsApp)
 * - Send button appears when text is entered
 * - Positioned above tabs, not overlapping
 * - Dark mode support
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Platform,
  Keyboard,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
  Easing,
  interpolateColor,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius, shadows, layout, animation, getThemedColors } from '../../theme';

interface NoteInputBarProps {
  onSendText: (text: string) => void;
  onRecordingStart: () => void;
  onRecordingEnd: () => void;
  onRecordingCancel: () => void;
  isRecording: boolean;
  recordingDuration: number;
  themedColors: ReturnType<typeof getThemedColors>;
  disabled?: boolean;
}

export function NoteInputBar({
  onSendText,
  onRecordingStart,
  onRecordingEnd,
  onRecordingCancel,
  isRecording,
  recordingDuration,
  themedColors,
  disabled = false,
}: NoteInputBarProps) {
  const [text, setText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Animation values
  const micScale = useSharedValue(1);
  const micColorProgress = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);
  const sendButtonScale = useSharedValue(0);
  const recordingIndicatorOpacity = useSharedValue(0);
  const slideX = useSharedValue(0);

  // Keyboard listeners
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Show/hide send button based on text
  useEffect(() => {
    if (text.trim().length > 0) {
      sendButtonScale.value = withSpring(1, animation.spring.snappy);
    } else {
      sendButtonScale.value = withSpring(0, animation.spring.snappy);
    }
  }, [text]);

  // Recording animation
  useEffect(() => {
    if (isRecording) {
      micColorProgress.value = withTiming(1, { duration: 200 });
      recordingIndicatorOpacity.value = withTiming(1, { duration: 200 });

      // Pulsing effect
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) })
        ),
        -1,
        true
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 600 }),
          withTiming(0.2, { duration: 600 })
        ),
        -1,
        true
      );
    } else {
      micColorProgress.value = withTiming(0, { duration: 200 });
      recordingIndicatorOpacity.value = withTiming(0, { duration: 200 });
      pulseScale.value = withTiming(1, { duration: 200 });
      pulseOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendText = () => {
    if (text.trim().length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSendText(text.trim());
      setText('');
      Keyboard.dismiss();
    }
  };

  // Long press gesture for recording
  const longPressGesture = Gesture.LongPress()
    .minDuration(200)
    .enabled(!disabled && text.trim().length === 0)
    .onStart(() => {
      'worklet';
      micScale.value = withSpring(1.2, animation.spring.snappy);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
      runOnJS(onRecordingStart)();
    })
    .onEnd(() => {
      'worklet';
      micScale.value = withSpring(1, animation.spring.snappy);
      runOnJS(onRecordingEnd)();
    });

  // Pan gesture for cancel (slide left to cancel like WhatsApp)
  const panGesture = Gesture.Pan()
    .enabled(isRecording)
    .onUpdate((event) => {
      'worklet';
      if (event.translationX < 0) {
        slideX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      'worklet';
      if (event.translationX < -100) {
        // Cancel recording
        runOnJS(onRecordingCancel)();
        runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Warning);
      }
      slideX.value = withSpring(0, animation.spring.snappy);
    });

  const composedGesture = Gesture.Simultaneous(longPressGesture, panGesture);

  // Animated styles
  const animatedMicStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
    backgroundColor: interpolateColor(
      micColorProgress.value,
      [0, 1],
      [colors.primary[500], colors.semantic.error]
    ),
  }));

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
    backgroundColor: colors.semantic.error,
  }));

  const animatedSendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
    opacity: sendButtonScale.value,
  }));

  const animatedRecordingStyle = useAnimatedStyle(() => ({
    opacity: recordingIndicatorOpacity.value,
    transform: [{ translateX: slideX.value }],
  }));

  const showSendButton = text.trim().length > 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themedColors.background.primary,
          borderTopColor: themedColors.surface.border,
          marginBottom: keyboardHeight > 0 ? keyboardHeight - layout.tabBarHeight : 0,
        },
      ]}
    >
      {isRecording ? (
        // Recording mode
        <Animated.View style={[styles.recordingContainer, animatedRecordingStyle]}>
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Animated.Text style={[styles.recordingTime, { color: themedColors.text.primary }]}>
              {formatDuration(recordingDuration)}
            </Animated.Text>
          </View>

          <View style={styles.slideHint}>
            <Ionicons name="chevron-back" size={16} color={themedColors.text.tertiary} />
            <Animated.Text style={[styles.slideHintText, { color: themedColors.text.tertiary }]}>
              Slide to cancel
            </Animated.Text>
          </View>
        </Animated.View>
      ) : (
        // Text input mode
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: themedColors.input.background,
              borderColor: themedColors.input.border,
            },
          ]}
        >
          <TextInput
            style={[styles.textInput, { color: themedColors.text.primary }]}
            placeholder="Type a note..."
            placeholderTextColor={themedColors.input.placeholder}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            editable={!disabled}
          />
        </View>
      )}

      {/* Action button (Send or Mic) */}
      <View style={styles.actionButtonContainer}>
        {showSendButton && !isRecording ? (
          // Send button
          <Animated.View style={animatedSendStyle}>
            <GestureDetector
              gesture={Gesture.Tap().onEnd(() => {
                'worklet';
                runOnJS(handleSendText)();
              })}
            >
              <View style={[styles.actionButton, { backgroundColor: colors.primary[500] }]}>
                <Ionicons name="send" size={20} color={colors.neutral[0]} />
              </View>
            </GestureDetector>
          </Animated.View>
        ) : (
          // Mic button with long press
          <GestureDetector gesture={composedGesture}>
            <View style={styles.micWrapper}>
              {/* Pulse ring */}
              <Animated.View style={[styles.pulseRing, animatedPulseStyle]} />

              {/* Mic button */}
              <Animated.View style={[styles.actionButton, animatedMicStyle]}>
                <Ionicons
                  name={isRecording ? 'mic' : 'mic-outline'}
                  size={22}
                  color={colors.neutral[0]}
                />
              </Animated.View>
            </View>
          </GestureDetector>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    paddingBottom: spacing[3],
    borderTopWidth: 1,
    gap: spacing[2],
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    minHeight: 44,
    maxHeight: 100,
  },
  textInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * 1.4,
    paddingTop: Platform.OS === 'ios' ? spacing[1] : 0,
    paddingBottom: Platform.OS === 'ios' ? spacing[1] : 0,
  },
  actionButtonContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    height: 44,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.semantic.error,
  },
  recordingTime: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  slideHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  slideHintText: {
    fontSize: typography.fontSize.sm,
  },
});

export default NoteInputBar;
