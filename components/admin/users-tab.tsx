'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCard } from './user-card';
import { Search, Users, Filter, SortAsc, SortDesc } from 'lucide-react';
import type { ReceiptWithItems } from '@/lib/types/api-responses';

// Admin-specific user type with aggregated data
interface AdminUser {
  id: string;
  email: string;
  subscribed: boolean;
  isAdmin: boolean;
  isBlocked?: boolean;
  blockedAt?: string | null;
  blockedReason?: string | null;
  createdAt: string;
  stripeCustomerId: string | null;
  receiptCount: number;
  householdCount: number;
}

interface UsersTabProps {
  users: AdminUser[];
  expandedUsers: Set<string>;
  userReceipts: Record<string, ReceiptWithItems[]>;
  onToggleUser: (userId: string) => void;
  onOpenReceipt: (receiptId: string) => void;
}

type SortField = 'email' | 'createdAt' | 'receiptCount' | 'householdCount';
type FilterType = 'all' | 'subscribed' | 'free' | 'admin' | 'with-stripe' | 'blocked';

export function UsersTab({
  users,
  expandedUsers,
  userReceipts,
  onToggleUser,
  onOpenReceipt,
}: UsersTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(user =>
        user.email.toLowerCase().includes(query) ||
        user.id.toLowerCase().includes(query),
      );
    }

    // Apply filter
    switch (filterType) {
      case 'subscribed':
        result = result.filter(u => u.subscribed);
        break;
      case 'free':
        result = result.filter(u => !u.subscribed);
        break;
      case 'admin':
        result = result.filter(u => u.isAdmin);
        break;
      case 'with-stripe':
        result = result.filter(u => u.stripeCustomerId);
        break;
      case 'blocked':
        result = result.filter(u => u.isBlocked);
        break;
    }

    // Apply sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'receiptCount':
          comparison = a.receiptCount - b.receiptCount;
          break;
        case 'householdCount':
          comparison = a.householdCount - b.householdCount;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [users, searchQuery, filterType, sortField, sortDirection]);

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Users
            </CardTitle>
            <CardDescription>
              {filteredAndSortedUsers.length} of {users.length} users
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <span className="text-success">●</span>
              {users.filter(u => u.subscribed).length} subscribed
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className="text-muted-foreground">●</span>
              {users.filter(u => !u.subscribed).length} not subscribed
            </Badge>
            {users.filter(u => u.isBlocked).length > 0 && (
              <Badge variant="outline" className="gap-1 border-destructive text-destructive">
                <span className="text-destructive">●</span>
                {users.filter(u => u.isBlocked).length} blocked
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="subscribed">Subscribed</SelectItem>
                <SelectItem value="free">Not subscribed</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="with-stripe">Has Stripe</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Join Date</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="receiptCount">Receipts</SelectItem>
                <SelectItem value="householdCount">Households</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleSortDirection}
              title={sortDirection === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
            >
              {sortDirection === 'asc' ? (
                <SortAsc className="h-4 w-4" />
              ) : (
                <SortDesc className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* User List */}
        <div className="space-y-3">
          {filteredAndSortedUsers.length > 0 ? (
            filteredAndSortedUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isExpanded={expandedUsers.has(user.id)}
                onToggle={() => onToggleUser(user.id)}
                userReceipts={userReceipts[user.id]}
                onOpenReceipt={onOpenReceipt}
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No users found matching your criteria</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
