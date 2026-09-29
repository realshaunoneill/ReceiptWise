'use client';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Receipt, Home, Users, Calendar, Mail, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import type { HouseholdWithMembers, ReceiptWithItems, MemberWithUser } from '@/lib/types/api-responses';

type HouseholdDetailsWithMembers = HouseholdWithMembers & {
  members?: MemberWithUser[];
};

type AdminHouseholdReceipt = ReceiptWithItems & {
  submitterEmail?: string;
};

interface HouseholdCardProps {
  household: {
    id: string
    name: string
    memberCount: number
    receiptCount: number
    createdAt: string
    ownerEmail: string
  }
  isExpanded: boolean
  onToggle: () => void
  householdDetails?: HouseholdDetailsWithMembers
  householdReceipts?: AdminHouseholdReceipt[]
  onOpenReceipt: (receiptId: string) => void
}

export function HouseholdCard({
  household,
  isExpanded,
  onToggle,
  householdDetails,
  householdReceipts,
  onOpenReceipt,
}: HouseholdCardProps) {
  return (
    <div className="rounded-lg border">
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium break-all">{household.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Users className="h-3 w-3" />
              {household.memberCount} members
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Receipt className="h-3 w-3" />
              {household.receiptCount} receipts
            </span>
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span className="hidden sm:inline">Owner: </span>{household.ownerEmail}
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Calendar className="h-3 w-3" />
              {new Date(household.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="self-end sm:self-auto">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="border-t bg-muted/20">
          <Tabs defaultValue="members" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
              <TabsTrigger
                value="members"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                Members
              </TabsTrigger>
              <TabsTrigger
                value="receipts"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                Receipts
              </TabsTrigger>
            </TabsList>
            <TabsContent value="members" className="p-4 mt-0">
              {householdDetails ? (
                householdDetails.members && householdDetails.members.length > 0 ? (
                  <div className="space-y-2">
                    {householdDetails.members.map((member: MemberWithUser) => (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between rounded-md bg-background p-3"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-sm break-all">{member.email}</span>
                        </div>
                        <Badge variant={member.role === 'owner' ? 'default' : 'outline'} className="shrink-0">
                          {member.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No members found</p>
                )
              ) : (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </TabsContent>
            <TabsContent value="receipts" className="p-4 mt-0">
              {householdReceipts ? (
                householdReceipts.length > 0 ? (
                  <div className="space-y-2">
                    {householdReceipts.map((receipt: AdminHouseholdReceipt) => (
                      <div
                        key={receipt.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md bg-background p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReceipt(receipt.id);
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Receipt className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{receipt.merchantName || 'Unknown'}</span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {receipt.processingStatus}
                          </Badge>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{receipt.submitterEmail}</span>
                          </div>
                          <div className="flex items-center gap-2 justify-between sm:justify-end">
                            <span className="text-sm font-medium whitespace-nowrap">
                              {receipt.currency} {receipt.totalAmount}
                            </span>
                            <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No receipts found</p>
                )
              ) : (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
