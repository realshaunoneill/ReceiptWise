import React, { useEffect } from 'react';
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
import ErrorScreen from '../src/components/ErrorScreen';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { useSession } from '../src/hooks/useSession';
import { persistOptions, queryClient } from '../src/query/client';
import { clearQueue, startUploads } from '../src/upload/runner';

// A deep link straight to a receipt still has the tabs beneath it, so Back stays in the app.
export const unstable_settings = { anchor: '(tabs)' };

/** A crash anywhere the screens' own boundaries don't cover. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorScreen {...props} />;
}

// Held until the fonts and the session are known, so the first frame is the right screen in Plex.
void SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { theme, colors } = useTheme();
  const session = useSession();
  const signedIn = !!session.data;

  // Signed out anywhere (the session expired, or was ended on another device): back to sign-in.
  useEffect(() => onApiError((error) => {
    if (error.kind === 'signed-out') queryClient.setQueryData(['session'], null);
  }), []);

  useEffect(() => {
    if (!signedIn) return undefined;
    return startUploads();
  }, [signedIn]);

  // A queue left by whoever was signed in mustn't upload into the next account.
  useEffect(() => {
    if (session.isSuccess && !signedIn) clearQueue();
  }, [session.isSuccess, signedIn]);

  useEffect(() => {
    if (!session.isPending) void SplashScreen.hideAsync();
  }, [session.isPending]);

  if (session.isPending) return null;

  // React Navigation paints its own backgrounds; matching them stops a white flash behind a push.
  const base = theme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: { ...base.colors, primary: colors.accent, background: colors.background, card: colors.background, text: colors.text, border: colors.border },
  };

  return (
    <NavigationTheme value={navigationTheme}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
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
  // A font that fails to load falls back to the system face rather than holding the splash forever.
  if (!loaded && !error) return null;

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <ThemeProvider>
        <Navigator />
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
