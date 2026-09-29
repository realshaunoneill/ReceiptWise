import { toast } from 'sonner';

/** Copy an invitation link, falling back to a toast with the link when the clipboard is blocked. */
export async function copyInviteLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Invite link copied');
    return true;
  } catch {
    toast.message('Copy this link', { description: url });
    return false;
  }
}
