import { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { theme } from '@/src/theme';

export function MfpButton({
  label,
  onPress,
  disabled,
  danger,
  variant = 'primary',
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  accessibilityHint?: string;
}) {
  const isPrimary = variant === 'primary' || danger;
  const isSecondary = variant === 'secondary';
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
        isPrimary && styles.btnPrimary,
        danger && styles.btnDanger,
        isSecondary && styles.btnSecondary,
        variant === 'outline' && styles.btnOutline,
        disabled && styles.btnDisabled,
        pressed && !disabled && isPrimary && styles.btnPrimaryPressed,
        pressed && !disabled && isSecondary && styles.btnSecondaryPressed,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          isPrimary && styles.btnTextOnPrimary,
          isSecondary && styles.btnTextSecondary,
          variant === 'outline' && styles.btnTextOutline,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Back-compat alias used across screens. */
export function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  accessibilityHint?: string;
}) {
  return <MfpButton {...props} variant={props.danger ? 'primary' : 'primary'} />;
}

export const Field = forwardRef<
  TextInput,
  { label: string; error?: string } & TextInputProps
>(function Field({ label, error, ...props }, ref) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        ref={ref}
        style={[styles.input, error ? styles.inputError : null, props.style]}
        placeholderTextColor={theme.colors.textMute}
        accessibilityLabel={label}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

export function SectionTitle({ title }: { title: string }) {
  return (
    <Text style={styles.section} accessibilityRole="header">
      {title}
    </Text>
  );
}

export function MfpCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: theme.colors.lakeBlue,
  },
  btnPrimaryPressed: {
    backgroundColor: theme.colors.lakeBluePressed,
    transform: [{ scale: 0.98 }],
  },
  btnDanger: {
    backgroundColor: theme.colors.danger,
  },
  btnSecondary: {
    backgroundColor: theme.colors.skyBlue,
  },
  btnSecondaryPressed: {
    opacity: 0.85,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: {
    fontSize: theme.font.button,
    fontWeight: '600',
  },
  btnTextOnPrimary: { color: '#FFFFFF' },
  btnTextSecondary: { color: theme.colors.lakeBlue },
  btnTextOutline: { color: theme.colors.text },
  field: { marginBottom: theme.space.md },
  label: {
    fontSize: theme.font.bodySmall,
    color: theme.colors.textMuted,
    marginBottom: theme.space.xs,
    fontWeight: '500',
  },
  input: {
    minHeight: theme.minTouch,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space.md,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  inputError: { borderColor: theme.colors.danger },
  error: {
    color: theme.colors.danger,
    fontSize: theme.font.bodySmall,
    marginTop: theme.space.xs,
  },
  section: {
    fontSize: theme.font.navTitle,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.space.md,
  },
  card: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radiusCard,
    padding: theme.space.md,
    marginBottom: theme.space.md,
  },
});
