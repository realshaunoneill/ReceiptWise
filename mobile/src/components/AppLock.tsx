import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { privacyLoaded, usePrivacy } from '../privacy';
import { GUTTER, space } from '../theme';
import Button from '../ui/Button';
import Text from '../ui/Text';
import Logo from './Logo';

/* Only where the native modules exist: builds from before phase 5 haven't got them. */
/* eslint-disable @typescript-eslint/no-require-imports */
export const LocalAuthentication = requireOptionalNativeModule('ExpoLocalAuthentication') ? (require('expo-local-authentication') as typeof import('expo-local-authentication')) : null;
const ScreenCapture = requireOptionalNativeModule('ExpoScreenCapture') ? (require('expo-screen-capture') as typeof import('expo-screen-capture')) : null;
/* eslint-enable @typescript-eslint/no-require-imports */

/** Back after this long away, a locked app asks again. */
const RELOCK_AFTER_MS = 5 * 60 * 1000;

/**
 * Locked at launch only once. This mounts again whenever the account on screen changes
 * (app/_layout.tsx): switching to someone else in the household doesn't ask for Face ID, and a
 * lock still showing (a notification for someone else tapped on the lock screen) carries over.
 */
let launchLockDone = false;
let lockedBeforeRemount = false;

/**
 * App lock (src/privacy.ts): Face ID or the fingerprint on a cold start and after five minutes
 * away. And, whether or not the lock is on, a cover while the app is in the background, so the
 * app switcher's preview shows the logo rather than someone's money; with the lock on, Android
 * also keeps the screen out of screenshots and the recents preview (FLAG_SECURE). Both are
 * RN Modals, which sit above the native sheets and modals a plain overlay can't cover.
 */
export default function AppLock() {
  const { appLock } = usePrivacy();
  const [locked, setLocked] = useState(() => {
    const cold = !launchLockDone;
    launchLockDone = true;
    return (cold || lockedBeforeRemount) && appLock && privacyLoaded() && !!LocalAuthentication;
  });
  useEffect(() => {
    lockedBeforeRemount = locked;
  }, [locked]);
  const [covered, setCovered] = useState(false);
  const away = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setCovered(false);
        if (appLock && LocalAuthentication && away.current !== null && Date.now() - away.current > RELOCK_AFTER_MS) setLocked(true);
        away.current = null;
      } else {
        setCovered(true);
        if (state === 'background' && away.current === null) away.current = Date.now();
      }
    });
    return () => subscription.remove();
  }, [appLock]);

  // Turning the lock off unlocks; FLAG_SECURE follows the setting.
  useEffect(() => {
    if (!appLock) setLocked(false);
    if (Platform.OS === 'android' && ScreenCapture) {
      void (appLock ? ScreenCapture.preventScreenCaptureAsync('app-lock') : ScreenCapture.allowScreenCaptureAsync('app-lock')).catch(() => undefined);
    }
  }, [appLock]);

  if (Platform.OS === 'web') return null;
  return (
    <>
      <Modal visible={covered && !locked} animationType="none" presentationStyle="fullScreen" statusBarTranslucent>
        <Cover />
      </Modal>
      <Modal visible={locked} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => undefined}>
        <LockScreen onUnlock={() => setLocked(false)} />
      </Modal>
    </>
  );
}

function Cover() {
  const { colors, theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <Logo size={64} dark={theme === 'dark'} />
    </View>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState('Face ID');
  const [error, setError] = useState<string | null>(null);

  const unlock = useCallback(async () => {
    if (!LocalAuthentication) return onUnlock();
    setError(null);
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock ReceiptWise', fallbackLabel: 'Use passcode' });
    if (result.success) onUnlock();
    else if (result.error !== 'user_cancel' && result.error !== 'app_cancel' && result.error !== 'system_cancel') setError("That didn't work. Try again.");
  }, [onUnlock]);

  useEffect(() => {
    LocalAuthentication?.supportedAuthenticationTypesAsync()
      .then((types) => setMethod(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? (Platform.OS === 'ios' ? 'Face ID' : 'face unlock') : Platform.OS === 'ios' ? 'Touch ID' : 'your fingerprint'))
      .catch(() => undefined);
    // Ask at once: that's why the app was opened.
    void unlock();
  }, [unlock]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + space.xxxl * 2, paddingBottom: insets.bottom + space.xl, paddingHorizontal: GUTTER + space.xs, alignItems: 'center', gap: space.lg }}>
      <Logo size={56} dark={theme === 'dark'} />
      <Text variant="title" align="center" accessibilityRole="header">ReceiptWise is locked</Text>
      <Text variant="callout" ink="secondary" align="center">{`Unlock it with ${method} or your passcode.`}</Text>
      {!!error && <Text variant="footnote" ink="bad" align="center">{error}</Text>}
      <View style={{ flex: 1 }} />
      <Button label="Unlock" onPress={() => void unlock()} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}
