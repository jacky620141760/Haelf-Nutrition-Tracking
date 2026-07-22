import { Alert, Platform } from 'react-native';

export async function confirmDialog(
  title: string,
  message: string,
  labels: { confirm: string; cancel: string }
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return globalThis.confirm(`${title}\n\n${message}`);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: labels.cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: labels.confirm, onPress: () => resolve(true) },
    ]);
  });
}

export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    globalThis.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export async function chooseAction(
  title: string,
  actions: { label: string; destructive?: boolean }[],
  cancelLabel: string
): Promise<number | null> {
  if (Platform.OS === 'web') {
    const list = actions.map((action, index) => `${index + 1}. ${action.label}`).join('\n');
    const answer = globalThis.prompt(`${title}\n\n${list}`);
    if (answer == null) return null;
    const index = Number(answer) - 1;
    return Number.isInteger(index) && index >= 0 && index < actions.length ? index : null;
  }
  return new Promise((resolve) => {
    Alert.alert(title, undefined, [
      ...actions.map((action, index) => ({
        text: action.label,
        style: action.destructive ? ('destructive' as const) : ('default' as const),
        onPress: () => resolve(index),
      })),
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}
