/*
 * Shared appearance for Clerk's <SignIn> and <SignUp>.
 *
 * Clerk ships its own light palette, and only the outer card was being
 * neutralised — so in dark mode the form sat on the page as a white rectangle
 * with black text, the one element that had not been themed. Clerk's appearance
 * variables accept any CSS colour value, so pointing them at the same custom
 * properties the rest of the app uses makes the form follow the theme (and the
 * typeface) for free. One definition, so the two auth pages cannot drift.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: 'var(--primary)',
    colorBackground: 'var(--card)',
    colorText: 'var(--card-foreground)',
    colorTextSecondary: 'var(--muted-foreground)',
    colorInputBackground: 'var(--background)',
    colorInputText: 'var(--foreground)',
    colorNeutral: 'var(--foreground)',
    colorDanger: 'var(--destructive)',
    borderRadius: 'var(--radius)',
    fontFamily: 'var(--font-plex-sans)',
  },
  elements: {
    rootBox: 'w-full max-w-md',
    card: 'shadow-none border-0 bg-transparent p-0',
    headerTitle: 'hidden',
    headerSubtitle: 'hidden',
    formButtonPrimary: 'bg-primary hover:bg-primary/90',
    formFieldInput: 'border-input',
    footer: 'hidden',
  },
};
