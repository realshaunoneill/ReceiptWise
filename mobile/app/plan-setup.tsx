import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/contexts/ThemeContext';
import { useMe } from '../src/hooks/useMe';
import PlanSetup from '../src/plan/PlanSetup';
import { useScope } from '../src/scope';
import { GUTTER, readableColumn, space } from '../src/theme';

/** "Set up your plan", from the Plan's "Start with your pay": the guided setup on its own. */
export default function PlanSetupScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const me = useMe();
  const { householdId } = useScope();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ ...readableColumn, paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: GUTTER }}>
        <PlanSetup currency={me.data?.currency ?? 'EUR'} householdId={householdId} onDone={() => navigation.goBack()} onSkip={() => navigation.goBack()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
