import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type WireNotificationSettings } from '@shared/api/notifications';
import { type NotificationPrefs } from '@shared/push/prefs';
import { api } from '../api/client';

/** Which push notifications are on, and how many phones get them (the website's Settings shows the same). */
export function useNotificationSettings() {
  return useQuery({ queryKey: ['notification-settings'], queryFn: () => api<WireNotificationSettings>('/api/users/me/notifications') });
}

/** Turn one or more on or off; the switch shows its new state while it saves. */
export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (change: Partial<NotificationPrefs>) => api<WireNotificationSettings>('/api/users/me/notifications', { method: 'PATCH', json: change }),
    onSuccess: (settings) => queryClient.setQueryData(['notification-settings'], settings),
  });
}
