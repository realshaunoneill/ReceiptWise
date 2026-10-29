import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans/700Bold';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { onApiError } from '../src/api/client';
import { activeSlot, loadAccounts, useAccounts, useAccountsLoaded } from '../src/auth/accounts';
import AppLock from '../src/components/AppLock';
import ErrorScreen from '../src/components/ErrorScreen';
import { reportUncaughtErrors } from '../src/crashes';
import UpdatePrompt from '../src/components/UpdatePrompt';
import SignedInEffects from '../src/components/SignedInEffects';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { accountEnded, seedSession, useSession } from '../src/hooks/useSession';
import { persistOptionsFor, queryClient } from '../src/query/client';
import ChooseHost from '../src/ui/ChooseHost';
import { usePresentations } from '../src/ui/stack';
import { usePrivacyLoaded } from '../src/privacy';
import { clearQuickActions } from '../src/quickActions';
import { resetPurchases } from '../src/purchases';
import { clearQueue, startUploads } from '../src/upload/runner';

// A deep link straight to a receipt still has the tabs beneath it, so Back stays in the app.
export const unstable_settings = { anchor: '(tabs)' };

/** A crash anywhere the screens' own boundaries don't cover. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorScreen {...props} />;
}

// Held until the fonts and the session are known, so the first frame is the right screen in Plex.
void SplashScreen.preventAutoHideAsync();
reportUncaughtErrors();
void loadAccounts();

function Navigator() {
  const { theme, colors } = useTheme();
  const { sheet, tallSheet, modal } = usePresentations();
  const session = useSession();
  const signedIn = !!session.data;

  // An account signed out anywhere (its session expired, or was ended on another device): it's
  // forgotten here, and the next account signed in takes over, or else the sign-in screen.
  useEffect(() => onApiError((error, account) => {
    if (error.kind === 'signed-out' && account) void accountEnded(account);
  }), []);

  useEffect(() => {
    if (!signedIn) return undefined;
    return startUploads();
  }, [signedIn]);

  // Nobody signed in here any more: nothing of theirs may upload, or stay on the icon or in
  // RevenueCat (signing out of one account forgets its own, src/hooks/useSession.ts).
  useEffect(() => {
    if (session.isSuccess && !signedIn && !activeSlot()) {
      clearQueue();
      clearQuickActions();
      void resetPurchases();
    }
  }, [session.isSuccess, signedIn]);

  // App lock must know its setting before the first frame, so the splash waits for it too.
  const privacyReady = usePrivacyLoaded();
  useEffect(() => {
    if (!session.isPending && privacyReady) void SplashScreen.hideAsync();
  }, [session.isPending, privacyReady]);

  if (session.isPending || !privacyReady) return null;

  // React Navigation paints its own backgrounds; matching them stops a white flash behind a push.
  const base = theme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: { ...base.colors, primary: colors.accent, background: colors.background, card: colors.background, text: colors.text, border: colors.border },
  };

  return (
    <NavigationTheme value={navigationTheme}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {signedIn && <SignedInEffects />}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />

          {/* The plan */}
          <Stack.Screen name="sheets/plan-entry" options={sheet} />
          <Stack.Screen name="sheets/plan-amount" options={sheet} />
          <Stack.Screen name="sheets/plan-paste" options={tallSheet} />
          <Stack.Screen name="sheets/plan-income" options={modal} />
          <Stack.Screen name="sheets/plan-goal" options={modal} />
          <Stack.Screen name="sheets/plan-balances" options={modal} />
          <Stack.Screen name="plan-setup" options={{ presentation: 'fullScreenModal' }} />

          {/* Receipts */}
          <Stack.Screen name="sheets/receipt-filters" options={sheet} />

          {/* Bills */}
          <Stack.Screen name="sheets/bill-edit" options={modal} />
          <Stack.Screen name="sheets/bill-link-receipt" options={tallSheet} />

          {/* Premium */}
          <Stack.Screen name="paywall" options={modal} />

          {/* Settings and households */}
          <Stack.Screen name="sheets/notifications-priming" options={sheet} />
          <Stack.Screen name="sheets/household-new" options={sheet} />
          <Stack.Screen name="sheets/household-rename" options={sheet} />
          <Stack.Screen name="sheets/household-invite" options={sheet} />
          <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="add-account" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        {/* An invitation link opens signed in or out (signed out, it keeps the link through sign-in). */}
        <Stack.Screen name="invite/[token]" options={{ presentation: 'modal' }} />
      </Stack>
      <UpdatePrompt />
      <ChooseHost />
      {signedIn && <AppLock />}
    </NavigationTheme>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  const accountsLoaded = useAccountsLoaded();
  // A font that fails to load falls back to the system face rather than holding the splash forever.
  if ((!loaded && !error) || !accountsLoaded) return null;

  return (
    <ThemeProvider>
      <AccountApp />
    </ThemeProvider>
  );
}

/**
 * The app as one account at a time (src/auth/accounts.ts). When the account on screen changes
 * (signing in, switching to someone else in the household, signing out), everything unmounts, the
 * query cache is emptied and the app mounts again on the new account's saved data, from Home: so
 * nothing of one person's shows to the next, as the website does with a full page load. Unmounting
 * first stops the old account's saved data being overwritten by the emptied cache.
 */
function AccountApp() {
  const { colors } = useTheme();
  const { active } = useAccounts();
  const [shown, setShown] = useState(active);

  useEffect(() => {
    if (active === shown) return;
    queryClient.clear();
    seedSession(active);
    setShown(active);
  }, [active, shown]);

  // The one frame between the two: the app's background, not a flash of the window's.
  if (active !== shown) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <PersistQueryClientProvider key={shown ?? 'signed-out'} client={queryClient} persistOptions={persistOptionsFor(shown)}>
      <Navigator />
    </PersistQueryClientProvider>
  );
}
