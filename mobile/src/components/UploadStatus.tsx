import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { CloudOff, RotateCcw } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { GUTTER, radius, space } from '../theme';
import Button from '../ui/Button';
import Text from '../ui/Text';
import { retry } from '../upload/runner';
import { useUploadQueue } from '../upload/useUploadQueue';

/** "Uploading 2 of 5", "3 receipts waiting for a connection", or "1 receipt didn't upload · Retry". */
export default function UploadStatus() {
  const { colors } = useTheme();
  const { items, online, summary } = useUploadQueue();
  if (!summary) return null;
  const failed = items.filter((item) => item.status === 'failed');
  const pending = items.some((item) => item.status === 'waiting' || item.status === 'uploading');
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ marginHorizontal: GUTTER, marginBottom: space.lg, padding: space.md, borderRadius: radius.lg, backgroundColor: failed.length && !pending ? colors.badSoft : colors.card, flexDirection: 'row', alignItems: 'center', gap: space.md }}
    >
      {pending ? (online ? <ActivityIndicator color={colors.textMuted} /> : <CloudOff size={18} color={colors.textMuted} />) : <RotateCcw size={18} color={colors.bad} />}
      <View style={{ flex: 1 }}>
        <Text variant="callout">{summary}</Text>
        {!pending && failed[0]?.error && <Text variant="footnote" ink="muted" numberOfLines={2}>{failed[0].error}</Text>}
      </View>
      {!pending && failed.length > 0 && <Button label="Retry" size="sm" variant="secondary" onPress={() => failed.forEach((item) => retry(item.id))} />}
    </View>
  );
}
