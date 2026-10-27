import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionRouting } from 'expo-quick-actions/router';

/**
 * The app icon's quick actions (press and hold it): scan receipts, bring in a bill, this month's
 * plan. Set while signed in, from the tabs' layout, and cleared on sign-out. The module does
 * nothing where its native part is missing (builds from before phase 5, the web preview).
 */
const ACTIONS: QuickActions.Action[] = [
  { id: 'scan', title: 'Scan receipts', icon: Platform.OS === 'ios' ? 'symbol:doc.viewfinder' : null, params: { href: '/capture' } },
  { id: 'bill', title: 'Bring in a bill', icon: Platform.OS === 'ios' ? 'symbol:doc.text' : null, params: { href: '/capture?mode=bill' } },
  { id: 'plan', title: "This month's plan", icon: Platform.OS === 'ios' ? 'symbol:calendar' : null, params: { href: '/plan' } },
];

export function useQuickActions() {
  useQuickActionRouting();
  useEffect(() => {
    void QuickActions.setItems(ACTIONS).catch(() => undefined);
  }, []);
}

export function clearQuickActions() {
  void QuickActions.setItems([]).catch(() => undefined);
}
