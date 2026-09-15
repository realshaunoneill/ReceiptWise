'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReceiptCard } from './receipt-card';
import { Search, Receipt, Filter, SortAsc, SortDesc, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

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

interface ReceiptsTabProps {
  receipts: AdminReceipt[]
  onOpenReceipt: (receiptId: string) => void
  onRefresh?: () => void
}

type SortField = 'createdAt' | 'transactionDate' | 'totalAmount' | 'merchantName';
type StatusFilter = 'all' | 'completed' | 'failed' | 'pending' | 'processing';

export function ReceiptsTab({ receipts, onOpenReceipt, onRefresh }: ReceiptsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const filteredAndSortedReceipts = useMemo(() => {
    let result = [...receipts];

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(receipt =>
        (receipt.merchantName || '').toLowerCase().includes(query) ||
        receipt.userEmail.toLowerCase().includes(query) ||
        (receipt.householdName || '').toLowerCase().includes(query) ||
        receipt.id.toLowerCase().includes(query),
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(r => r.processingStatus === statusFilter);
    }

    // Apply sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'transactionDate':
          comparison = new Date(a.transactionDate || a.createdAt).getTime() - new Date(b.transactionDate || b.createdAt).getTime();
          break;
        case 'totalAmount':
          comparison = parseFloat(a.totalAmount || '0') - parseFloat(b.totalAmount || '0');
          break;
        case 'merchantName':
          comparison = (a.merchantName || '').localeCompare(b.merchantName || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [receipts, searchQuery, statusFilter, sortField, sortDirection]);

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const statusCounts = useMemo(() => ({
    completed: receipts.filter(r => r.processingStatus === 'completed').length,
    failed: receipts.filter(r => r.processingStatus === 'failed').length,
    pending: receipts.filter(r => r.processingStatus === 'pending' || r.processingStatus === 'processing').length,
  }), [receipts]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              All Receipts
            </CardTitle>
            <CardDescription>
              {filteredAndSortedReceipts.length} of {receipts.length} receipts
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1 border-success/30 bg-success/10">
              <CheckCircle2 className="h-3 w-3 text-success" />
              {statusCounts.completed}
            </Badge>
            <Badge variant="outline" className="gap-1 border-destructive/30 bg-destructive/10">
              <AlertCircle className="h-3 w-3 text-destructive" />
              {statusCounts.failed}
            </Badge>
            <Badge variant="outline" className="gap-1 border-warning/30 bg-warning/10">
              <Clock className="h-3 w-3 text-warning" />
              {statusCounts.pending}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by merchant, email, or household..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    Completed
                  </span>
                </SelectItem>
                <SelectItem value="failed">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="h-3 w-3 text-destructive" />
                    Failed
                  </span>
                </SelectItem>
                <SelectItem value="pending">
                  <span className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-warning" />
                    Pending
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Upload Date</SelectItem>
                <SelectItem value="transactionDate">Transaction Date</SelectItem>
                <SelectItem value="totalAmount">Amount</SelectItem>
                <SelectItem value="merchantName">Merchant</SelectItem>
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

        {/* Receipt List */}
        <div className="space-y-3">
          {filteredAndSortedReceipts.length > 0 ? (
            filteredAndSortedReceipts.map((receipt) => (
              <ReceiptCard
                key={receipt.id}
                receipt={receipt}
                onOpenReceipt={onOpenReceipt}
                onDeleted={onRefresh}
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No receipts found matching your criteria</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
