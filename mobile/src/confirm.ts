import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { requestChoice } from './ui/ChooseHost';

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
 * A menu of actions or choices: the native action sheet on iOS, and on Android and the web build a
 * sheet from the bottom (src/ui/ChooseHost.tsx: an Android alert holds only three buttons).
 * Resolves the chosen index, or null for Cancel.
 */
export function choose(title: string, choices: Choice[]): Promise<number | null> {
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

  return requestChoice(title, choices);
}
