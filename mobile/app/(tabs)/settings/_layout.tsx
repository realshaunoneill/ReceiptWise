import React from 'react';
import { Stack } from 'expo-router';
import { useStackOptions } from '../../../src/ui/stack';

export default function SettingsStack() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="households/index" options={{ title: 'Households' }} />
      <Stack.Screen name="households/[id]" options={{ title: '' }} />
      <Stack.Screen name="forwarding" options={{ title: 'Email forwarding' }} />
      <Stack.Screen name="sign-in-methods" options={{ title: 'Sign-in methods' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="subscription" options={{ title: 'Premium' }} />

      {/* Privacy and security (phase 5) */}
      <Stack.Screen name="privacy" options={{ title: 'Privacy & security' }} />
    </Stack>
  );
}
