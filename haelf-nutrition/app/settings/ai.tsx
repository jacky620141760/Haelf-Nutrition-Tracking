import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/src/context/AppContext';
import { getAiSettings, saveAiSettings } from '@/src/db/repositories/aiSettings';
import { getApiKey, saveApiKey, isWebPreview } from '@/src/services/secureStore';
import { Field, PrimaryButton, SectionTitle } from '@/src/components/ui';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';

export default function AiSettingsScreen() {
  const { isWeb } = useApp();
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [originalEndpoint, setOriginalEndpoint] = useState('');
  const [originalModel, setOriginalModel] = useState('');

  useEffect(() => {
    (async () => {
      const s = await getAiSettings();
      setEndpoint(s.endpointUrl);
      setModel(s.model);
      setOriginalEndpoint(s.endpointUrl);
      setOriginalModel(s.model);
      const key = await getApiKey();
      setApiKey(key ?? '');
    })();
  }, []);

  const onSave = async () => {
    const resetCapability =
      endpoint.trim() !== originalEndpoint.trim() || model.trim() !== originalModel.trim();
    await saveAiSettings({
      endpointUrl: endpoint.trim(),
      model: model.trim(),
      resetCapability,
    });
    await saveApiKey(apiKey.trim());
    setOriginalEndpoint(endpoint.trim());
    setOriginalModel(model.trim());
    Alert.alert('已儲存 AI 設定');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle title={zhTW.ai.settings} />
      {(isWeb || isWebPreview()) && (
        <View style={styles.warn} accessibilityRole="alert">
          <Text style={styles.warnText}>{zhTW.ai.webKeyWarning}</Text>
        </View>
      )}
      <Field
        label={zhTW.ai.endpoint}
        value={endpoint}
        onChangeText={setEndpoint}
        autoCapitalize="none"
        placeholder="https://api.deepseek.com/v1"
      />
      <Field label={zhTW.ai.model} value={model} onChangeText={setModel} autoCapitalize="none" />
      <Field
        label={zhTW.ai.apiKey}
        value={apiKey}
        onChangeText={setApiKey}
        autoCapitalize="none"
        secureTextEntry
      />
      <PrimaryButton label={zhTW.common.save} onPress={onSave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md },
  warn: {
    backgroundColor: theme.colors.warningBg,
    padding: theme.space.md,
    borderRadius: theme.radius,
    marginBottom: theme.space.md,
  },
  warnText: { color: theme.colors.warning, fontWeight: '600' },
});
