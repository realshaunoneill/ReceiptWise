import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type WireMe } from '@shared/api/user';
import { api } from '../src/api/client';
import { appleSignInAvailable, forgetSession, signInUnavailable, signInWithApple, signInWithGoogle } from '../src/auth/auth';
import Logo from '../src/components/Logo';
import { DEV_LOGIN, SITE_URL } from '../src/config';
import { useTheme } from '../src/contexts/ThemeContext';
import { usePasswordSignIn } from '../src/hooks/useSession';
import { GUTTER, radius, space } from '../src/theme';
import Button from '../src/ui/Button';
import { Field } from '../src/ui/Controls';
import { Notice } from '../src/ui/Feedback';
import Text from '../src/ui/Text';

/** Apple's "Hide my email" gives an address like this, which no existing account has. */
const isHiddenAppleEmail = (email: string) => email.endsWith('@privaterelay.appleid.com');
const JUST_MADE_MS = 10 * 60 * 1000;

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // After Apple made a new account with a hidden email: is it someone new, or a Google user?
  const [askNewOrExisting, setAskNewOrExisting] = useState(false);

  useEffect(() => {
    void appleSignInAvailable().then(setAppleAvailable);
  }, []);

  const finish = async () => {
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
    await queryClient.invalidateQueries({ queryKey: ['session'] });
  };

  const google = async () => {
    setError(null);
    setBusy('google');
    try {
      if (await signInWithGoogle()) await finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't sign in with Google");
    } finally {
      setBusy(null);
    }
  };

  const apple = async () => {
    setError(null);
    setBusy('apple');
    try {
      if (!(await signInWithApple())) return;
      const me = await api<WireMe>('/api/users/me');
      if (isHiddenAppleEmail(me.email) && Date.now() - Date.parse(me.createdAt) < JUST_MADE_MS) {
        setAskNewOrExisting(true);
        return;
      }
      await finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't sign in with Apple");
    } finally {
      setBusy(null);
    }
  };

  /** They already use ReceiptWise with Google: drop the empty account Apple just made, and sign in there. */
  const useGoogleAccountInstead = async () => {
    setError(null);
    setBusy('google');
    try {
      await api('/api/users/me/discard', { method: 'POST' });
      await forgetSession();
      setAskNewOrExisting(false);
      if (await signInWithGoogle()) await finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't switch to your Google account");
    } finally {
      setBusy(null);
    }
  };

  const open = (path: string) => void WebBrowser.openBrowserAsync(`${SITE_URL}${path}`);

  if (askNewOrExisting) {
    return (
      <Screen insets={insets}>
        <Text variant="title" accessibilityRole="header">Is this your first time using ReceiptWise?</Text>
        <Text variant="callout" ink="secondary">
          You chose to hide your email from us, so this is a new account. If you already use ReceiptWise with Google, sign in with Google instead and your receipts will be there. You can add Sign in with Apple to that account afterwards, in Settings.
        </Text>
        <View style={{ gap: space.md, marginTop: space.lg }}>
          <Button label="Yes, I'm new" onPress={() => void finish()} />
          <Button label="I already use it with Google" variant="secondary" loading={busy === 'google'} onPress={() => void useGoogleAccountInstead()} />
        </View>
        {!!error && <Notice tone="bad" title="That didn't work">{error}</Notice>}
      </Screen>
    );
  }

  return (
    <Screen insets={insets}>
      <View style={{ alignItems: 'center', gap: space.md, marginTop: space.xxxl, marginBottom: space.xl }}>
        <Logo size={72} dark={theme === 'dark'} />
        <Text variant="largeTitle" align="center">ReceiptWise</Text>
        <Text variant="callout" ink="secondary" align="center">
          Receipts read for you, your bills in one list, and a plan that shows what's left each month.
        </Text>
      </View>

      {signInUnavailable ? (
        <Notice tone="neutral" title="Signing in needs the installed app">
          Expo Go can't finish signing in. Use a development or store build of ReceiptWise.
        </Notice>
      ) : (
        <View style={{ gap: space.md }}>
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={theme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.lg}
              style={{ height: 50, opacity: busy ? 0.5 : 1 }}
              onPress={() => {
                if (!busy) void apple();
              }}
            />
          )}
          {Platform.OS !== 'web' && (
            <Button label="Continue with Google" variant="secondary" loading={busy === 'google'} disabled={!!busy} onPress={() => void google()} />
          )}
        </View>
      )}

      {(DEV_LOGIN || Platform.OS === 'web') && <PasswordSignIn />}

      {!!error && <Notice tone="bad" title="That didn't work" style={{ marginTop: space.lg }}>{error}</Notice>}

      <View style={{ flex: 1 }} />
      <Text variant="footnote" ink="muted" align="center" style={{ marginTop: space.xxl }}>
        {'By continuing you agree to the '}
        <Text variant="footnote" ink="accent" onPress={() => open('/terms')} accessibilityRole="link">Terms</Text>
        {' and the '}
        <Text variant="footnote" ink="accent" onPress={() => open('/privacy')} accessibilityRole="link">Privacy Policy</Text>
        .
      </Text>
    </Screen>
  );
}

function Screen({ children, insets }: { children: React.ReactNode; insets: { top: number; bottom: number } }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl, paddingHorizontal: GUTTER + space.xs, gap: space.lg }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Test accounts only (@receiptwise.test), where the server allows it: the web preview and the e2e build. */
function PasswordSignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signIn = usePasswordSignIn();
  return (
    <View style={{ gap: space.md, marginTop: space.xl }}>
      <Text variant="footnote" ink="muted">Test accounts</Text>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      <Button label="Sign in" variant="secondary" loading={signIn.isPending} onPress={() => signIn.mutate({ email: email.trim(), password })} />
      {signIn.error && <Notice tone="bad" title="That didn't work">{signIn.error.message}</Notice>}
    </View>
  );
}
