'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Receipt, Home, CreditCard, TrendingUp, AlertCircle, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { useMemo } from 'react';

interface AdminUser {
  id: string;
  email: string;
  subscribed: boolean;
  isAdmin: boolean;
  createdAt: string;
  stripeCustomerId: string | null;
  receiptCount: number;
  householdCount: number;
}

interface AdminHousehold {
  id: string;
  name: string;
  memberCount: number;
  receiptCount: number;
  createdAt: string;
}

interface AdminReceipt {
  id: string;
  merchantName: string;
  totalAmount: string;
  currency: string;
  transactionDate: string;
  userEmail: string;
  householdName: string | null;
  processingStatus: string;
  createdAt: string;
}

interface AdminStatsProps {
  users: AdminUser[]
  households: AdminHousehold[]
  receipts: AdminReceipt[]
}

export function AdminStats({ users, households, receipts }: AdminStatsProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // User stats
    const subscribedUsers = users.filter(u => u.subscribed).length;
    const newUsersThisMonth = users.filter(u => new Date(u.createdAt) >= thisMonth).length;
    const newUsersLastMonth = users.filter(u => {
      const date = new Date(u.createdAt);
      return date >= lastMonth && date < thisMonth;
    }).length;
    const userGrowth = newUsersLastMonth > 0
      ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100)
      : newUsersThisMonth > 0 ? 100 : 0;

    // Receipt stats
    const completedReceipts = receipts.filter(r => r.processingStatus === 'completed').length;
    const failedReceipts = receipts.filter(r => r.processingStatus === 'failed').length;
    const pendingReceipts = receipts.filter(r => r.processingStatus === 'pending' || r.processingStatus === 'processing').length;
    const receiptsThisWeek = receipts.filter(r => new Date(r.createdAt) >= thisWeek).length;

    // Calculate total value
    const totalValue = receipts.reduce((sum, r) => {
      const amount = parseFloat(r.totalAmount || '0');
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    // Calculate success rate
    const processedReceipts = completedReceipts + failedReceipts;
    const successRate = processedReceipts > 0
      ? Math.round((completedReceipts / processedReceipts) * 100)
      : 100;

    // Household stats
    const totalMembers = households.reduce((sum, h) => sum + h.memberCount, 0);
    const avgMembersPerHousehold = households.length > 0
      ? (totalMembers / households.length).toFixed(1)
      : '0';

    return {
      subscribedUsers,
      newUsersThisMonth,
      userGrowth,
      completedReceipts,
      failedReceipts,
      pendingReceipts,
      receiptsThisWeek,
      totalValue,
      successRate,
      totalMembers,
      avgMembersPerHousehold,
    };
  }, [users, households, receipts]);

  return (
    <div className="space-y-4">
      {/* Primary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CreditCard className="h-3 w-3 text-success" />
                {stats.subscribedUsers} subscribed
              </span>
              <span>•</span>
              <span>{users.length - stats.subscribedUsers} not subscribed</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newUsersThisMonth}</div>
            <div className="flex items-center gap-1 text-xs">
              {stats.userGrowth >= 0 ? (
                <span className="text-success">+{stats.userGrowth}%</span>
              ) : (
                <span className="text-destructive">{stats.userGrowth}%</span>
              )}
              <span className="text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{receipts.length}</div>
            <p className="text-xs text-muted-foreground">
              {stats.receiptsThisWeek} uploaded this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Households</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{households.length}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalMembers} total members ({stats.avgMembersPerHousehold} avg)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-success/20 bg-success/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-success">Processed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.completedReceipts}</div>
            <p className="text-xs text-success/80">
              {stats.successRate}% success rate
            </p>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.failedReceipts}</div>
            <p className="text-xs text-destructive/80">
              Needs attention
            </p>
          </CardContent>
        </Card>

        <Card className="border-warning/20 bg-warning/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-warning">Pending</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pendingReceipts}</div>
            <p className="text-xs text-warning/80">
              In queue
            </p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">
              Tracked across all receipts
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
