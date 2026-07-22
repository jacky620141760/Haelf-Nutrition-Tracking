import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addLocalDays, parseLocalDateToDate, weekDates } from '@/src/domain/dates';
import type { AppLocale } from '@/src/domain/types';
import { theme } from '@/src/theme';
import { useApp } from '@/src/context/AppContext';

type Props = {
  selectedDate: string;
  todayDate: string;
  weekStart: 0 | 1;
  locale: AppLocale;
  onSelect: (date: string) => void;
};

export function WeekDateStrip({
  selectedDate,
  todayDate,
  weekStart,
  locale,
  onSelect,
}: Props) {
  const { t } = useApp();
  const dates = weekDates(selectedDate, weekStart);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.arrow}
        onPress={() => onSelect(addLocalDays(selectedDate, -7))}
        accessibilityRole="button"
        accessibilityLabel={t('diary.previousDay')}
      >
        <Text style={styles.arrowText}>‹</Text>
      </Pressable>
      {dates.map((date) => {
        const selected = date === selectedDate;
        const today = date === todayDate;
        return (
          <Pressable
            key={date}
            style={[styles.day, selected && styles.daySelected]}
            onPress={() => onSelect(date)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={date}
          >
            <Text style={[styles.weekday, selected && styles.selectedText]}>
              {weekday.format(parseLocalDateToDate(date))}
            </Text>
            <Text style={[styles.number, selected && styles.selectedText]}>
              {Number(date.slice(-2))}
            </Text>
            {today ? <View style={[styles.dot, selected && styles.dotSelected]} /> : null}
          </Pressable>
        );
      })}
      <Pressable
        style={styles.arrow}
        onPress={() => onSelect(addLocalDays(selectedDate, 7))}
        accessibilityRole="button"
        accessibilityLabel={t('diary.nextDay')}
      >
        <Text style={styles.arrowText}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space.xs,
    paddingVertical: theme.space.sm,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  arrow: { width: 28, minHeight: theme.minTouch, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: theme.colors.lakeBlue, fontSize: 24, fontWeight: '700' },
  day: { flex: 1, minHeight: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: theme.colors.lakeBlue },
  weekday: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  number: { color: theme.colors.text, fontWeight: '700', marginTop: 2 },
  selectedText: { color: '#FFFFFF' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.lakeBlue, marginTop: 2 },
  dotSelected: { backgroundColor: '#FFFFFF' },
});
