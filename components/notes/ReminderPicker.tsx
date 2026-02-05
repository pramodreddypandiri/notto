/**
 * ReminderPicker - Date/time picker for setting reminders
 *
 * Features:
 * - Quick select options (Today, Tomorrow, etc.)
 * - Custom date/time picker
 * - Dark mode support
 * - Animated modal
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AnimatedPressable from '../ui/AnimatedPressable';
import PremiumButton from '../ui/PremiumButton';
import { colors, typography, spacing, borderRadius, shadows, getThemedColors } from '../../theme';

interface ReminderPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectReminder: (date: Date) => void;
  themedColors: ReturnType<typeof getThemedColors>;
  initialDate?: Date;
  /** When true, renders as an overlay without its own Modal wrapper */
  inline?: boolean;
  /** When provided, shows "Set Reminder & Save" button that triggers this callback */
  onSaveWithReminder?: (date: Date) => void;
}

interface QuickOption {
  label: string;
  icon: string;
  getDate: () => Date;
}

export function ReminderPicker({
  visible,
  onClose,
  onSelectReminder,
  themedColors,
  initialDate,
  inline = false,
  onSaveWithReminder,
}: ReminderPickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate || new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  useEffect(() => {
    if (visible) {
      setSelectedDate(initialDate || getDefaultReminderTime());
    }
  }, [visible, initialDate]);

  const getDefaultReminderTime = (): Date => {
    const date = new Date();
    date.setHours(date.getHours() + 1);
    date.setMinutes(0, 0, 0);
    return date;
  };

  const quickOptions: QuickOption[] = [
    {
      label: 'In 1 hour',
      icon: 'time-outline',
      getDate: () => new Date(Date.now() + 60 * 60 * 1000),
    },
    {
      label: 'Today evening',
      icon: 'moon-outline',
      getDate: () => {
        const date = new Date();
        date.setHours(18, 0, 0, 0);
        if (date <= new Date()) {
          date.setDate(date.getDate() + 1);
        }
        return date;
      },
    },
    {
      label: 'Tomorrow morning',
      icon: 'sunny-outline',
      getDate: () => {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(9, 0, 0, 0);
        return date;
      },
    },
    {
      label: 'Tomorrow evening',
      icon: 'moon-outline',
      getDate: () => {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(18, 0, 0, 0);
        return date;
      },
    },
    {
      label: 'This weekend',
      icon: 'calendar-outline',
      getDate: () => {
        const date = new Date();
        const daysUntilSaturday = (6 - date.getDay() + 7) % 7 || 7;
        date.setDate(date.getDate() + daysUntilSaturday);
        date.setHours(10, 0, 0, 0);
        return date;
      },
    },
    {
      label: 'Next week',
      icon: 'calendar-outline',
      getDate: () => {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        date.setHours(9, 0, 0, 0);
        return date;
      },
    },
  ];

  const handleQuickSelect = (option: QuickOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const date = option.getDate();
    setSelectedDate(date);
  };

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (onSaveWithReminder) {
      // Combined save with reminder action
      onSaveWithReminder(selectedDate);
    } else {
      // onSelectReminder handles closing via parent state
      onSelectReminder(selectedDate);
    }
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }

    if (date) {
      const newDate = new Date(selectedDate);
      if (pickerMode === 'date') {
        newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      } else {
        newDate.setHours(date.getHours(), date.getMinutes());
      }
      setSelectedDate(newDate);
    }
  };

  const openDatePicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPickerMode('date');
    if (Platform.OS === 'android') {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(!showDatePicker);
      setShowTimePicker(false);
    }
  };

  const openTimePicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPickerMode('time');
    if (Platform.OS === 'android') {
      setShowTimePicker(true);
    } else {
      setShowTimePicker(!showTimePicker);
      setShowDatePicker(false);
    }
  };

  const formatDate = (date: Date): string => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (!visible) return null;

  const pickerContent = (
    <>
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={styles.backdrop}
      >
        <AnimatedPressable
          onPress={onClose}
          style={StyleSheet.absoluteFill}
          hapticType="light"
        >
          <View style={StyleSheet.absoluteFill} />
        </AnimatedPressable>
      </Animated.View>

      {/* Content */}
      <Animated.View
        entering={SlideInDown.duration(300).damping(0.9)}
        exiting={SlideOutDown.duration(200)}
        style={[
          styles.content,
          { backgroundColor: themedColors.surface.primary },
        ]}
      >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: themedColors.text.primary }]}>
              Set Reminder
            </Text>
            <AnimatedPressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: themedColors.surface.secondary }]}
              hapticType="light"
            >
              <Ionicons name="close" size={20} color={themedColors.text.tertiary} />
            </AnimatedPressable>
          </View>

          {/* Quick Options */}
          <View style={styles.quickOptionsContainer}>
            <Text style={[styles.sectionLabel, { color: themedColors.text.tertiary }]}>
              Quick select
            </Text>
            <View style={styles.quickOptions}>
              {quickOptions.map((option, index) => (
                <AnimatedPressable
                  key={option.label}
                  onPress={() => handleQuickSelect(option)}
                  style={[
                    styles.quickOption,
                    { backgroundColor: themedColors.surface.secondary },
                  ]}
                  hapticType="light"
                >
                  <Ionicons
                    name={option.icon as any}
                    size={16}
                    color={colors.primary[500]}
                  />
                  <Text style={[styles.quickOptionText, { color: themedColors.text.primary }]}>
                    {option.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>
          </View>

          {/* Custom Date/Time Selection */}
          <View style={styles.customSection}>
            <Text style={[styles.sectionLabel, { color: themedColors.text.tertiary }]}>
              Or pick custom time
            </Text>

            <View style={styles.dateTimeRow}>
              <AnimatedPressable
                onPress={openDatePicker}
                style={[
                  styles.dateTimeButton,
                  showDatePicker && styles.dateTimeButtonActive,
                  { backgroundColor: themedColors.surface.secondary },
                ]}
                hapticType="light"
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={showDatePicker ? colors.primary[500] : themedColors.text.secondary}
                />
                <Text
                  style={[
                    styles.dateTimeText,
                    { color: showDatePicker ? colors.primary[500] : themedColors.text.primary },
                  ]}
                >
                  {formatDate(selectedDate)}
                </Text>
              </AnimatedPressable>

              <AnimatedPressable
                onPress={openTimePicker}
                style={[
                  styles.dateTimeButton,
                  showTimePicker && styles.dateTimeButtonActive,
                  { backgroundColor: themedColors.surface.secondary },
                ]}
                hapticType="light"
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={showTimePicker ? colors.primary[500] : themedColors.text.secondary}
                />
                <Text
                  style={[
                    styles.dateTimeText,
                    { color: showTimePicker ? colors.primary[500] : themedColors.text.primary },
                  ]}
                >
                  {formatTime(selectedDate)}
                </Text>
              </AnimatedPressable>
            </View>

            {/* iOS Inline Picker */}
            {Platform.OS === 'ios' && (showDatePicker || showTimePicker) && (
              <View style={styles.inlinePicker}>
                <DateTimePicker
                  value={selectedDate}
                  mode={showDatePicker ? 'date' : 'time'}
                  display="spinner"
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                  themeVariant={themedColors.background.primary === colors.backgroundDark.primary ? 'dark' : 'light'}
                />
              </View>
            )}

            {/* Android Picker Modal */}
            {Platform.OS === 'android' && showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}

            {Platform.OS === 'android' && showTimePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="time"
                display="default"
                onChange={handleDateChange}
              />
            )}
          </View>

          {/* Selected Time Display */}
          <View style={[styles.selectedTimeDisplay, { backgroundColor: colors.primary[50] }]}>
            <Ionicons name="notifications" size={20} color={colors.primary[500]} />
            <Text style={styles.selectedTimeText}>
              Reminder: {formatDate(selectedDate)} at {formatTime(selectedDate)}
            </Text>
          </View>

          {/* Confirm Button */}
          <View style={styles.confirmButton}>
            <PremiumButton
              onPress={handleConfirm}
              gradient
              fullWidth
              icon={<Ionicons name="checkmark" size={20} color={colors.neutral[0]} />}
            >
              {onSaveWithReminder ? 'Set Reminder & Save' : 'Set Reminder'}
            </PremiumButton>
          </View>
        </Animated.View>
    </>
  );

  // When inline, render without Modal wrapper
  if (inline) {
    return (
      <View style={styles.modalContainer}>
        {pickerContent}
      </View>
    );
  }

  // Standard modal rendering
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {pickerContent}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background.overlayDark,
  },
  content: {
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    padding: spacing[5],
    paddingBottom: spacing[8],
    maxHeight: '85%',
    ...shadows.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickOptionsContainer: {
    marginBottom: spacing[5],
  },
  quickOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  quickOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.full,
  },
  quickOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  customSection: {
    marginBottom: spacing[5],
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dateTimeButtonActive: {
    borderColor: colors.primary[500],
  },
  dateTimeText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  inlinePicker: {
    marginTop: spacing[3],
  },
  selectedTimeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[5],
  },
  selectedTimeText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
    flex: 1,
  },
  confirmButton: {
    marginTop: 'auto',
  },
});

export default ReminderPicker;
