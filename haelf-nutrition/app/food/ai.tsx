import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useApp } from '@/src/context/AppContext';
import { getAiSettings, setAiConsent, setVisionCapability } from '@/src/db/repositories/aiSettings';
import { analyzeFoodWithAi, checkVisionCapability } from '@/src/services/ai/client';
import { setPendingDraft } from '@/src/services/draftStore';
import { Field, PrimaryButton } from '@/src/components/ui';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';

/** Strip EXIF by re-encoding via base64 from picker (picker typically strips location on modern OS). */
async function pickImageStripped(): Promise<{ base64: string; uri: string; mime: string } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    base64: true,
    exif: false,
  });
  if (result.canceled || !result.assets[0]?.base64) return null;
  const asset = result.assets[0];
  return {
    base64: asset.base64!,
    uri: asset.uri,
    mime: asset.mimeType ?? 'image/jpeg',
  };
}

export default function AiFoodScreen() {
  const router = useRouter();
  const { isWeb } = useApp();
  const [text, setText] = useState('');
  const [image, setImage] = useState<{ base64: string; uri: string; mime: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [consent, setConsent] = useState(false);
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [visionOk, setVisionOk] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const s = await getAiSettings();
      setConsent(s.consentGiven);
      setEndpoint(s.endpointUrl);
      setModel(s.model);
      setVisionOk(s.visionSupported);
    })();
  }, []);

  const ensureConsent = async (): Promise<boolean> => {
    if (consent) return true;
    return new Promise((resolve) => {
      Alert.alert(zhTW.ai.consentTitle, zhTW.ai.consentBody, [
        { text: zhTW.common.cancel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: zhTW.ai.consentAgree,
          onPress: async () => {
            await setAiConsent(true);
            setConsent(true);
            resolve(true);
          },
        },
      ]);
    });
  };

  const onAnalyze = async () => {
    if (!endpoint || !model) {
      Alert.alert('請先完成 AI 設定', undefined, [
        { text: '前往設定', onPress: () => router.push('/settings/ai') },
        { text: zhTW.common.cancel, style: 'cancel' },
      ]);
      return;
    }
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      Alert.alert('無網路', undefined, [
        { text: zhTW.barcode.useManual, onPress: () => router.replace('/food/add') },
      ]);
      return;
    }
    const ok = await ensureConsent();
    if (!ok) return;

    setBusy(true);
    setStatus(zhTW.common.loading);
    try {
      let useImage = !!image;
      if (useImage) {
        let cap = visionOk;
        if (cap !== true) {
          setStatus('檢查模型能力…');
          const result = await checkVisionCapability(endpoint, model);
          if (result === 'supported') {
            cap = true;
            await setVisionCapability(true);
            setVisionOk(true);
          } else {
            await setVisionCapability(result === 'unsupported' ? false : null);
            setVisionOk(result === 'unsupported' ? false : null);
            useImage = false;
            setStatus(zhTW.ai.capabilityFail);
            Alert.alert(zhTW.ai.capabilityFail);
            if (!text.trim()) {
              setBusy(false);
              return;
            }
          }
        }
      }

      if (!useImage && !text.trim()) {
        Alert.alert('請提供文字描述或可分析的圖片');
        setBusy(false);
        return;
      }

      const result = await analyzeFoodWithAi({
        endpointUrl: endpoint,
        model,
        text: text.trim() || undefined,
        imageBase64: useImage ? image?.base64 : undefined,
        mimeType: useImage ? image?.mime : undefined,
      });

      // Clear temp
      setImage(null);

      if (!result.ok) {
        Alert.alert(result.message, undefined, [
          { text: zhTW.common.retry, onPress: () => {} },
          { text: zhTW.barcode.useManual, onPress: () => router.replace('/food/add') },
        ]);
        setBusy(false);
        setStatus('');
        return;
      }

      const s = result.suggestion;
      setPendingDraft({
        name: s.name,
        mealType: 'snack',
        basis: s.basis,
        sourceKcal: s.kcal,
        sourceProteinG: s.protein_g,
        sourceFatG: s.fat_g,
        sourceCarbsG: s.carbs_g,
        quantity: s.quantity,
        source: 'ai',
        confidence: s.confidence,
        dataQualityWarnings: [],
      });
      router.replace('/food/add');
    } catch (e) {
      Alert.alert(e instanceof Error ? e.message : '錯誤');
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {isWeb ? (
        <Text style={styles.warn}>{zhTW.ai.webKeyWarning}</Text>
      ) : null}
      <Text style={styles.hint}>
        {zhTW.ai.sendExternal}：{image ? '圖片' : ''}
        {image && text ? ' + ' : ''}
        {text ? '文字' : ''}
      </Text>
      <Field
        label={zhTW.ai.textDesc}
        value={text}
        onChangeText={setText}
        multiline
        style={{ minHeight: 88, textAlignVertical: 'top' }}
      />
      {image ? (
        <Image source={{ uri: image.uri }} style={styles.preview} accessibilityLabel="已選圖片" />
      ) : null}
      <PrimaryButton
        label={zhTW.ai.pickImage}
        onPress={async () => {
          const img = await pickImageStripped();
          if (img) setImage(img);
        }}
        disabled={busy}
      />
      <View style={{ height: theme.space.sm }} />
      <PrimaryButton
        label={busy ? status || zhTW.common.loading : zhTW.ai.analyze}
        onPress={onAnalyze}
        disabled={busy}
      />
      <View style={{ height: theme.space.md }} />
      <PrimaryButton
        label={zhTW.ai.consentWithdraw}
        onPress={async () => {
          await setAiConsent(false);
          setConsent(false);
          Alert.alert('已撤回同意');
        }}
      />
      <View style={{ height: theme.space.sm }} />
      <PrimaryButton label={zhTW.barcode.useManual} onPress={() => router.replace('/food/add')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md },
  warn: {
    backgroundColor: theme.colors.warningBg,
    color: theme.colors.warning,
    padding: theme.space.md,
    marginBottom: theme.space.md,
    fontWeight: '600',
  },
  hint: { marginBottom: theme.space.md, color: theme.colors.accent, fontWeight: '600' },
  preview: { width: '100%', height: 180, borderRadius: theme.radius, marginBottom: theme.space.md },
});
