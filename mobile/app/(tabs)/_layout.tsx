import React from 'react';
import { NativeTabs } from 'expo-router/native-tabs';
import { useTheme } from '../../src/contexts/ThemeContext';

/**
 * The system tab bar: Liquid Glass on iOS 26, Material on Android, with SF Symbols and Material
 * icons so each platform looks like itself. Each tab has its own stack, so a receipt opened from
 * Receipts keeps the bar under it, and each keeps its place when you switch away.
 *
 * Capturing a receipt is an action, not a place, so it's a button on Home and Receipts (and the
 * share sheet, the widget and the app icon's quick actions), not a tab.
 */
export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <NativeTabs tintColor={colors.accent}>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="receipts">
        <NativeTabs.Trigger.Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} md="receipt_long" />
        <NativeTabs.Trigger.Label>Receipts</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} md="calendar_month" />
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bills">
        <NativeTabs.Trigger.Icon sf={{ default: 'arrow.triangle.2.circlepath', selected: 'arrow.triangle.2.circlepath' }} md="autorenew" />
        <NativeTabs.Trigger.Label>Bills</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
