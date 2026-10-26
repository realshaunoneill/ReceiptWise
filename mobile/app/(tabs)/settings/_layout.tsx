import React from 'react';
import { Stack } from 'expo-router';
import { useStackOptions } from '../../../src/ui/stack';

export default function SettingsStack() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
    </Stack>
  );
}
