import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { ReceiptText, SearchX, SlidersHorizontal } from 'lucide-react-native';
import { localToday } from '@shared/dates/local-date';
import { useCaptureAction } from '../../../src/components/CaptureButton';
import ReceiptRow from '../../../src/components/ReceiptRow';
import UploadStatus from '../../../src/components/UploadStatus';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useMe } from '../../../src/hooks/useMe';
import { useReceipts } from '../../../src/hooks/useReceipts';
import { activeFilterCount, setReceiptFilters, useReceiptFilters } from '../../../src/receipts/filters';
import { groupByDay, type ReceiptRow as Row } from '../../../src/receipts/group';
import { GUTTER, radius, space } from '../../../src/theme';
import Button from '../../../src/ui/Button';
import { EmptyState, LoadError, Skeleton } from '../../../src/ui/Feedback';
import { headerActions } from '../../../src/ui/HeaderButton';
import { usePullToRefresh } from '../../../src/ui/usePullToRefresh';
import Text from '../../../src/ui/Text';

/**
 * Every receipt, newest day first, a page at a time; search in the header, the rest in the Filters
 * sheet. Sorted by amount or shop, the list drops its day headings: they'd repeat on every row.
 */
export default function Receipts() {
  const { colors } = useTheme();
  const router = useRouter();
  const capture = useCaptureAction();
  const me = useMe();
  const filters = useReceiptFilters();
  const [search, setSearch] = useState('');
  const query = useReceipts({ ...filters, search: search.trim() || undefined });
  const receipts = useMemo(() => query.data?.pages.flatMap((page) => page.receipts) ?? [], [query.data]);
  const byDay = (filters.sortBy ?? 'date') === 'date';
  const rows = useMemo<Row[]>(
    () => (byDay ? groupByDay(receipts, localToday(), me.data?.currency ?? 'EUR') : receipts.map((receipt) => ({ type: 'receipt', key: receipt.id, receipt }))),
    [receipts, me.data?.currency, byDay],
  );
  const narrowed = activeFilterCount(filters);
  const pull = usePullToRefresh(() => query.refetch());
  const total = query.data?.pages[0]?.pagination.total;

  const header = (
    <>
      <View style={{ height: Platform.OS === 'web' ? 64 : space.sm }} />
      <UploadStatus />
      {narrowed > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: GUTTER + space.xs, marginBottom: space.sm }}>
          <Text variant="footnote" ink="muted">
            {`${narrowed === 1 ? '1 filter' : `${narrowed} filters`}${total !== undefined ? ` · ${total === 1 ? '1 receipt' : `${total} receipts`}` : ''}`}
          </Text>
          <Button label="Clear" variant="plain" size="sm" onPress={() => setReceiptFilters({ householdId: filters.householdId })} />
        </View>
      )}
    </>
  );

  let empty: React.ReactElement | null = null;
  if (query.isPending) {
    empty = (
      <View style={{ marginHorizontal: GUTTER, gap: space.lg }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={56} round={radius.lg} />)}
      </View>
    );
  } else if (query.isError && receipts.length === 0) {
    empty = <LoadError message={query.error.message} onRetry={() => void query.refetch()} />;
  } else if (search.trim()) {
    empty = <EmptyState icon={SearchX} title="Nothing matches" body={`No receipt mentions "${search.trim()}".`} />;
  } else if (narrowed > 0) {
    empty = <EmptyState icon={SearchX} title="Nothing matches" body="No receipt fits these filters." action={{ label: 'Clear filters', onPress: () => setReceiptFilters({ householdId: filters.householdId }) }} />;
  } else {
    empty = (
      <EmptyState
        icon={ReceiptText}
        title="No receipts yet"
        body="Photograph a receipt and it's read for you: the shop, the items and the total."
        action={me.data?.subscribed ? { label: 'Add a receipt', onPress: () => router.push('/capture') } : undefined}
      />
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          ...headerActions([
            { label: 'Filters', sfSymbol: 'line.3.horizontal.decrease.circle', icon: SlidersHorizontal, badge: narrowed || undefined, onPress: () => router.push('/sheets/receipt-filters') },
            capture,
          ]),
          headerSearchBarOptions: {
            placeholder: 'Search receipts',
            onChangeText: (event) => setSearch(event.nativeEvent.text),
            onCancelButtonPress: () => setSearch(''),
            hideWhenScrolling: true,
          },
        }}
      />
      <FlashList<Row>
        data={rows}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.type}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        // Another search, filter or household on its way: the last list stays, dimmed.
        style={{ backgroundColor: colors.background, opacity: query.isPlaceholderData ? 0.5 : 1 }}
        contentContainerStyle={{ paddingBottom: space.xxxl * 2 }}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.textMuted} />}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator style={{ margin: space.xl }} color={colors.textMuted} /> : null}
        renderItem={({ item, index }) => {
          if (item.type === 'day') {
            // A day with one receipt shows no total or count: they only repeated the row below.
            return (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: GUTTER + space.xs, paddingTop: index === 0 ? space.sm : space.xl, paddingBottom: space.sm }}>
                <Text variant="label" accessibilityRole="header">{item.label}</Text>
                {item.count > 1 && <Text variant="footnote" ink="muted" tabular>{`${item.total ? `${item.total} · ` : ''}${item.count} receipts`}</Text>}
              </View>
            );
          }
          // Rows sit on one card per day: round its top on the first row and its bottom on the last.
          const first = index === 0 || rows[index - 1]?.type === 'day';
          const last = rows[index + 1]?.type !== 'receipt';
          return (
            <View
              style={{
                marginHorizontal: GUTTER,
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderLeftWidth: StyleSheet.hairlineWidth,
                borderRightWidth: StyleSheet.hairlineWidth,
                borderTopWidth: first ? StyleSheet.hairlineWidth : 0,
                borderBottomWidth: last ? StyleSheet.hairlineWidth : 0,
                borderTopLeftRadius: first ? radius.lg : 0,
                borderTopRightRadius: first ? radius.lg : 0,
                borderBottomLeftRadius: last ? radius.lg : 0,
                borderBottomRightRadius: last ? radius.lg : 0,
                overflow: 'hidden',
              }}
            >
              {!first && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: 72 }} />}
              {/* Under a day's heading the row doesn't repeat the day. */}
              <ReceiptRow receipt={item.receipt} when={byDay ? 'none' : 'day'} />
            </View>
          );
        }}
      />
    </>
  );
}
