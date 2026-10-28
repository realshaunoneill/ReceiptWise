'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Filter, X, Calendar, Coins, Store, Tag, Briefcase, Command } from 'lucide-react';
import { CATEGORY_FILTER_OPTIONS } from '@/lib/utils/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

export interface ReceiptFilters {
  search?: string
  category?: string
  merchant?: string
  minAmount?: string
  maxAmount?: string
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: string
  isBusinessExpense?: string
  searchAllHouseholds?: boolean
}

type SortField = 'date' | 'amount' | 'merchant';

/*
 * The order options used to read "Newest first / Oldest first" whatever the field, so sorting by
 * amount offered "Newest first". Each field names its own two directions, and picking a field
 * starts it in the direction people usually want (biggest first, A–Z).
 */
const SORT_ORDERS: Record<SortField, { desc: string; asc: string; default: 'asc' | 'desc' }> = {
  date: { desc: 'Newest first', asc: 'Oldest first', default: 'desc' },
  amount: { desc: 'Highest first', asc: 'Lowest first', default: 'desc' },
  merchant: { asc: 'A–Z', desc: 'Z–A', default: 'asc' },
};

function sortField(sortBy?: string): SortField {
  return sortBy === 'amount' || sortBy === 'merchant' ? sortBy : 'date';
}

/** The default direction for a sort field. */
export function defaultSortOrder(sortBy?: string): 'asc' | 'desc' {
  return SORT_ORDERS[sortField(sortBy)].default;
}

/** "newest first", "highest amount first", "merchant A–Z": what the list is actually sorted by. */
export function describeSort(sortBy?: string, sortOrder?: string): string {
  const field = sortField(sortBy);
  const order = sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : SORT_ORDERS[field].default;
  switch (field) {
    case 'amount':
      return order === 'desc' ? 'highest amount first' : 'lowest amount first';
    case 'merchant':
      return order === 'asc' ? 'merchant A–Z' : 'merchant Z–A';
    default:
      return order === 'desc' ? 'newest first' : 'oldest first';
  }
}

/**
 * The fields the Filters sheet edits. Search, the search-all toggle and the sort live outside it:
 * the sort was in the sheet as well as beside it, twice over.
 */
const SHEET_FIELDS = [
  'category',
  'merchant',
  'minAmount',
  'maxAmount',
  'startDate',
  'endDate',
  'isBusinessExpense',
] as const satisfies ReadonlyArray<keyof ReceiptFilters>;

interface ReceiptSearchFiltersProps {
  filters: ReceiptFilters
  onFiltersChange: (filters: ReceiptFilters) => void
  onClearFilters: () => void
  totalResults?: number
  isSearching?: boolean
  hasHouseholdFilter?: boolean
}

