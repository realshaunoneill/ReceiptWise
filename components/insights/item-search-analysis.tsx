'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemAnalysisDialog } from '@/components/insights/item-analysis-dialog';
import { Search, TrendingUp } from 'lucide-react';

interface ItemSearchAnalysisProps {
  householdId?: string;
}

export function ItemSearchAnalysis({ householdId }: ItemSearchAnalysisProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [itemToAnalyze, setItemToAnalyze] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setItemToAnalyze(searchTerm.trim());
      setShowAnalysis(true);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
            Item spending analysis
          </CardTitle>
          <CardDescription>
            Search for any item to see your spending patterns over the past year
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              type="text"
              placeholder="e.g., Coke, Coffee, Bread..."
              aria-label="Item to analyse"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={!searchTerm.trim()}>
              <Search className="h-4 w-4 mr-2" />
              Analyze
            </Button>
          </form>
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
