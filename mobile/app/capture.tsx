import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Images, ScanLine, X } from 'lucide-react-native';
import { useTheme } from '../src/contexts/ThemeContext';
import { useHouseholds } from '../src/hooks/useHouseholds';
import { useMe } from '../src/hooks/useMe';
import { useScope } from '../src/scope';
import { GUTTER, radius, space } from '../src/theme';
import Button, { success } from '../src/ui/Button';
import { Segmented } from '../src/ui/Controls';
import { Notice } from '../src/ui/Feedback';
import Text from '../src/ui/Text';
import { CaptureTooLarge, enqueue, enqueueBill, type CaptureInput } from '../src/upload/runner';
import { scanDocuments } from '../src/upload/scan';

const MAX_PHOTOS = 10;
type Mode = 'receipt' | 'bill';

/**
 * Bringing something in. A receipt: scanned (each page its own receipt, one after another) or
 * chosen from the photo library, up to ten. A bill: scanned (all the pages make one bill), a PDF,
 * or photos of its pages. Everything is queued at once (the queue keeps its own copies, so nothing
 * is lost without a connection) and read on the server.
 */
export default function Capture() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const me = useMe();
  const households = useHouseholds();
  const { householdId } = useScope();
  const [mode, setMode] = useState<Mode>(params.mode === 'bill' ? 'bill' : 'receipt');
  const [busy, setBusy] = useState(false);
  const [cameraRefused, setCameraRefused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      success();
      router.back();
    } catch (e) {
      setError(e instanceof CaptureTooLarge || e instanceof Error ? e.message : "Couldn't add that");
    } finally {
      setBusy(false);
    }
  };

  const queue = (pages: CaptureInput[]) => {
    if (pages.length === 0) return;
    void done(() => (mode === 'bill' ? enqueueBill({ pages }, householdId ?? null) : enqueue(pages)));
  };

  /** The camera, for a phone with no scanner. */
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setCameraRefused(!permission.canAskAgain);
      if (permission.canAskAgain) setError(`ReceiptWise needs the camera to photograph a ${mode}.`);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
    if (!result.canceled) queue(result.assets.map((asset) => ({ uri: asset.uri, width: asset.width, height: asset.height })));
  };

  const scan = async () => {
    setError(null);
    const pages = await scanDocuments(mode === 'bill' ? MAX_PHOTOS : undefined);
    if (pages === null) return takePhoto();
    queue(pages.slice(0, MAX_PHOTOS).map((uri) => ({ uri })));
  };

  const choosePhotos = async () => {
    setError(null);
    // The system picker: it needs no access to the photo library, only to what's chosen.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS, orderedSelection: true, quality: 1, exif: false });
    if (!result.canceled) queue(result.assets.map((asset) => ({ uri: asset.uri, width: asset.width, height: asset.height })));
  };

  const choosePdf = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    const pdf = result.assets[0];
    void done(() => enqueueBill({ pdf: { uri: pdf.uri, name: pdf.name, size: pdf.size } }, householdId ?? null));
  };

  const entitlements = me.data?.entitlements;
  const canReceipts = !!me.data?.subscribed;
  // A bill goes into the plan in view; a household's needs someone in it on Premium, your own needs yours.
  const canBills = householdId ? !!entitlements?.householdIds.includes(householdId) : !!entitlements?.personal;
  const allowed = mode === 'bill' ? canBills : canReceipts;
  const into = householdId ? households.data?.find((household) => household.id === householdId)?.name : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xl, paddingHorizontal: GUTTER }}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.cardPressed : colors.card })}
      >
        <X size={22} color={colors.text} />
      </Pressable>

      <View style={{ marginTop: space.xxl, gap: space.sm }}>
        <Text variant="largeTitle" accessibilityRole="header">{mode === 'bill' ? 'Bring in a bill' : 'Add a receipt'}</Text>
        <Text variant="callout" ink="secondary">
          {mode === 'bill'
            ? `It's read for you, and the amount and due date go into ${into ? `${into}'s` : 'your'} plan.`
            : "It's read for you: the shop, the date, every item and the total."}
        </Text>
      </View>

      {me.data?.features.bills !== false && (
        <View style={{ marginTop: space.xl }}>
          <Segmented<Mode> accessibilityLabel="What it is" value={mode} onChange={(next) => { setMode(next); setError(null); }} options={[{ value: 'receipt', label: 'Receipt' }, { value: 'bill', label: 'Bill' }]} />
        </View>
      )}

      {!allowed && me.data ? (
        <Notice tone="neutral" title={mode === 'bill' ? 'Bills are part of Premium' : 'Reading receipts is part of Premium'} style={{ marginTop: space.xl }}>
          {mode === 'bill' ? "This plan isn't covered by Premium, so bills can't be read into it yet." : "This account doesn't have Premium, so new receipts can't be read yet."}
        </Notice>
      ) : (
        <View style={{ marginTop: space.xl, gap: space.md }}>
          <BigButton
            icon={ScanLine}
            label={mode === 'bill' ? 'Scan a bill' : 'Scan receipts'}
            detail={mode === 'bill' ? 'Every page, then Save: they make one bill' : 'One after another: each page is a receipt'}
            disabled={busy}
            onPress={() => void scan()}
          />
          {mode === 'bill' && <BigButton icon={FileText} label="Choose a PDF" detail="From Files, Mail or a download, up to 4 MB" disabled={busy} onPress={() => void choosePdf()} />}
          <BigButton
            icon={Images}
            label="Choose photos"
            detail={mode === 'bill' ? `The pages of one bill, in order, up to ${MAX_PHOTOS}` : `Up to ${MAX_PHOTOS} at a time`}
            disabled={busy}
            onPress={() => void choosePhotos()}
          />
          {mode === 'bill' && <Text variant="footnote" ink="muted">A bigger PDF, or bills that arrive by email: forward them to your ReceiptWise address, in Settings.</Text>}
        </View>
      )}

      {cameraRefused && (
        <View style={{ marginTop: space.lg, gap: space.md }}>
          <Notice tone="warn" title="The camera is turned off for ReceiptWise">{`Turn it on in Settings to photograph ${mode}s.`}</Notice>
          <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} />
        </View>
      )}
      {!!error && <Notice tone="bad" title="That didn't work" style={{ marginTop: space.lg }}>{error}</Notice>}
    </View>
  );
}

function BigButton({ icon: Icon, label, detail, onPress, disabled }: { icon: typeof ScanLine; label: string; detail: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, borderRadius: radius.xl,
        backgroundColor: pressed ? colors.cardPressed : colors.card, borderWidth: 1, borderColor: colors.border, opacity: disabled ? 0.5 : 1,
      })}
    >
      <View style={{ width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={24} color={colors.accent} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{label}</Text>
        <Text variant="footnote" ink="muted">{detail}</Text>
      </View>
    </Pressable>
  );
}
