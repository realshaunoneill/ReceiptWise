import { ActionSheetIOS, Alert, Platform } from 'react-native';

/**
 * Asks before something that can't be undone. Alert does nothing on the web
 * build (which is how the screens get checked without a device), so that
 * falls back to the browser's own dialog.
 */
export function confirm(title: string, message: string, action: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: action, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export interface Choice {
  label: string;
  destructive?: boolean;
}

/**
 * A short menu of actions: the native action sheet on iOS, an alert's buttons
 * on Android (which fit two and Cancel), a numbered prompt on the web build.
 * Resolves the chosen index, or null for Cancel.
 */
export function choose(title: string, choices: Choice[]): Promise<number | null> {
  if (Platform.OS === 'web') {
    const answer = window.prompt(`${title}\n\n${choices.map((c, i) => `${i + 1}. ${c.label}`).join('\n')}`);
    const index = Number(answer) - 1;

    return Promise.resolve(Number.isInteger(index) && index >= 0 && index < choices.length ? index : null);
  }

  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      ActionSheetIOS.showActionSheetWithOptions({
        title,
        options: [...choices.map((c) => c.label), 'Cancel'],
        cancelButtonIndex: choices.length,
        destructiveButtonIndex: choices.flatMap((c, i) => (c.destructive ? [i] : [])),
      }, (index) => resolve(index === choices.length ? null : index));
    });
  }

  return new Promise((resolve) => {
    Alert.alert(title, undefined, [
      ...choices.map((c, i) => ({ text: c.label, style: c.destructive ? 'destructive' as const : 'default' as const, onPress: () => resolve(i) })),
      { text: 'Cancel', style: 'cancel' as const, onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}
