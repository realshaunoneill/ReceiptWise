'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { type WireNotificationSettings } from '@/shared/api/notifications';
import { NOTIFICATION_GROUPS, type NotificationPrefs } from '@/shared/push/prefs';

const KEY = ['notification-settings'];

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof body?.error === 'string' ? body.error : fallback);
  }
  return res.json() as Promise<T>;
}

/**
 * The app's push notifications, chosen here as well as in the app's Settings (the same switches,
 * GET/PATCH /api/users/me/notifications). They go to phones with the app; the website itself
 * sends none.
 */
export function NotificationsCard() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: KEY,
    queryFn: async () => readJson<WireNotificationSettings>(await fetch('/api/users/me/notifications'), 'Failed to load notifications'),
  });
  const update = useMutation({
    mutationFn: async (change: Partial<NotificationPrefs>) => readJson<WireNotificationSettings>(
      await fetch('/api/users/me/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(change) }),
      'Failed to save',
    ),
    onSuccess: (next) => queryClient.setQueryData(KEY, next),
    onError: (error) => toast.error(error.message),
  });
  // While a switch saves, show it as changed.
  const saving = update.isPending ? update.variables : undefined;
  const value = (key: keyof NotificationPrefs) => saving?.[key] ?? settings.data?.prefs[key] ?? false;
  const devices = settings.data?.devices ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          {devices === 0
            ? 'Sent to your phone by the ReceiptWise app, once it’s installed and allowed to. Choose them now and they apply from then.'
            : `Sent to ${devices === 1 ? 'your phone' : `your ${devices} phones`} by the ReceiptWise app. The same switches are in the app’s Settings.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!settings.data ? (
          settings.isError ? <p className="text-sm text-destructive">{settings.error.message}</p> : <Skeleton className="h-56 w-full" />
        ) : (
          <>
            {NOTIFICATION_GROUPS.map((group) => (
              <div key={group.key} className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor={`notify-${group.key}`}>{group.label}</Label>
                  <p className="text-sm text-muted-foreground">{group.detail}</p>
                </div>
                <Switch id={`notify-${group.key}`} checked={value(group.key)} onCheckedChange={(on) => update.mutate({ [group.key]: on })} />
              </div>
            ))}
            <div className="flex items-start justify-between gap-4 border-t pt-5">
              <div className="space-y-1">
                <Label htmlFor="notify-hide-amounts">Hide amounts</Label>
                <p className="text-sm text-muted-foreground">Leave amounts out of notifications, so nothing on a lock screen says how much.</p>
              </div>
              <Switch id="notify-hide-amounts" checked={value('hideAmounts')} onCheckedChange={(on) => update.mutate({ hideAmounts: on })} />
            </div>
            <p className="text-xs text-muted-foreground">
              Quiet from 21:30 to 08:00, except for what you’ve just done yourself, like a receipt you photographed. What’s held comes at 8.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
