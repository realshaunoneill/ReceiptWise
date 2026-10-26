import React from 'react';
import { Stack } from 'expo-router';
import { useStackOptions } from '../../../src/ui/stack';

export default function ReceiptsStack() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'Receipts' }} />
      <Stack.Screen name="[id]" options={{ title: '', headerLargeTitle: false }} />
    </Stack>
  );
}
