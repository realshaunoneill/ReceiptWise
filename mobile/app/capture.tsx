import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Images, X } from 'lucide-react-native';
import { useTheme } from '../src/contexts/ThemeContext';
import { useMe } from '../src/hooks/useMe';
import { GUTTER, radius, space } from '../src/theme';
import Button, { success } from '../src/ui/Button';
import { Notice } from '../src/ui/Feedback';
import Text from '../src/ui/Text';
import { enqueue } from '../src/upload/runner';

const MAX_PHOTOS = 10;

/**
 * Adding receipts: a photo now, or up to ten from the photo library. They're queued at once (the
 * queue keeps its own copies, so nothing is lost without a connection) and read on the server; the
 * list shows each as "Being read" until it's done.
 */
export default function Capture() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [cameraRefused, setCameraRefused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (assets.length === 0) return;
    setBusy(true);
    try {
      await enqueue(assets.map((asset) => ({ uri: asset.uri, width: asset.width, height: asset.height })));
      success();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that photo");
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setCameraRefused(!permission.canAskAgain);
      if (permission.canAskAgain) setError('ReceiptWise needs the camera to photograph a receipt.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
    if (!result.canceled) await add(result.assets);
  };

  const choosePhotos = async () => {
    setError(null);
    // The system picker: it needs no access to the photo library, only to what's chosen.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS, quality: 1, exif: false });
    if (!result.canceled) await add(result.assets);
  };

  const premium = !!me.data?.subscribed;

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
        <Text variant="largeTitle" accessibilityRole="header">Add a receipt</Text>
        <Text variant="callout" ink="secondary">It's read for you: the shop, the date, every item and the total.</Text>
      </View>

      {!premium && me.data ? (
        <Notice tone="neutral" title="Reading receipts is part of Premium" style={{ marginTop: space.xxl }}>
          This account doesn't have Premium, so new receipts can't be read yet.
        </Notice>
      ) : (
        <View style={{ marginTop: space.xxl, gap: space.md }}>
          <BigButton icon={Camera} label="Take a photo" detail="Flat, the whole receipt in the frame, in good light" disabled={busy} onPress={() => void takePhoto()} />
          <BigButton icon={Images} label="Choose photos" detail={`Up to ${MAX_PHOTOS} at a time`} disabled={busy} onPress={() => void choosePhotos()} />
        </View>
      )}

      {cameraRefused && (
        <View style={{ marginTop: space.lg, gap: space.md }}>
          <Notice tone="warn" title="The camera is turned off for ReceiptWise">Turn it on in Settings to photograph receipts.</Notice>
          <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} />
        </View>
      )}
      {!!error && <Notice tone="bad" title="That didn't work" style={{ marginTop: space.lg }}>{error}</Notice>}
    </View>
  );
}

function BigButton({ icon: Icon, label, detail, onPress, disabled }: { icon: typeof Camera; label: string; detail: string; onPress: () => void; disabled?: boolean }) {
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
