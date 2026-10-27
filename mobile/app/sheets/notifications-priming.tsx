import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from 'expo-router';
import { Bell, CalendarClock, ReceiptText } from 'lucide-react-native';
import { useTheme } from '../../src/contexts/ThemeContext';
import { markPushOffered, registerPush } from '../../src/push/push';
import { space } from '../../src/theme';
import Button, { success } from '../../src/ui/Button';
import SheetScreen from '../../src/ui/Sheet';
import Text from '../../src/ui/Text';

/**
 * Asked once, after the first capture, before the system's own prompt (which can only be shown
 * once): what notifications are for, so the answer is an informed one. Settings › Notifications
 * can turn them on later.
 */
export default function NotificationsPriming() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    void markPushOffered();
  }, []);

  const points = [
    { icon: ReceiptText, text: "When a receipt you've added has been read, so you don't have to wait for it" },
    { icon: CalendarClock, text: 'A bill you pay by hand the day before it\'s due, and payday with the new month\'s figures' },
    { icon: Bell, text: 'Nothing between 21:30 and 08:00 unless you just did it yourself. Choose which in Settings.' },
  ];

  return (
    <SheetScreen title="Notifications" closeLabel="Not now">
      <Text variant="title" accessibilityRole="header">Hear when it's done</Text>
      <View style={{ gap: space.lg }}>
        {points.map(({ icon: Icon, text }) => (
          <View key={text} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
            <Icon size={22} color={colors.accent} />
            <Text variant="callout" ink="secondary" style={{ flex: 1 }}>{text}</Text>
          </View>
        ))}
      </View>
      <Button
        label="Turn on notifications"
        loading={asking}
        onPress={async () => {
          setAsking(true);
          try {
            if ((await registerPush({ ask: true })) === 'granted') success();
          } finally {
            setAsking(false);
            navigation.goBack();
          }
        }}
      />
    </SheetScreen>
  );
}
