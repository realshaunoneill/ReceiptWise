import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import { space } from '../theme';
import { selectionTick } from './Button';
import Text from './Text';

type Bar = { key: string; label: string; amount: number };

/**
 * One series of bars: a single hue, rounded only at the data end and anchored to the baseline,
 * 2 pt apart, axis labels in muted ink. Tapping a bar shows its figure above the chart (the
 * website's tooltip); the latest bar is shown until then. Screen readers get `summary`, a
 * sentence saying what the chart shows, instead of the shapes.
 */
export default function BarChart({ bars, format, summary, height = 120 }: { bars: Bar[]; format: (amount: number) => string; summary: string; height?: number }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const max = Math.max(...bars.map((bar) => bar.amount), 0);
  const shown = bars.find((bar) => bar.key === picked) ?? bars[bars.length - 1];
  const gap = 2;
  const barWidth = bars.length ? Math.max(2, (width - gap * (bars.length - 1)) / bars.length) : 0;

  const path = (x: number, h: number) => {
    // Rounded top corners (4 pt, less on a short bar), square at the baseline.
    const r = Math.min(4, barWidth / 2, h);
    const top = height - h;
    return `M${x},${height} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + barWidth - r},${top} Q${x + barWidth},${top} ${x + barWidth},${top + r} L${x + barWidth},${height} Z`;
  };

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={{ gap: space.sm }}>
      {!!shown && (
        <Text variant="footnote" ink="muted" tabular importantForAccessibility="no">
          {`${shown.label} · ${format(shown.amount)}`}
        </Text>
      )}
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {/* The baseline. */}
            <Path d={`M0,${height - 0.5} L${width},${height - 0.5}`} stroke={colors.border} strokeWidth={1} />
            {bars.map((bar, index) => {
              const h = max > 0 ? Math.max(bar.amount > 0 ? 2 : 0, (bar.amount / max) * (height - 4)) : 0;
              const x = index * (barWidth + gap);
              return h > 0 ? <Path key={bar.key} d={path(x, h)} fill={bar.key === shown?.key ? colors.accent : colors.chart} opacity={bar.key === shown?.key ? 1 : 0.55} /> : null;
            })}
          </Svg>
        )}
        {/* Tap targets the full height of the chart, wider than the bars. */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }} importantForAccessibility="no-hide-descendants">
          {bars.map((bar) => (
            <Pressable
              key={bar.key}
              style={{ flex: 1 }}
              onPress={() => {
                selectionTick();
                setPicked(bar.key);
              }}
            />
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants">
        {bars.map((bar, index) => (
          // Every label when there's room; otherwise the first, the last and every third.
          <Text key={bar.key} variant="caption" ink="muted" align="center" numberOfLines={1} style={{ flex: 1 }}>
            {bars.length <= 8 || index % 3 === 0 || index === bars.length - 1 ? bar.label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}
