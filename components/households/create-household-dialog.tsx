'use client';

import type React from 'react';

import { useState } from 'react';
import { Plus, Loader2, Home, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createHousehold } from '@/lib/household-actions';
import { toast } from 'sonner';

interface CreateHouseholdDialogProps {
  onHouseholdCreated: () => void
}

const HOUSEHOLD_SUGGESTIONS = [
  'Family',
  'Roommates',
  'Partner',
  'Home',
];

export function CreateHouseholdDialog({ onHouseholdCreated }: CreateHouseholdDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      await createHousehold({ name: name.trim() });
      toast.success(`"${name.trim()}" household created!`, {
        description: 'You can now invite members to share receipts.',
      });
      onHouseholdCreated();
      setOpen(false);
      setName('');
    } catch (_error) {
      toast.error('Failed to create household', {
        description: 'Please try again.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Household
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Home className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Create Household</DialogTitle>
            <DialogDescription className="text-center">
              Create a shared space for tracking receipts with family or roommates
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div>
              <Label htmlFor="name">Household Name</Label>
              <Input
                id="name"
                placeholder="Enter a name for your household"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2"
                required
                autoFocus
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Quick suggestions:</p>
              <div className="flex flex-wrap gap-2">
                {HOUSEHOLD_SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setName(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <p className="text-xs font-medium">Once it exists</p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-5">
                <li className="flex items-center gap-1.5">
                  <Users className="h-3 w-3" />
                  Invite family or roommates
                </li>
                <li>Share receipts automatically</li>
                <li>Track shared expenses together</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Household'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
