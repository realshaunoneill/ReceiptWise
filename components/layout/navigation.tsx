'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Receipt, Users, Settings, LogOut, TrendingUp, Menu, ShieldCheck, Repeat, Wallet, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { addAccount, listBrowserAccounts, signOutAndLeave, signOutCurrentAccount, switchAccount, useSession, type BrowserAccount } from '@/lib/auth-client';
import { useFeature } from '@/lib/hooks/use-user';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { InvitationNotifications } from '@/components/households/invitation-notifications';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEffect, useState } from 'react';
import Image from 'next/image';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/receipts', label: 'Receipts', icon: Receipt },
  { href: '/subscriptions', label: 'Subscriptions', icon: Repeat },
  { href: '/insights', label: 'Insights', icon: TrendingUp },
  { href: '/sharing', label: 'Households', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const user = session?.user;
  const userId = user?.id;
  const isLoaded = !isPending;
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      try {
        const response = await fetch('/api/admin/check');
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (_error) {
        setIsAdmin(false);
      } finally {
        setIsCheckingAdmin(false);
      }
    }
    if (userId) {
      checkAdmin();
    } else {
      setIsCheckingAdmin(false);
    }
  }, [userId]);

  // The bills work, behind its flag: a Plan page, and Subscriptions renamed to Bills.
  const billsEnabled = useFeature('bills');
  // With bills on, Plan and Bills sit together after the dashboard: the month, then what's in it.
  const displayNavItems = billsEnabled
    ? navItems.flatMap((item) => {
      if (item.href === '/dashboard') {
        return [item, { href: '/plan', label: 'Plan', icon: Wallet }, { href: '/subscriptions', label: 'Bills', icon: Repeat }];
      }
      if (item.href === '/subscriptions') return [];
      return [item];
    })
    : [...navItems];
  if (!isCheckingAdmin && isAdmin) {
    displayNavItems.push({ href: '/admin', label: 'Admin', icon: ShieldCheck });
  }

  // Everyone signed in to this browser (a household sharing a computer), for the account menu.
  const [accounts, setAccounts] = useState<BrowserAccount[]>([]);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void listBrowserAccounts().then((list) => {
      if (live) setAccounts(list);
    }).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [userId]);
  const others = accounts.filter((account) => account.userId !== userId);
  const currentToken = session?.session.token;

  // With other accounts signed in here, signing out leaves them signed in and the next one takes over.
  const handleLogout = () => (others.length > 0 && currentToken ? signOutCurrentAccount(currentToken, true) : signOutAndLeave());

  // Show loading skeleton while checking auth state
  if (!isLoaded) {
    return (
      <nav aria-label="Main navigation" className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4">
          {/* Logo */}
          <Link href="/" aria-label="ReceiptWise home" className="flex items-center gap-2 shrink-0">
            <img src="/logo-mark.png" alt="" width={24} height={24} className="h-6 w-6" aria-hidden="true" />
            <span className="hidden font-semibold tracking-tight text-foreground lg:inline">ReceiptWise</span>
          </Link>

          {/* Desktop Navigation Skeleton - Centered */}
          <div className="hidden md:flex md:flex-1 md:justify-center">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-md" />
              ))}
            </div>
          </div>

          {/* Right Side Skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <ThemeToggle />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </nav>
    );
  }

  // If user is not authenticated, show public navigation
  if (isLoaded && !user) {
    return (
      <nav aria-label="Main navigation" className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4">
          {/* Logo */}
          <Link href="/" aria-label="ReceiptWise home" className="flex items-center gap-2 shrink-0">
            <img src="/logo-mark.png" alt="" width={24} height={24} className="h-6 w-6" aria-hidden="true" />
            <span className="font-semibold tracking-tight text-foreground">ReceiptWise</span>
          </Link>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {/* Said "Get Started" but pointed at /sign-in — the label promised a
                sign-up and delivered a sign-in form. */}
            <Button asChild size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Main navigation" className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/dashboard" aria-label="ReceiptWise dashboard" className="flex items-center gap-2 shrink-0">
          <img src="/logo-mark.png" alt="" width={24} height={24} className="h-6 w-6" aria-hidden="true" />
          <span className="hidden font-semibold tracking-tight text-foreground lg:inline">ReceiptWise</span>
        </Link>

        {/* Desktop Navigation - Centered */}
        <div className="hidden md:flex md:flex-1 md:justify-center">
          <div className="flex items-center gap-1">
            {displayNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  title={item.label}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {/* Icons only at md, where seven or eight labelled items don't fit. */}
                  <span className={displayNavItems.length > 6 ? 'sr-only lg:not-sr-only' : undefined}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          <InvitationNotifications />
          <ThemeToggle />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Account menu"
                className="relative h-9 w-9 rounded-full overflow-hidden border-2 border-border hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {user?.image ? (
                  <Image
                    src={user.image}
                    alt="User avatar"
                    width={32}
                    height={32}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="h-full w-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {(user?.name || user?.email)?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              {/* Settings is in the navigation itself, so the account menu holds only the accounts. */}
              <DropdownMenuSeparator />
              {others.map((account) => (
                <DropdownMenuItem key={account.sessionToken} onClick={() => void switchAccount(account.sessionToken)} className="min-h-11">
                  <span className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">
                    {(account.name || account.email)[0]?.toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="sr-only">Switch to </span>
                    <span className="block truncate text-sm">{account.name || account.email}</span>
                    {account.name && <span className="block truncate text-xs text-muted-foreground">{account.email}</span>}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => void addAccount()}>
                <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                Add another account
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                {others.length > 0 ? `Sign out of ${user?.name?.split(' ')[0] || 'this account'}` : 'Sign out'}
              </DropdownMenuItem>
              {others.length > 0 && (
                <DropdownMenuItem onClick={() => void signOutAndLeave()} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  Sign out of all accounts
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                <Menu className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {displayNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        // 44px rows: the menu items were 32px tall, small to hit on a phone.
                        'flex min-h-11 items-center gap-2',
                        isActive && 'bg-primary/10 text-primary',
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
