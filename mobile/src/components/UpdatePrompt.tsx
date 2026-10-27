import React, { useEffect } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshCw } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { radius, space } from '../theme';
import Text from '../ui/Text';

/**
 * Updates sent with `eas update` (JS-only changes, no new build). The app checks as it opens (the
 * library's own check) and whenever it comes back to the front, downloads in the background, and
 * then offers a restart: it never reloads by itself, which would drop whatever is on screen.
 * Development builds and Expo Go have updates turned off, so this does nothing there.
 */
export default function UpdatePrompt() {
  return Updates ? <Prompt updates={Updates} /> : null;
}

/**
 * Required only where it exists: a build made before expo-updates was added hasn't got its native
 * module, and importing it there crashed the app at launch. The web preview has its own version.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Updates = Platform.OS === 'web' || requireOptionalNativeModule('ExpoUpdates') ? (require('expo-updates') as typeof import('expo-updates')) : null;

function Prompt({ updates: Updates }: { updates: typeof import('expo-updates') }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      // A failed check (no signal) is fine: the next one tries again.
      Updates.checkForUpdateAsync()
        .then((result) => (result.isAvailable ? Updates.fetchUpdateAsync() : undefined))
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  if (!isUpdatePending) return null;
  return (
    // Above the tab bar, out of the way of the screen's own controls.
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 72, alignItems: 'center' }}>
      <Pressable
        onPress={() => void Updates.reloadAsync()}
        accessibilityRole="button"
        accessibilityLabel="An update is ready. Restart to use it"
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, minHeight: 44,
          borderRadius: radius.pill, backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1,
        })}
      >
        <RefreshCw size={16} color={colors.onAccent} strokeWidth={2.2} />
        <Text variant="label" ink="onAccent">Update ready · Restart</Text>
      </Pressable>
    </View>
  );
}
