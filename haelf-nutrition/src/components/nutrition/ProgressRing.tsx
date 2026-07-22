import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '@/src/theme';
import { clampProgress } from '@/src/domain/progress';
import { useApp } from '@/src/context/AppContext';

type ProgressRingProps = {
  size: number;
  strokeWidth: number;
  progress: number;
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
  accessibilityLabel?: string;
};

export function ProgressRing({
  size,
  strokeWidth,
  progress,
  color,
  trackColor = theme.colors.ringTrack,
  children,
  accessibilityLabel,
}: ProgressRingProps) {
  const p = clampProgress(progress);
  const a11yPct = Math.round(Math.max(0, progress) * 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const anim = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  // Drive SVG via number state — Animated.createAnimatedComponent(Circle) leaks
  // RN props like collapsable={false} onto DOM <circle> on web.
  const [dashOffset, setDashOffset] = useState(circumference);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const id = anim.addListener(({ value }) => {
      setDashOffset(circumference * (1 - value));
    });
    return () => anim.removeListener(id);
  }, [anim, circumference]);

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(p);
      return;
    }
    Animated.timing(anim, {
      toValue: p,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [p, anim, reduceMotion]);

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel={accessibilityLabel}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'progressbar' : undefined}
      accessibilityValue={
        accessibilityLabel
          ? {
              min: 0,
              max: Math.max(100, a11yPct),
              now: a11yPct,
              text: accessibilityLabel,
            }
          : undefined
      }
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[styles.center, styles.centerPassThrough]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPassThrough: {
    pointerEvents: 'none',
  },
});

export function MacroMiniRing({
  label,
  consumed,
  goal,
  color,
}: {
  label: string;
  consumed: number;
  goal: number | null;
  color: string;
}) {
  const { t } = useApp();
  const hasGoal = goal != null && goal > 0;
  const progress = hasGoal ? consumed / goal! : 0;
  const pct = hasGoal ? Math.round(Math.max(progress, 0) * 100) : 0;
  const a11y = hasGoal
    ? t('accessibility.macroGoal', {
        label,
        percentage: pct,
        consumed,
        goal: goal!,
      })
    : t('accessibility.macroNoGoal', { label, consumed });

  return (
    <View style={mini.wrap}>
      <ProgressRing
        size={theme.ring.macroSize}
        strokeWidth={theme.ring.macroStroke}
        progress={hasGoal ? progress : 0}
        color={color}
        accessibilityLabel={a11y}
      >
        <Text style={[mini.pct, { color }]}>{hasGoal ? `${pct}%` : '—'}</Text>
      </ProgressRing>
      <Text style={mini.label}>{label}</Text>
      <Text style={mini.values}>
        {consumed}
        {hasGoal ? ` / ${goal}` : ''} g
      </Text>
    </View>
  );
}

const mini = StyleSheet.create({
  wrap: { alignItems: 'center', flex: 1 },
  pct: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  label: {
    marginTop: 6,
    fontSize: theme.font.macroLabel,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  values: {
    marginTop: 2,
    fontSize: theme.font.bodySmall,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
});
