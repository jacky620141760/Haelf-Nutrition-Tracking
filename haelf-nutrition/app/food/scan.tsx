import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { getBarcodeCache, normalizeBarcode } from '@/src/db/repositories/barcode';
import { fetchOpenFoodFacts } from '@/src/services/off';
import { setPendingDraft } from '@/src/services/draftStore';
import { PrimaryButton } from '@/src/components/ui';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';
import type { MealType } from '@/src/domain/types';

export default function ScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: string }>();
  const meal: MealType = ['breakfast', 'lunch', 'dinner', 'snack'].includes(params.meal ?? '')
    ? (params.meal as MealType)
    : 'snack';
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const locked = useRef(false);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => () => requestController.current?.abort(), []);

  const handleBarcode = async (result: BarcodeScanningResult) => {
    if (locked.current || busy) return;
    locked.current = true;
    setBusy(true);
    const code = normalizeBarcode(result.data);
    try {
      const cached = await getBarcodeCache(code).catch(() => null);
      if (cached) {
        setPendingDraft({
          name: cached.name,
          mealType: meal,
          basis: cached.basis,
          sourceKcal: cached.sourceKcal,
          sourceProteinG: cached.sourceProteinG,
          sourceFatG: cached.sourceFatG,
          sourceCarbsG: cached.sourceCarbsG,
          quantity: cached.basis === 'PER_100_G' ? 100 : 1,
          source: 'cache',
          barcode: cached.barcode,
          dataQualityWarnings: [],
        });
        router.replace('/food/add');
        return;
      }

      const net = await NetInfo.fetch();
      if (net.isConnected === false) {
        setMessage(zhTW.barcode.offlineNoCache);
        setBusy(false);
        locked.current = false;
        return;
      }

      const controller = new AbortController();
      requestController.current = controller;
      const off = await fetchOpenFoodFacts(code, meal, controller.signal);
      requestController.current = null;
      if (!off.ok) {
        setMessage(
          off.reason === 'cancelled'
            ? '已取消查詢'
            : off.reason === 'timeout'
            ? zhTW.barcode.timeout
            : off.reason === 'not_found'
              ? zhTW.barcode.notFound
              : zhTW.barcode.networkError
        );
        setBusy(false);
        locked.current = false;
        return;
      }
      setPendingDraft(off.draft);
      router.replace('/food/add');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : zhTW.barcode.networkError);
      setBusy(false);
      locked.current = false;
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>{zhTW.common.loading}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>
          {permission.canAskAgain
            ? zhTW.barcode.permission
            : '相機權限已被拒絕。請前往系統設定開啟相機權限，或改用手動新增。'}
        </Text>
        {permission.canAskAgain ? (
          <PrimaryButton label={zhTW.barcode.grant} onPress={requestPermission} />
        ) : (
          <PrimaryButton
            label="開啟系統設定"
            onPress={() => void Linking.openSettings()}
          />
        )}
        <PrimaryButton
          label={zhTW.barcode.useManual}
          onPress={() => router.replace('/food/add')}
        />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>Web 預覽條碼掃描功能有限，請改用手動新增或輸入測試流程。</Text>
        <PrimaryButton label={zhTW.barcode.useManual} onPress={() => router.replace('/food/add')} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
        onBarcodeScanned={busy ? undefined : handleBarcode}
      />
      <View style={styles.overlay}>
        {busy ? (
          <View style={styles.msgBox}>
            <Text style={styles.text}>{zhTW.common.loading}</Text>
            <PrimaryButton
              label={zhTW.common.cancel}
              onPress={() => requestController.current?.abort()}
            />
          </View>
        ) : null}
        {message ? (
          <View style={styles.msgBox}>
            <Text style={styles.text}>{message}</Text>
            <PrimaryButton
              label={zhTW.common.retry}
              onPress={() => {
                setMessage('');
                locked.current = false;
                setBusy(false);
              }}
            />
            <PrimaryButton label={zhTW.barcode.useManual} onPress={() => router.replace('/food/add')} />
          </View>
        ) : (
          <Text style={styles.hint}>將條碼置於框內</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.lg,
    gap: theme.space.md,
    backgroundColor: theme.colors.bg,
  },
  overlay: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    gap: theme.space.sm,
  },
  msgBox: { backgroundColor: 'rgba(0,0,0,0.7)', padding: theme.space.md, borderRadius: theme.radius, gap: theme.space.sm },
  text: { color: '#fff', textAlign: 'center' },
  permissionText: { color: theme.colors.text, textAlign: 'center', lineHeight: 22 },
  hint: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});
