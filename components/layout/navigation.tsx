'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Receipt, Users, Settings, LogOut, TrendingUp, Menu, ShieldCheck, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useClerk } from '@clerk/nextjs';
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
  { href: '/sharing', label: 'Sharing', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
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
    if (user) {
      checkAdmin();
    } else {
      setIsCheckingAdmin(false);
    }
  }, [user]);

  const displayNavItems = [...navItems];
  if (!isCheckingAdmin && isAdmin) {
    displayNavItems.push({ href: '/admin', label: 'Admin', icon: ShieldCheck });
  }

  const handleLogout = async () => {
    await signOut();
  };

  // Show loading skeleton while checking auth state
  if (!isLoaded) {
    return (
      <nav aria-label="Main navigation" className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo-mark.png" alt="ReceiptWise" width={24} height={24} className="h-6 w-6" />
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
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo-mark.png" alt="ReceiptWise" width={24} height={24} className="h-6 w-6" />
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
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo-mark.png" alt="ReceiptWise" width={24} height={24} className="h-6 w-6" />
          <span className="hidden font-bold text-foreground lg:inline">ReceiptWise</span>
        </Link>

        {/* Desktop Navigation - Centered */}
        <div className="hidden md:flex md:flex-1 md:justify-center">
          <div className="flex items-center gap-1">
            {displayNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
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
              <button className="relative h-8 w-8 rounded-full overflow-hidden border-2 border-border hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                {user?.imageUrl ? (
                  <Image
                    src={user.imageUrl}
                    alt="User avatar"
                    width={32}
                    height={32}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="h-full w-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.fullName || user?.firstName || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Menu className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {displayNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2',
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
