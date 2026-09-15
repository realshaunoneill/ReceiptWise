'use client';

import { useState, useEffect } from 'react';
import { useQueryState, parseAsStringLiteral } from 'nuqs';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useUser } from '@clerk/nextjs';
import { useUser as useUserData } from '@/lib/hooks/use-user';
import { useOnboarding } from '@/components/onboarding/onboarding-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PlayCircle, User, CreditCard, Home, Download, AlertTriangle, Settings2, SlidersHorizontal, Trash2, Clock, Mail, FileImage, Puzzle, Copy, Plus, Key, Lock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import type { HouseholdWithMembers } from '@/lib/types/api-responses';
import { useHouseholds } from '@/lib/hooks/use-households';
import { SUPPORTED_CURRENCIES } from '@/lib/utils/currency';

const VALID_TABS = ['profile', 'preferences', 'subscription', 'household', 'integrations', 'data'] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { user: clerkUser, isLoaded } = useUser();
  const { user: userData, isLoading: userDataLoading, refetch: refetchUser } = useUserData();
  const { startOnboarding } = useOnboarding();
  const [selectedHousehold, setSelectedHousehold] = useState<string>('none');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingImages, setIsExportingImages] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [apiKeys, setApiKeys] = useState<Array<{
    id: string;
    name: string;
    maskedKey: string;
    createdAt: string;
    lastUsedAt: string | null;
  }>>([]);
  const [newApiKey, setNewApiKey] = useState<{ key: string; name: string } | null>(null);
  const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const queryClient = useQueryClient();

  // Tab state synced with URL using nuqs
  const [currentTab, setCurrentTab] = useQueryState(
    'tab',
    parseAsStringLiteral(VALID_TABS).withDefault('profile'),
  );

  // Update selected household when userData loads
  useEffect(() => {
    if (userData?.defaultHouseholdId) {
      setSelectedHousehold(userData.defaultHouseholdId);
    }
  }, [userData?.defaultHouseholdId]);

  // Update selected currency when userData loads
  useEffect(() => {
    if (userData?.currency) {
      setSelectedCurrency(userData.currency);
    }
  }, [userData?.currency]);

  // Fetch user's households using the shared hook
  const { data: households = [], isLoading: householdsLoading } = useHouseholds();

  // Update default household mutation
  const updateDefaultHousehold = useMutation({
    mutationFn: async (householdId: string | null) => {
      const response = await fetch('/api/users/default-household', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId }),
      });
      if (!response.ok) throw new Error('Failed to update default household');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success('Default household updated successfully');
    },
    onError: (error) => {
      console.error('Error updating default household:', error);
      toast.error('Failed to update default household');
    },
  });

  // Update currency mutation
  const updateCurrency = useMutation({
    mutationFn: async (currency: string) => {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency }),
      });
      if (!response.ok) throw new Error('Failed to update currency');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success('Currency preference updated');
    },
    onError: (error) => {
      console.error('Error updating currency:', error);
      toast.error('Failed to update currency');
    },
  });

  const handleSaveDefaultHousehold = () => {
    const householdId = selectedHousehold === 'none' ? null : selectedHousehold;
    updateDefaultHousehold.mutate(householdId);
  };

  const handleSaveCurrency = () => {
    updateCurrency.mutate(selectedCurrency);
  };

  const handleUpgrade = () => {
    router.push('/upgrade');
  };

  // Billing portal mutation
  const billingPortalMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/billing-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to create billing portal session');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error) => {
      console.error('Error managing subscription:', error);
      toast.error('Failed to open subscription management.');
    },
  });

  const handleManageSubscription = () => {
    billingPortalMutation.mutate();
  };

  const handleExport = async (format: string, type: string) => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/users/export?format=${format}&type=${type}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartspend-export-${new Date().toISOString().split('T')[0]}.${format === 'json' ? 'json' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Refresh user data to show updated last export time
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportWithImages = async () => {
    setIsExportingImages(true);
    try {
      const response = await fetch('/api/users/export?format=json&type=receipts-with-images');
      if (!response.ok) throw new Error('Export failed');

      const data = await response.json();

      // Dynamically import the HTML generator to keep the bundle smaller
      const { generateReceiptExportHtml } = await import('@/lib/utils/receipt-export-html');
      const html = generateReceiptExportHtml(data);

      const blob = new Blob([html], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receiptwise-export-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success('Receipts exported with images successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export receipts');
    } finally {
      setIsExportingImages(false);
    }
  };

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/users/me', {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to schedule account deletion');
      return response.json();
    },
    onSuccess: async () => {
      await refetchUser();
      setShowDeleteDialog(false);
      setDeleteConfirmation('');
      toast.success('Account scheduled for deletion', {
        description: 'Your account will be deleted in 24 hours. Contact support to cancel.',
        duration: 10000,
      });
    },
    onError: (error) => {
      console.error('Error scheduling account deletion:', error);
      toast.error('Failed to schedule account deletion');
    },
  });

  // Cancel deletion mutation
  const cancelDeletionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/users/cancel-deletion', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to cancel account deletion');
      return response.json();
    },
    onSuccess: async () => {
      await refetchUser();
      toast.success('Account deletion cancelled', {
        description: 'Your account is safe and will not be deleted.',
      });
    },
    onError: (error) => {
      console.error('Error cancelling account deletion:', error);
      toast.error('Failed to cancel account deletion');
    },
  });

  const handleDeleteAccount = () => {
    if (deleteConfirmation.toLowerCase() !== 'delete my account') {
      toast.error('Please type "delete my account" to confirm');
      return;
    }
    deleteAccountMutation.mutate();
  };

  // API Key functions
  const fetchApiKeys = async () => {
    setIsLoadingApiKeys(true);
    try {
      const response = await fetch('/api/extension/api-key');
      if (!response.ok) throw new Error('Failed to fetch API keys');
      const data = await response.json();
      setApiKeys(data.keys || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast.error('Failed to fetch API keys');
    } finally {
      setIsLoadingApiKeys(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }

    setIsLoadingApiKeys(true);
    try {
      const response = await fetch('/api/extension/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!response.ok) throw new Error('Failed to create API key');
      const data = await response.json();
      
      // Show the full key once
      setNewApiKey({ key: data.key, name: data.name });
      setNewKeyName('');
      setShowNewKeyDialog(false);
      
      // Refresh the list
      await fetchApiKeys();
      toast.success('API key created successfully');
    } catch (error) {
      console.error('Error creating API key:', error);
      toast.error('Failed to create API key');
    } finally {
      setIsLoadingApiKeys(false);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    setIsLoadingApiKeys(true);
    try {
      const response = await fetch('/api/extension/api-key', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId }),
      });
      if (!response.ok) throw new Error('Failed to delete API key');
      
      await fetchApiKeys();
      toast.success('API key deleted successfully');
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast.error('Failed to delete API key');
    } finally {
      setIsLoadingApiKeys(false);
    }
  };

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('API key copied to clipboard');
  };

  // Load API keys when tab changes to integrations
  useEffect(() => {
    if (currentTab === 'integrations' && userData?.subscribed) {
      fetchApiKeys();
    }
  }, [currentTab, userData?.subscribed]);

  // Check if deletion is scheduled
  const isDeletionScheduled = userData?.deletionScheduledAt !== null && userData?.deletionScheduledAt !== undefined;
  const deletionDate = isDeletionScheduled ? new Date(userData.deletionScheduledAt!) : null;

  if (!isLoaded || userDataLoading) {
    return (
      <main className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        {/* Header - matches loading.tsx */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded" />
              <Skeleton className="h-9 w-24" />
            </div>
            <Skeleton className="h-5 w-64 mt-1 sm:mt-2" />
          </div>
        </div>
        {/* Tabs - matches loading.tsx */}
        {/* Six tabs, not five — the skeleton was a tab short of the real list. */}
        <div className="grid w-full grid-cols-3 gap-1 rounded-lg bg-muted p-1 lg:w-auto lg:flex">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-9 rounded-md lg:w-28" />
          ))}
        </div>
        {/* Profile Card - matches loading.tsx */}
        <div className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-72" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!clerkUser) {
    return null;
  }

  return (
    <main className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6" aria-labelledby="settings-title">
        <div className="flex items-center justify-between">
          <div>
            <h1 id="settings-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
              <Settings2 className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
              Settings
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2">Manage your account and preferences</p>
          </div>
        </div>

        <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as typeof VALID_TABS[number])} className="w-full">
          {/* Six tabs in a five-column grid: the grid was never updated when the
              Integrations tab was added, so on narrow screens one tab was pushed
              onto a second row of a container sized for one. Two rows of three
              below the `lg` breakpoint, a single row above it. */}
          <TabsList className="grid h-auto w-full grid-cols-3 lg:w-auto lg:grid-cols-none lg:flex">
            <TabsTrigger value="profile" className="gap-2">
              <User className="hidden h-4 w-4 sm:block" aria-hidden="true" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              {/* Was a Sparkles icon, which meant nothing here. */}
              <SlidersHorizontal className="hidden h-4 w-4 sm:block" aria-hidden="true" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2">
              <CreditCard className="hidden h-4 w-4 sm:block" aria-hidden="true" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="household" className="gap-2">
              <Home className="hidden h-4 w-4 sm:block" aria-hidden="true" />
              Household
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Puzzle className="hidden h-4 w-4 sm:block" aria-hidden="true" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-2">
              <Download className="hidden h-4 w-4 sm:block" aria-hidden="true" />
              Data
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Your account information from Clerk</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={clerkUser.fullName || 'Not set'}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    To update your name, please use your Clerk account settings
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={clerkUser.emailAddresses[0]?.emailAddress || 'No email'}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clerk-id">User ID</Label>
                  <Input
                    id="clerk-id"
                    value={clerkUser.id}
                    disabled
                    className="font-mono text-xs"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Your ReceiptWise account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Member Since</Label>
                    <p className="text-sm text-muted-foreground">
                      {userData?.createdAt
                        ? new Date(userData.createdAt).toLocaleDateString()
                        : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Last Updated</Label>
                    <p className="text-sm text-muted-foreground">
                      {userData?.updatedAt
                        ? new Date(userData.updatedAt).toLocaleDateString()
                        : 'Unknown'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Display</CardTitle>
                <CardDescription>How amounts and the interface are shown to you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Theme had no home in Settings at all — the only control was the
                    icon button in the navigation bar, which is easy to miss and
                    the first place people look for it is here. */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Appearance</Label>
                    <p className="text-sm text-muted-foreground">
                      Light, dark, or whatever your system is set to.
                    </p>
                  </div>
                  <ThemeToggle />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="currency">Display currency</Label>
                  <p className="text-sm text-muted-foreground">
                    Used for every amount in the app. Receipts keep the currency they were
                    issued in.{' '}
                    {/* This link pointed at support@receiptwise.app. The domain is
                        receiptwise.io everywhere else — 15 other references — so
                        mail sent from here went nowhere. */}
                    <a href="mailto:support@receiptwise.io?subject=Currency%20request" className="text-primary hover:underline">
                      Ask us to add one
                    </a>{' '}
                    if yours is missing.
                  </p>
                  <div className="flex gap-3">
                    <Select
                      value={selectedCurrency}
                      onValueChange={setSelectedCurrency}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_CURRENCIES.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.symbol} {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleSaveCurrency}
                      disabled={updateCurrency.isPending || selectedCurrency === userData?.currency}
                    >
                      {updateCurrency.isPending ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Guided tour</CardTitle>
                <CardDescription>A walk through the main screens, if you want it again</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={startOnboarding} className="gap-2">
                  <PlayCircle className="h-4 w-4" aria-hidden="true" />
                  Start the tour
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Plan</CardTitle>
                <CardDescription>Manage your ReceiptWise subscription</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {userData?.subscribed ? 'Premium Plan' : 'Free Plan'}
                          </p>
                          <Badge variant={userData?.subscribed ? 'default' : 'secondary'}>
                            {userData?.subscribed ? 'Premium' : 'Free'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {userData?.subscribed
                            ? 'Unlimited receipts, advanced analytics, and household sharing'
                            : 'View-only access to existing data'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!userData?.subscribed ? (
                        <Button onClick={handleUpgrade}>
                          Upgrade to Premium
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={handleManageSubscription}
                          disabled={billingPortalMutation.isPending}
                        >
                          {billingPortalMutation.isPending ? 'Loading...' : 'Manage Subscription'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {userData?.subscribed && (
                    <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                      <h4 className="font-medium text-sm">Premium Features</h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Unlimited receipt storage
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Advanced spending analytics
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Household sharing & collaboration
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Priority support
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Household Tab */}
          <TabsContent value="household" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Default Household</CardTitle>
                <CardDescription>
                  Set a default household for automatic receipt uploads
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="default-household">Default Household</Label>
                  <Select
                    value={selectedHousehold}
                    onValueChange={setSelectedHousehold}
                    disabled={householdsLoading || households.length === 0}
                  >
                    <SelectTrigger id="default-household">
                      <SelectValue placeholder="Select a household" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Personal receipts only)</SelectItem>
                      {households.map((household: HouseholdWithMembers) => (
                        <SelectItem key={household.id} value={household.id}>
                          {household.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    When set, newly uploaded receipts will automatically be assigned to this household
                  </p>
                </div>
                <Button
                  onClick={handleSaveDefaultHousehold}
                  disabled={
                    updateDefaultHousehold.isPending ||
                    selectedHousehold === (userData?.defaultHouseholdId || 'none')
                  }
                >
                  {updateDefaultHousehold.isPending ? 'Saving...' : 'Save Default Household'}
                </Button>
              </CardContent>
            </Card>

            {households.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <Home className="h-10 w-10 text-muted-foreground mb-3" />
                  <h3 className="font-semibold mb-1">No Households Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create or join a household to share receipts with family members
                  </p>
                  {/* Was `window.location.href`, which threw away the SPA and
                      reloaded the whole app to reach an internal route. */}
                  <Button variant="outline" onClick={() => router.push('/sharing')}>
                    Go to sharing
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Chrome Extension</CardTitle>
                <CardDescription>
                  Capture receipts from anywhere on the web with our browser extension
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                  <h4 className="font-medium text-sm">How it works</h4>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Install the ReceiptWise Clipper extension from the Chrome Web Store</li>
                    <li>Create an API key below and copy it into the extension</li>
                    <li>Use the snipping tool to capture receipts from any webpage</li>
                  </ol>
                </div>

                {userData?.subscribed ? (
                  <div className="space-y-4">
                    {/* New API Key Dialog */}
                    {/* Was a hand-rolled green panel with `bg-white dark:bg-gray-900`
                        on the input — raw colours rather than tokens, so it did not
                        follow the theme. */}
                    {newApiKey && (
                      <Alert variant="success">
                        <Key className="h-4 w-4" aria-hidden="true" />
                        <AlertTitle>Key created: {newApiKey.name}</AlertTitle>
                        <AlertDescription className="w-full">
                          <p>Copy it now. It is not shown again.</p>
                          <div className="flex w-full gap-2 pt-1">
                            <Input
                              value={newApiKey.key}
                              readOnly
                              aria-label="New API key"
                              className="bg-background font-mono text-xs"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => copyApiKey(newApiKey.key)}
                              className="shrink-0"
                            >
                              <Copy className="h-4 w-4" aria-hidden="true" />
                              <span className="sr-only">Copy API key</span>
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => setNewApiKey(null)}
                              className="shrink-0"
                            >
                              Done
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* API Keys List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Your API Keys</Label>
                        <AlertDialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" disabled={isLoadingApiKeys}>
                              <Plus className="h-4 w-4 mr-2" />
                              Create New Key
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Create an API key</AlertDialogTitle>
                              <AlertDialogDescription>
                                Name it after where it will live, so you know which one to
                                revoke later &mdash; &ldquo;Home laptop&rdquo;, &ldquo;Work laptop&rdquo;.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="space-y-2">
                              <Label htmlFor="key-name">Key Name</Label>
                              <Input
                                id="key-name"
                                placeholder="e.g., Chrome Extension"
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !isLoadingApiKeys) {
                                    createApiKey();
                                  }
                                }}
                              />
                            </div>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setNewKeyName('')}>Cancel</AlertDialogCancel>
                              <Button onClick={createApiKey} disabled={isLoadingApiKeys || !newKeyName.trim()}>
                                {isLoadingApiKeys ? 'Creating...' : 'Create Key'}
                              </Button>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                      {isLoadingApiKeys && apiKeys.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="text-center">
                            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                            <p className="mt-2 text-sm text-muted-foreground">Loading API keys...</p>
                          </div>
                        </div>
                      ) : apiKeys.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-6 text-center">
                          <Key className="h-8 w-8 mx-auto text-muted-foreground/50" />
                          <p className="mt-2 text-sm text-muted-foreground">
                            No API keys yet. Create one to get started.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {apiKeys.map((key) => (
                            <div
                              key={key.id}
                              className="flex items-center gap-3 rounded-lg border p-3 bg-card"
                            >
                              <div className="rounded-full bg-primary/10 p-2">
                                <Key className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">{key.name}</p>
                                </div>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {key.maskedKey}
                                </p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Created {new Date(key.createdAt).toLocaleDateString()}
                                  </span>
                                  {key.lastUsedAt && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                  {!key.lastUsedAt && <span className="text-warning">Never used</span>}
                                </div>
                              </div>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    disabled={isLoadingApiKeys}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this key?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      &ldquo;{key.name}&rdquo; stops working immediately, and anything
                                      using it will need a new key.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <Button
                                      variant="destructive"
                                      onClick={() => deleteApiKey(key.id)}
                                      disabled={isLoadingApiKeys}
                                    >
                                      {isLoadingApiKeys ? 'Deleting...' : 'Delete Key'}
                                    </Button>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Alert variant="info">
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      <AlertTitle>What these keys can and cannot do</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc space-y-1 pl-4 text-xs">
                          <li>
                            <strong>Write only.</strong> A key can upload receipts. It cannot
                            read or change anything already in your account.
                          </li>
                          <li>
                            <strong>For the extension.</strong> That is the only client these
                            are intended for.
                          </li>
                          <li>
                            <strong>Treat it like a password.</strong> If one leaks, delete it
                            here and create another.
                          </li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      Upgrade to Premium to use the Chrome extension
                    </p>
                    <Button onClick={handleUpgrade}>
                      Upgrade to Premium
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Export</CardTitle>
                <CardDescription>Download your data for backup or tax purposes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Last Export</span>
                    <span className="text-sm text-muted-foreground">
                      {userData?.lastExportedAt
                        ? new Date(userData.lastExportedAt).toLocaleString()
                        : 'Never'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Export all your receipts, subscriptions, and payment history in CSV or JSON format.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    onClick={() => handleExport('csv', 'all')}
                    disabled={isExporting}
                    className="justify-start"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? 'Exporting...' : 'All Data (CSV)'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExport('json', 'all')}
                    disabled={isExporting}
                    className="justify-start"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? 'Exporting...' : 'All Data (JSON)'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExport('csv', 'receipts')}
                    disabled={isExporting}
                    className="justify-start"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? 'Exporting...' : 'Receipts Only'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExport('csv', 'subscriptions')}
                    disabled={isExporting}
                    className="justify-start"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? 'Exporting...' : 'Subscriptions Only'}
                  </Button>
                </div>
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Download all your receipts with images in a viewable HTML format.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleExportWithImages}
                    disabled={isExportingImages}
                    className="w-full justify-start"
                  >
                    <FileImage className="h-4 w-4 mr-2" />
                    {isExportingImages ? 'Generating...' : 'Receipts with Images (HTML)'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>Irreversible actions</CardDescription>
              </CardHeader>
              <CardContent>
                {isDeletionScheduled ? (
                  <div className="space-y-4">
                    {/* `text-amber-600` had no dark variant, so this went nearly
                        invisible against the dark surface. */}
                    <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
                      <div className="flex items-start gap-3">
                        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                        <div className="space-y-2">
                          <p className="font-medium text-warning">
                            Account scheduled for deletion
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Your account is scheduled to be permanently deleted on{' '}
                            <strong className="text-foreground">
                              {deletionDate?.toLocaleString(undefined, {
                                dateStyle: 'full',
                                timeStyle: 'short',
                              })}
                            </strong>
                          </p>
                          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <span>
                              Changed your mind? Contact{' '}
                              <a
                                href="mailto:support@receiptwise.io?subject=Cancel Account Deletion"
                                className="text-primary underline underline-offset-2 hover:text-primary/80"
                              >
                                support@receiptwise.io
                              </a>
                              {' '}or click the button below to cancel.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => cancelDeletionMutation.mutate()}
                      disabled={cancelDeletionMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {cancelDeletionMutation.isPending ? 'Cancelling...' : 'Cancel Account Deletion'}
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                    <p className="mb-4 text-sm text-muted-foreground">
                      Deleting your account will permanently remove all your data, including receipts, households, and settings. This action cannot be undone.
                    </p>
                    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Account
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Delete Your Account?
                          </AlertDialogTitle>
                          <AlertDialogDescription asChild>
                            <div className="space-y-4 text-sm text-muted-foreground">
                              <p>
                                Your account will be scheduled for deletion in <strong className="text-foreground">24 hours</strong>. During this time, you can cancel the deletion by contacting support.
                              </p>
                              <div className="rounded-lg bg-muted p-3 space-y-2">
                                <p className="text-sm font-medium text-foreground">What will be deleted:</p>
                                <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                                  <li>All your receipts and images</li>
                                  <li>Subscription tracking data</li>
                                  <li>Household memberships</li>
                                  <li>Account settings and preferences</li>
                                </ul>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  To cancel after confirming, email{' '}
                                  <a
                                    href="mailto:support@receiptwise.io?subject=Cancel Account Deletion"
                                    className="text-primary underline underline-offset-2"
                                  >
                                    support@receiptwise.io
                                  </a>
                                </span>
                              </div>
                              <div className="space-y-2 pt-2">
                                <Label htmlFor="delete-confirmation" className="text-sm font-medium text-foreground">
                                  Type <span className="font-mono bg-muted px-1 rounded">delete my account</span> to confirm:
                                </Label>
                                <Input
                                  id="delete-confirmation"
                                  placeholder="delete my account"
                                  value={deleteConfirmation}
                                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                                  className="font-mono"
                                />
                              </div>
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeleteConfirmation('')}>
                            Cancel
                          </AlertDialogCancel>
                          <Button
                            variant="destructive"
                            onClick={handleDeleteAccount}
                            disabled={
                              deleteAccountMutation.isPending ||
                              deleteConfirmation.toLowerCase() !== 'delete my account'
                            }
                          >
                            {deleteAccountMutation.isPending ? 'Scheduling...' : 'Delete My Account'}
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
  );
}
