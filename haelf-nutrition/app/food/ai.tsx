import { useEffect, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useApp } from '@/src/context/AppContext';
import { getAiSettings, setAiConsent, setVisionCapability } from '@/src/db/repositories/aiSettings';
import { analyzeFoodWithAi, checkVisionCapability } from '@/src/services/ai/client';
import { setPendingDraft } from '@/src/services/draftStore';
import { Field, PrimaryButton } from '@/src/components/ui';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';
import type { MealType } from '@/src/domain/types';
import { confirmDialog } from '@/src/services/dialog';

type PickedImage = { base64: string; uri: string; mime: string; tempUri: string };

function deleteTemporaryImage(uri?: string): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Cache cleanup is best-effort; the OS can still evict this file.
  }
}

async function readUriAsBase64(uri: string): Promise<string> {
  try {
    return await new File(uri).base64();
  } catch {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error('無法讀取圖片'));
      reader.onload = () => {
        const dataUrl = String(reader.result ?? '');
        resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
      };
      reader.readAsDataURL(blob);
    });
  }
}

/** Re-encode into a new JPEG cache file so source EXIF is not transmitted. */
async function pickImageStripped(): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    base64: false,
    exif: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  const rendered = await context.renderAsync();
  const encoded = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.7,
  });
  try {
    return {
      base64: await readUriAsBase64(encoded.uri),
      uri: encoded.uri,
      tempUri: encoded.uri,
      mime: 'image/jpeg',
    };
  } catch (error) {
    deleteTemporaryImage(encoded.uri);
    throw error;
  }
}

type AnalyzeRequest = {
  endpointUrl: string;
  model: string;
  text?: string;
  imageBase64?: string;
  mimeType?: string;
  tempUri?: string;
};

export default function AiFoodScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: string }>();
  const meal: MealType = ['breakfast', 'lunch', 'dinner', 'snack'].includes(params.meal ?? '')
    ? (params.meal as MealType)
    : 'snack';
  const { isWeb } = useApp();
  const [text, setText] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [consent, setConsent] = useState(false);
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [visionOk, setVisionOk] = useState<boolean | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const imageRef = useRef<PickedImage | null>(null);

  const replaceImage = (next: PickedImage | null) => {
    if (imageRef.current?.tempUri !== next?.tempUri) {
      deleteTemporaryImage(imageRef.current?.tempUri);
    }
    imageRef.current = next;
    setImage(next);
  };

  useEffect(() => {
    (async () => {
      const s = await getAiSettings();
      setConsent(s.consentGiven);
      setEndpoint(s.endpointUrl);
      setModel(s.model);
      setVisionOk(s.visionSupported);
    })();
  }, []);

  useEffect(
    () => () => {
      requestController.current?.abort();
      deleteTemporaryImage(imageRef.current?.tempUri);
    },
    []
  );

  const ensureConsent = async (): Promise<boolean> => {
    if (consent) return true;
    const accepted = await confirmDialog(zhTW.ai.consentTitle, zhTW.ai.consentBody, {
      cancel: zhTW.common.cancel,
      confirm: zhTW.ai.consentAgree,
    });
    if (accepted) {
      await setAiConsent(true);
      setConsent(true);
    }
    return accepted;
  };

  const runAnalyze = async (request: AnalyzeRequest) => {
    const controller = new AbortController();
    requestController.current = controller;
    setBusy(true);
    setStatus(zhTW.common.loading);
    try {
      let useImage = !!request.imageBase64;
      if (useImage) {
        let cap = visionOk;
        if (cap !== true) {
          setStatus('檢查模型能力…');
          const result = await checkVisionCapability(
            request.endpointUrl,
            request.model,
            controller.signal
          );
          if (controller.signal.aborted) return;
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
            if (!request.text?.trim()) return;
          }
        }
      }

      if (!useImage && !request.text?.trim()) {
        Alert.alert('請提供文字描述或可分析的圖片');
        return;
      }

      const result = await analyzeFoodWithAi({
        endpointUrl: request.endpointUrl,
        model: request.model,
        text: request.text?.trim() || undefined,
        imageBase64: useImage ? request.imageBase64 : undefined,
        mimeType: useImage ? request.mimeType : undefined,
        signal: controller.signal,
      });

      if (!result.ok) {
        if (result.reason === 'cancelled') {
          setStatus('已取消');
          return;
        }
        Alert.alert(result.message, undefined, [
          { text: zhTW.common.retry, onPress: () => void runAnalyze(request) },
          { text: zhTW.barcode.useManual, onPress: () => router.replace('/food/add') },
        ], { cancelable: false });
        return;
      }

      const s = result.suggestion;
      setPendingDraft({
        name: s.name,
        mealType: meal,
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
      requestController.current = null;
      deleteTemporaryImage(request.tempUri);
      if (!request.tempUri || imageRef.current?.tempUri === request.tempUri) {
        imageRef.current = null;
        setImage(null);
      }
      setBusy(false);
      setStatus('');
    }
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
    if (net.isConnected === false) {
      Alert.alert('無網路', undefined, [
        { text: zhTW.barcode.useManual, onPress: () => router.replace('/food/add') },
      ]);
      return;
    }
    const ok = await ensureConsent();
    if (!ok) return;
    await runAnalyze({
      endpointUrl: endpoint,
      model,
      text: text.trim() || undefined,
      imageBase64: image?.base64,
      mimeType: image?.mime,
      tempUri: image?.tempUri,
    });
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
          if (img) replaceImage(img);
        }}
        disabled={busy}
      />
      <View style={{ height: theme.space.sm }} />
      <PrimaryButton
        label={busy ? status || zhTW.common.loading : zhTW.ai.analyze}
        onPress={onAnalyze}
        disabled={busy}
      />
      {busy ? (
        <>
          <View style={{ height: theme.space.sm }} />
          <PrimaryButton
            label={zhTW.common.cancel}
            onPress={() => requestController.current?.abort()}
          />
        </>
      ) : null}
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
  hint: { marginBottom: theme.space.md, color: theme.colors.lakeBlue, fontWeight: '600' },
  preview: { width: '100%', height: 180, borderRadius: theme.radius, marginBottom: theme.space.md },
});
