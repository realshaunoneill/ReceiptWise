import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View, type DimensionValue, type ViewStyle } from 'react-native';
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { GUTTER, radius, space, toneColors, type Tone } from '../theme';
import Button from './Button';
import Text from './Text';

/** A short status word: Read, Being read, Couldn't read, Shared, Overdue. */
export function Pill({ label, tone }: { label: string; tone: Tone }) {
  const { colors } = useTheme();
  const { ink, soft } = toneColors(colors, tone);
  return (
    <View style={{ backgroundColor: soft, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text variant="caption" style={{ color: ink }}>{label}</Text>
    </View>
  );
}

const NOTICE_ICON = { good: CircleCheck, warn: TriangleAlert, bad: CircleAlert, neutral: Info };

/** A callout for something to act on: tinted, the title in the status colour, the body in plain ink. */
export function Notice({ tone, title, children, style }: { tone: Tone; title: string; children?: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  const { ink, soft } = toneColors(colors, tone);
  const Icon = NOTICE_ICON[tone];
  return (
    // No alert role: most notices are there when the screen opens, and an alert would be announced
    // over whatever VoiceOver was reading.
    <View style={[{ flexDirection: 'row', gap: space.md, backgroundColor: soft, borderRadius: radius.lg, padding: 14 }, style]}>
      <Icon size={20} color={ink} strokeWidth={2.1} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="label" style={{ color: ink }}>{title}</Text>
        {typeof children === 'string' ? <Text variant="footnote" ink="secondary">{children}</Text> : children}
      </View>
    </View>
  );
}

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** A placeholder block that pulses gently, or holds still under Reduce Motion. */
export function Skeleton({ width = '100%', height = 14, round = 6, style }: { width?: DimensionValue; height?: number; round?: number; style?: ViewStyle }) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) {
      opacity.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce, opacity]);
  return <Animated.View style={[{ width, height, borderRadius: round, backgroundColor: colors.skeleton, opacity }, style]} />;
}

/** One sentence and one action, with the icon on a soft green at most (DESIGN.md). */
export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: { label: string; onPress: () => void } }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: GUTTER + space.xl, paddingVertical: space.xxxl, gap: space.md }}>
      <View style={{ width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={24} color={colors.accent} strokeWidth={2} />
      </View>
      <Text variant="heading" align="center">{title}</Text>
      <Text variant="callout" ink="secondary" align="center">{body}</Text>
      {action && <Button label={action.label} onPress={action.onPress} style={{ alignSelf: 'stretch', marginTop: space.sm }} />}
    </View>
  );
}

/** The screen's own error, with a way to try again. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingVertical: space.xxxl, gap: space.lg }}>
      <Notice tone="bad" title="That didn't load">{message}</Notice>
      <Button label="Try again" variant="secondary" onPress={onRetry} />
    </View>
  );
}
