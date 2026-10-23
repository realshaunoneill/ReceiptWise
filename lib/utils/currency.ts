// Supported currencies with their symbols and locales
export const SUPPORTED_CURRENCIES = [
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'en-IE' },
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', locale: 'nb-NO' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', locale: 'da-DK' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', locale: 'pl-PL' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ' },
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]['code'];

export const DEFAULT_CURRENCY: CurrencyCode = 'EUR';

/**
 * Get currency details by code
 */
export function getCurrencyDetails(code: string) {
  return SUPPORTED_CURRENCIES.find(c => c.code === code) || SUPPORTED_CURRENCIES[0];
}

/**
 * Format a number as currency
 */
export function formatCurrency(amount: number, currencyCode: string = DEFAULT_CURRENCY): string {
  const supported = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);

  // A code outside the list (say INR, read off a bill) is formatted as itself. Falling back to
  // the first entry, as getCurrencyDetails does, would label it with a euro sign.
  if (!supported) {
    try {
      return new Intl.NumberFormat('en-IE', { style: 'currency', currency: currencyCode }).format(amount);
    } catch {
      // Not a currency code at all: fall through to the default formatting.
    }
  }

  const currency = supported ?? getCurrencyDetails(currencyCode);

  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: currency.code === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency.code === 'JPY' ? 0 : 2,
  }).format(amount);
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currencyCode: string = DEFAULT_CURRENCY): string {
  return getCurrencyDetails(currencyCode).symbol;
}
