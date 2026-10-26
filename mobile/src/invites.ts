import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';

/**
 * Household invitation links, both ways: sharing one from the phone (there is no email sending,
 * so the owner sends the link themselves, as on the website), and keeping one that was opened
 * while signed out, so it opens again once signed in (the website's rememberPendingInvite).
 */

const KEY = 'receiptwise_pending_invite';
/** 32 random bytes, hex (lib/services/household-service.ts). */
export const INVITE_TOKEN = /^[a-f0-9]{64}$/;

export function shareInvite(householdName: string, url: string) {
  return Share.share(
    { message: `Join ${householdName} on ReceiptWise, to share receipts, bills and the plan: ${url}`, url },
    { subject: `Join ${householdName} on ReceiptWise` },
  );
}

export async function rememberInvite(token: string): Promise<void> {
  if (INVITE_TOKEN.test(token)) await AsyncStorage.setItem(KEY, token).catch(() => undefined);
}

/** The invitation waiting since before sign-in, once: it's forgotten as it's read. */
export async function takePendingInvite(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(KEY);
    if (token !== null) await AsyncStorage.removeItem(KEY);
    // Storage outlives app versions, so only a well-formed token is used.
    return token && INVITE_TOKEN.test(token) ? token : null;
  } catch {
    return null;
  }
}
