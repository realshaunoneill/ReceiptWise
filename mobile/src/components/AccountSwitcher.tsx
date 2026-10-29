import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { firstName } from '../auth/account-list';
import { useAccounts } from '../auth/accounts';
import { switchAccount } from '../hooks/useSession';
import { selectionTick } from '../ui/Button';
import { type HeaderAction } from '../ui/HeaderButton';

/**
 * Home's account switcher, once more than one person in the household is signed in on the device:
 * a header button named for whoever is on screen, so a shared iPad says whose figures these are,
 * with everyone else to switch to and "Add an account". No passcode to switch (Shaun, 2026-10-29).
 * With one account, adding another is in Settings › Accounts on this device.
 */
export function useAccountAction(): HeaderAction | null {
  const router = useRouter();
  const { active, accounts } = useAccounts();
  if (Platform.OS === 'web' || accounts.length < 2) return null;
  const current = accounts.find((account) => account.slot === active);
  return {
    // A name, not an icon, on every platform: who's on screen is the point.
    label: current ? firstName(current) : 'Accounts',
    menu: {
      title: 'Switch account',
      items: [
        ...accounts.map((account) => ({
          label: account.name || account.email || 'Account',
          selected: account.slot === active,
          onPress: () => {
            if (account.slot === active) return;
            selectionTick();
            switchAccount(account.slot);
          },
        })),
        { label: 'Add an account', onPress: () => router.push('/add-account') },
      ],
    },
  };
}
