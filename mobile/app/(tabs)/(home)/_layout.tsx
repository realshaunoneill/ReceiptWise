import React from 'react';
import { Stack } from 'expo-router';
import { useStackOptions } from '../../../src/ui/stack';

export default function HomeStack() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'Home' }} />
      <Stack.Screen name="insights" options={{ title: 'Insights' }} />
      <Stack.Screen name="items/[name]" options={{ title: '', headerLargeTitle: false }} />
    </Stack>
  );
}
