/**
 * OnboardingTimePicker - Custom time selection for onboarding
 *
 * Fully custom UI with large, always-visible numbers.
 * Avoids native spinner rendering issues where numbers
 * can be invisible due to theme/platform conflicts.
 */

import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface OnboardingTimePickerProps {
  label: string;
  value: string | null; // HH:mm 24-hour format
  onChange: (time: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const snapMinute = (m: number): number => {
  const snapped = Math.round(m / 5) * 5;
  return snapped >= 60 ? 0 : snapped;
};

const parseTime = (timeStr: string | null): { hour: number; minute: number; period: 'AM' | 'PM' } => {
  if (!timeStr) return { hour: 7, minute: 0, period: 'AM' };
  const [h, m] = timeStr.split(':').map(Number);
  return {
    hour: h % 12 || 12,
    minute: snapMinute(m),
    period: h >= 12 ? 'PM' : 'AM',
  };
};

const buildTimeString = (hour: number, minute: number, period: 'AM' | 'PM'): string => {
  let h24 = hour % 12;
  if (period === 'PM') h24 += 12;
  return `${h24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

export function OnboardingTimePicker({
  label,
  value,
  onChange,
  icon = 'time-outline',
}: OnboardingTimePickerProps) {
  const { hour: initH, minute: initM, period: initP } = parseTime(value);
  const [hour, setHour] = useState(initH);
  const [minute, setMinute] = useState(initM);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initP);
  const initialEmitted = useRef(false);

  // Auto-select a default time on first render so Continue is enabled
  useEffect(() => {
    if (!value && !initialEmitted.current) {
      initialEmitted.current = true;
      onChange(buildTimeString(initH, initM, initP));
    }
  }, []);

  const emit = (h: number, m: number, p: 'AM' | 'PM') => {
    onChange(buildTimeString(h, m, p));
  };

  const stepHour = (dir: 1 | -1) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const idx = HOURS.indexOf(hour);
    const next = HOURS[(idx + dir + HOURS.length) % HOURS.length];
    setHour(next);
    emit(next, minute, period);
  };

  const stepMinute = (dir: 1 | -1) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const idx = MINUTES.indexOf(minute);
    const safeIdx = idx >= 0 ? idx : 0;
    const next = MINUTES[(safeIdx + dir + MINUTES.length) % MINUTES.length];
    setMinute(next);
    emit(hour, next, period);
  };

  const selectPeriod = (p: 'AM' | 'PM') => {
    if (p === period) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPeriod(p);
    emit(hour, minute, p);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.card}>
        {/* Hour column */}
        <View style={styles.column}>
          <Pressable onPress={() => stepHour(1)} style={styles.arrowBtn} hitSlop={12}>
            <Ionicons name="chevron-up" size={26} color={colors.primary[500]} />
          </Pressable>

          <View style={styles.numBox}>
            <Text style={styles.numText}>{hour.toString().padStart(2, '0')}</Text>
          </View>

          <Pressable onPress={() => stepHour(-1)} style={styles.arrowBtn} hitSlop={12}>
            <Ionicons name="chevron-down" size={26} color={colors.primary[500]} />
          </Pressable>
        </View>

        <Text style={styles.colon}>:</Text>

        {/* Minute column */}
        <View style={styles.column}>
          <Pressable onPress={() => stepMinute(1)} style={styles.arrowBtn} hitSlop={12}>
            <Ionicons name="chevron-up" size={26} color={colors.primary[500]} />
          </Pressable>

          <View style={styles.numBox}>
            <Text style={styles.numText}>{minute.toString().padStart(2, '0')}</Text>
          </View>

          <Pressable onPress={() => stepMinute(-1)} style={styles.arrowBtn} hitSlop={12}>
            <Ionicons name="chevron-down" size={26} color={colors.primary[500]} />
          </Pressable>
        </View>

        {/* AM / PM toggle */}
        <View style={styles.periodCol}>
          <Pressable
            onPress={() => selectPeriod('AM')}
            style={[styles.periodBtn, period === 'AM' && styles.periodBtnActive]}
          >
            <Text style={[styles.periodText, period === 'AM' && styles.periodTextActive]}>AM</Text>
          </Pressable>

          <Pressable
            onPress={() => selectPeriod('PM')}
            style={[styles.periodBtn, period === 'PM' && styles.periodBtnActive]}
          >
            <Text style={[styles.periodText, period === 'PM' && styles.periodTextActive]}>PM</Text>
          </Pressable>
        </View>
      </View>

      {/* Friendly sub-label */}
      <View style={styles.hint}>
        <Ionicons name={icon} size={14} color={colors.neutral[400]} />
        <Text style={styles.hintText}>Tap the arrows to adjust</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing[4],
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[600],
    marginBottom: spacing[3],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[6],
    gap: spacing[3],
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  column: {
    alignItems: 'center',
    gap: spacing[2],
  },
  arrowBtn: {
    padding: spacing[2],
    borderRadius: borderRadius.md,
  },
  numBox: {
    width: 76,
    height: 76,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary[200],
  },
  numText: {
    fontSize: 38,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
    letterSpacing: -1,
  },
  colon: {
    fontSize: 38,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[300],
    marginBottom: 4,
  },
  periodCol: {
    gap: spacing[2],
    marginLeft: spacing[1],
  },
  periodBtn: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[50],
    minWidth: 52,
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  periodText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[500],
  },
  periodTextActive: {
    color: colors.neutral[0],
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[2],
    paddingLeft: spacing[1],
  },
  hintText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
  },
});

export default OnboardingTimePicker;
