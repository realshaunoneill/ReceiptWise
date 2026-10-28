'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemAnalysisDialog } from '@/components/insights/item-analysis-dialog';
import { useTopItems } from '@/hooks/use-top-items';
import { Search, TrendingUp } from 'lucide-react';

interface ItemSearchAnalysisProps {
  householdId?: string;
}

/**
 * Any item's history over the past year (the app's Insights › Items). It was a bare search box with
 * nothing to start from: the items bought most are underneath, one click each.
 */
export function ItemSearchAnalysis({ householdId }: ItemSearchAnalysisProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [itemToAnalyze, setItemToAnalyze] = useState('');
  const { data: top } = useTopItems({ householdId, months: 12, limit: 12, sortBy: 'frequency' });
  // The same thing bought in two currencies is two rows there; one chip is enough.
  const mostBought = [...new Set((top?.topItems ?? []).map((item) => item.name))];

  const open = (name: string) => {
    setItemToAnalyze(name);
    setShowAnalysis(true);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) open(searchTerm.trim());
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
            Item history
          </CardTitle>
          <CardDescription>
            Every time you bought something over the past year: where, how often and what it cost.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              type="text"
              placeholder="Coffee, milk, bread…"
              aria-label="Item to look up"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={!searchTerm.trim()}>
              <Search className="h-4 w-4 mr-2" aria-hidden="true" />
              Look it up
            </Button>
          </form>

          {mostBought.length > 0 && (
            <div className="space-y-2">
              <p id="most-bought" className="text-xs font-medium text-muted-foreground">Your most bought</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="most-bought">
                {mostBought.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => open(name)}
                    className="min-h-9 rounded-full border px-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {itemToAnalyze && (
        <ItemAnalysisDialog
          itemName={itemToAnalyze}
          open={showAnalysis}
          onOpenChange={setShowAnalysis}
          householdId={householdId}
        />
      )}
    </>
  );
}