export function ReceiptSearchFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  totalResults,
  isSearching = false,
  hasHouseholdFilter = false,
}: ReceiptSearchFiltersProps) {
  const [localFilters, setLocalFilters] = useState<ReceiptFilters>(filters);
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [isOpen, setIsOpen] = useState(false);
  const [showSearchTips, setShowSearchTips] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // The debounced search below fires 500 ms later; reading filters from here rather than from the
  // render that scheduled it stops it overwriting a sort or filter changed in between.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // A search cleared from outside (the "Clear search" button under an empty result) also clears
  // the box; it used to leave the old text sitting there over an unfiltered list.
  const [seenSearch, setSeenSearch] = useState(filters.search);
  if (filters.search !== seenSearch) {
    setSeenSearch(filters.search);
    if (!filters.search) setSearchValue('');
  }

  // Keyboard shortcut to focus search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounce search input
  useEffect(() => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout
    searchTimeoutRef.current = setTimeout(() => {
      const current = filtersRef.current;
      const search = searchValue || undefined;
      if (search === current.search) return;
      onFiltersChange({ ...current, search });
    }, 500); // 500ms debounce delay

    // Cleanup on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchValue]); // Only run when searchValue changes

  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => value && key !== 'sortBy' && key !== 'sortOrder' && key !== 'search' && key !== 'searchAllHouseholds',
  ).length;

  /*
   * The sheet's copy of the filters was taken once, on mount, and Apply sent that copy back
   * whole: it dropped whatever had been searched since and put back the sort from when the page
   * loaded. It is now refreshed each time the sheet opens, and Apply writes only the sheet's own
   * fields over the current filters.
   */
  const handleSheetOpenChange = (open: boolean) => {
    if (open) setLocalFilters(filters);
    setIsOpen(open);
  };

  const handleApplyFilters = () => {
    const next: ReceiptFilters = { ...filters };
    for (const field of SHEET_FIELDS) {
      next[field] = localFilters[field];
    }
    onFiltersChange(next);
    setIsOpen(false);
  };

  const handleClearAll = () => {
    const clearedFilters = {
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };
    setLocalFilters(clearedFilters);
    onClearFilters();
    setIsOpen(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  const handleSearchAllToggle = useCallback(() => {
    const newFilters = {
      ...filters,
      searchAllHouseholds: !filters.searchAllHouseholds,
    };
    onFiltersChange(newFilters);
  }, [filters, onFiltersChange]);

  const handleQuickSearch = (term: string) => {
    setSearchValue(term);
    setShowSearchTips(false);
  };

  /*
   * Quick searches.
   *
   * These were emoji chips for "Amazon" and "Walmart" — a US high street, in a
   * product that prices in euro and defaults to en-IE. Merchant names also only
   * match if that shop happens to be in your receipts, so a first-time user got
   * six chips that all returned nothing. Categories always match something.
   */
  const quickSearchSuggestions = ['Groceries', 'Dining', 'Coffee', 'Fuel', 'Shopping'];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Quick Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search receipts, merchants, or items..."
            aria-label="Search receipts"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setShowSearchTips(true)}
            onBlur={() => setTimeout(() => setShowSearchTips(false), 200)}
            className="pl-9 pr-20"
          />
          {/* Keyboard shortcut hint */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <Command className="h-3 w-3" />K
            </kbd>
          </div>

          {/* Search suggestions dropdown */}
          {showSearchTips && !searchValue && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover p-2 shadow-md">
              <p className="mb-2 px-2 text-xs text-muted-foreground">Quick searches</p>
              <div className="flex flex-wrap gap-1">
                {quickSearchSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="rounded-full border bg-muted px-3 py-1 text-xs text-foreground transition-colors hover:bg-muted/60"
                    onMouseDown={() => handleQuickSearch(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <p className="mt-2 border-t px-2 pt-2 text-xs text-muted-foreground">
                Searches merchant names, categories and individual line items.
              </p>
            </div>
          )}
        </div>

        {/* Search All Households Toggle */}
        {hasHouseholdFilter && searchValue && (
          <Button
            variant={filters.searchAllHouseholds ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleSearchAllToggle}
            className="whitespace-nowrap"
          >
            {filters.searchAllHouseholds ? 'Searching all households' : 'Search all households'}
          </Button>
        )}

        {/* Advanced Filters */}
        <Sheet open={isOpen} onOpenChange={handleSheetOpenChange}>
          <SheetTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-2 h-5 w-5 rounded-full p-0 text-xs"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
        <SheetContent className="w-full overflow-y-auto px-6 sm:max-w-lg" side="right">
          <SheetHeader className="space-y-2 pb-4">
            <SheetTitle className="text-xl font-semibold">Filter receipts</SheetTitle>
            <SheetDescription className="text-sm">
              Narrow the timeline down by category, shop, amount or date.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-6 pb-20">
            {/* Category Filter */}
            <div className="space-y-2">
              <Label htmlFor="category" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Category
              </Label>
              <Select
                value={localFilters.category || 'all'}
                onValueChange={(value) =>
                  setLocalFilters({
                    ...localFilters,
                    category: value === 'all' ? undefined : value,
                  })
                }
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                {/*
                  This list was hand-written and had drifted from the categories
                  the scanner actually assigns. It offered "Restaurant" and
                  "Retail", neither of which is in the extraction vocabulary — the
                  query is an ILIKE on the stored category, so both returned zero
                  receipts every time — while omitting dining, coffee, fuel,
                  pharmacy, travel, clothing, electronics and home entirely. It is
                  now generated from the same table the badges read.
                */}
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORY_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Merchant Filter */}
            <div className="space-y-2">
              <Label htmlFor="merchant" className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                Merchant
              </Label>
              <Input
                id="merchant"
                placeholder="Part of a shop name"
                value={localFilters.merchant || ''}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    merchant: e.target.value || undefined,
                  })
                }
              />
            </div>

            {/* Amount Range */}
            <div className="space-y-2">
              {/* Was a DollarSign in a product whose default currency is EUR. */}
              <Label className="flex items-center gap-2">
                <Coins className="h-4 w-4" aria-hidden="true" />
                Amount range
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    type="number"
                    placeholder="Min"
                    aria-label="Minimum amount"
                    value={localFilters.minAmount || ''}
                    onChange={(e) =>
                      setLocalFilters({
                        ...localFilters,
                        minAmount: e.target.value || undefined,
                      })
                    }
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Max"
                    aria-label="Maximum amount"
                    value={localFilters.maxAmount || ''}
                    onChange={(e) =>
                      setLocalFilters({
                        ...localFilters,
                        maxAmount: e.target.value || undefined,
                      })
                    }
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Date range
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    type="date"
                    aria-label="From"
                    value={localFilters.startDate || ''}
                    onChange={(e) =>
                      setLocalFilters({
                        ...localFilters,
                        startDate: e.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div>
                  <Input
                    type="date"
                    aria-label="To"
                    value={localFilters.endDate || ''}
                    onChange={(e) =>
                      setLocalFilters({
                        ...localFilters,
                        endDate: e.target.value || undefined,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Business Expense Filter */}
            <div className="space-y-2">
              <Label htmlFor="businessExpense" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" aria-hidden="true" />
                Business expenses
              </Label>
              <Select
                value={localFilters.isBusinessExpense || 'all'}
                onValueChange={(value) =>
                  setLocalFilters({
                    ...localFilters,
                    isBusinessExpense: value === 'all' ? undefined : value,
                  })
                }
              >
                <SelectTrigger id="businessExpense">
                  <SelectValue placeholder="All receipts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All receipts</SelectItem>
                  <SelectItem value="true">Business expenses only</SelectItem>
                  <SelectItem value="false">Personal expenses only</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4 sm:relative sm:mt-6 sm:border-t-0 sm:p-0">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClearAll}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Clear all
              </Button>
              <Button className="flex-1" onClick={handleApplyFilters}>
                Apply filters
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

        {/* The one sort control: each field in both directions, usual direction first. */}
        <Select
          value={`${sortField(filters.sortBy)}:${filters.sortOrder === 'asc' || filters.sortOrder === 'desc' ? filters.sortOrder : defaultSortOrder(filters.sortBy)}`}
          onValueChange={(value) => {
            const [sortBy, sortOrder] = value.split(':');
            onFiltersChange({ ...filters, sortBy, sortOrder });
          }}
        >
          <SelectTrigger className="w-full sm:w-[200px]" aria-label="Sort receipts">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_ORDERS) as SortField[]).flatMap((field) => {
              const orders = SORT_ORDERS[field];
              return (orders.default === 'asc' ? (['asc', 'desc'] as const) : (['desc', 'asc'] as const)).map((order) => (
                <SelectItem key={`${field}:${order}`} value={`${field}:${order}`}>
                  {field === 'amount' ? `${orders[order].replace(' first', '')} amount first` : field === 'merchant' ? `Merchant ${orders[order]}` : orders[order]}
                </SelectItem>
              ));
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Search Results Info */}
      {filters.search && (
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {isSearching ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-sm text-muted-foreground">Searching...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {totalResults !== undefined ? (
                      <>
                        <span className="amount font-semibold">{totalResults}</span> receipt{totalResults !== 1 ? 's' : ''} matching &ldquo;<span className="font-medium">{filters.search}</span>&rdquo;
                        {filters.searchAllHouseholds && <span className="text-muted-foreground"> across all households</span>}
                      </>
                    ) : (
                      <>Searching for &ldquo;<span className="font-medium">{filters.search}</span>&rdquo;</>
                    )}
                  </span>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchValue('');
                onFiltersChange({ ...filters, search: undefined, searchAllHouseholds: undefined });
              }}
              className="h-7 px-2 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/*
        A permanent tinted "how to search" panel used to sit here whenever the
        box was empty, repeating advice the focus dropdown above already gives —
        so the hint occupied space on the receipts page forever, for everyone,
        including people who have used the search a hundred times. The dropdown
        on focus is the right place for it.
      */}
    </div>
  );
}
