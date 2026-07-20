import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { theme } from '@/src/theme';

export function PrimaryButton({
  label,
  onPress,
  disabled,
  danger,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.btn,
        danger && styles.btnDanger,
        disabled && styles.btnDisabled,
        pressed && !disabled && styles.btnPressed,
      ]}
    >
      <Text style={[styles.btnText, danger && styles.btnTextDanger]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...props
}: { label: string; error?: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label} accessibilityRole="text">
        {label}
      </Text>
      <TextInput
        {...props}
        style={[styles.input, error ? styles.inputError : null, props.style]}
        placeholderTextColor={theme.colors.textMuted}
        accessibilityLabel={label}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return (
    <Text style={styles.section} accessibilityRole="header">
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: theme.minTouch,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDanger: {
    backgroundColor: theme.colors.danger,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnText: {
    color: '#fff',
    fontSize: theme.font.body,
    fontWeight: '600',
  },
  btnTextDanger: {
    color: '#fff',
  },
  field: {
    marginBottom: theme.space.md,
  },
  label: {
    fontSize: theme.font.small,
    color: theme.colors.textMuted,
    marginBottom: theme.space.xs,
  },
  input: {
    minHeight: theme.minTouch,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space.md,
    fontSize: theme.font.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.bgElevated,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.font.small,
    marginTop: theme.space.xs,
  },
  section: {
    fontSize: theme.font.title,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.space.md,
  },
});
