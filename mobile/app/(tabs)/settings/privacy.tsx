import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { LocalAuthentication } from '../../../src/components/AppLock';
import { setPrivacy, usePrivacy } from '../../../src/privacy';
import { selectionTick } from '../../../src/ui/Button';
import { Notice } from '../../../src/ui/Feedback';
import { SwitchField } from '../../../src/ui/Form';
import { Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';

type LockAvailability = 'checking' | 'ready' | 'not-set-up' | 'no-hardware' | 'needs-update';

/**
 * Privacy on this phone: hide amounts (for showing someone the screen) and app lock. Both are kept
 * on the phone, not the account, as the website keeps its own hide amounts per browser.
 */
export default function Privacy() {
  const { hideAmounts, appLock } = usePrivacy();
  const [lock, setLock] = useState<LockAvailability>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!LocalAuthentication || Platform.OS === 'web') return setLock('needs-update');
    Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()])
      .then(([hardware, enrolled]) => setLock(!hardware ? 'no-hardware' : enrolled ? 'ready' : 'not-set-up'))
      .catch(() => setLock('no-hardware'));
  }, []);

  const toggleLock = async (on: boolean) => {
    setError(null);
    if (!on) return setPrivacy({ appLock: false });
    // Prove it works before relying on it, or the app could lock someone out.
    const result = await LocalAuthentication?.authenticateAsync({ promptMessage: 'Turn on app lock' });
    if (result?.success) {
      selectionTick();
      setPrivacy({ appLock: true });
    } else if (result && result.error !== 'user_cancel' && result.error !== 'system_cancel') {
      setError("Couldn't confirm it's you, so app lock stays off.");
    }
  };

  return (
    <TabScreen>
      <Section footer="Amounts show as ••• everywhere in the app: for showing someone your receipts or plan without the figures. Only on this phone.">
        <SwitchField label="Hide amounts" value={hideAmounts} onChange={(on) => setPrivacy({ hideAmounts: on })} />
      </Section>

      <Section footer="Asks for Face ID or your fingerprint when ReceiptWise opens, and after five minutes away. The app switcher always shows the logo, not your money.">
        {lock === 'ready' || appLock ? (
          <SwitchField label="App lock" value={appLock} onChange={(on) => void toggleLock(on)} />
        ) : (
          <Notice tone="neutral" title="App lock">
            {lock === 'checking'
              ? 'Checking this phone…'
              : lock === 'not-set-up'
                ? 'Set up Face ID, Touch ID or a fingerprint in your phone’s settings to use app lock.'
                : lock === 'needs-update'
                  ? 'App lock comes with the next version of the app.'
                  : 'This phone has no Face ID or fingerprint reader.'}
          </Notice>
        )}
        {!!error && <Notice tone="bad" title="That didn't work" style={{ marginTop: 12 }}>{error}</Notice>}
      </Section>
    </TabScreen>
  );
}
