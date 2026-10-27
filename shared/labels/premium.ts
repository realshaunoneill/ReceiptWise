/**
 * How the account's own Premium is billed, in the words Settings uses on the website and in the
 * app, from GET /api/users/me's `premium` block. Plain text only: the app mustn't link to the
 * website's checkout or show its prices (App Store guideline 3.1.1), so a link, where there is
 * one, is each screen's to add.
 */

export type PremiumLike = {
  active: boolean;
  source: 'stripe' | 'app_store' | 'play_store' | 'comp' | null;
  productId: string | null;
  expiresAt: string | null;
  willRenew: boolean | null;
  inTrial: boolean;
};

export type PremiumBilling = {
  /** "Billed through the App Store" */
  title: string;
  /** "Monthly · renews 27 Nov 2026", or null when there's nothing more to say. */
  detail: string | null;
  /** Where to manage or cancel it, for the stores (the website has its billing portal). */
  manage: string | null;
};

const day = (iso: string) => new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

/** "Yearly" or "Monthly", from a product id such as io.receiptwise.premium.yearly or premium:yearly. */
export function premiumPeriod(productId: string | null): string | null {
  if (!productId) return null;
  if (/year|annual/i.test(productId)) return 'Yearly';
  if (/month/i.test(productId)) return 'Monthly';
  return null;
}

export function premiumBilling(premium: PremiumLike | null | undefined): PremiumBilling | null {
  if (!premium?.active || !premium.source) return null;
  const { source, expiresAt, willRenew, inTrial, productId } = premium;
  const when = expiresAt
    ? inTrial ? `free trial until ${day(expiresAt)}` : willRenew === false ? `ends ${day(expiresAt)}` : `renews ${day(expiresAt)}`
    : null;
  const detail = (parts: Array<string | null>) => {
    const text = parts.filter(Boolean).join(' · ');
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : null;
  };

  switch (source) {
    case 'stripe':
      return { title: 'Billed through the ReceiptWise website', detail: null, manage: null };
    case 'app_store':
      return {
        title: 'Billed through the App Store',
        detail: detail([premiumPeriod(productId), when]),
        manage: 'Manage or cancel it on your iPhone: Settings › your name › Subscriptions.',
      };
    case 'play_store':
      return {
        title: 'Billed through Google Play',
        detail: detail([premiumPeriod(productId), when]),
        manage: 'Manage or cancel it in Google Play: Payments & subscriptions › Subscriptions.',
      };
    case 'comp':
      return { title: 'Given to this account', detail: expiresAt ? `Until ${day(expiresAt)}` : null, manage: null };
    default:
      return null;
  }
}
