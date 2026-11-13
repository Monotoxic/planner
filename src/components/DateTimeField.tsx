import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { combineDateAndTime, formatDate, formatTime } from '../utils/dates';

interface Props {
  value: Date;
  onChange: (date: Date) => void;
}

/** Выбор даты и времени: на iOS встроенные «компактные» пикеры, на Android системные диалоги. */
export function DateTimeField({ value, onChange }: Props) {
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.row}>
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          locale="ru-RU"
          onChange={(_event: DateTimePickerEvent, date?: Date) => {
            if (date) onChange(combineDateAndTime(date, value));
          }}
        />
        <DateTimePicker
          value={value}
          mode="time"
          display="compact"
          locale="ru-RU"
          onChange={(_event: DateTimePickerEvent, date?: Date) => {
            if (date) onChange(combineDateAndTime(value, date));
          }}
        />
      </View>
    );
  }

  const open = (mode: 'date' | 'time') => {
    DateTimePickerAndroid.open({
      value,
      mode,
      is24Hour: true,
      onChange: (event: DateTimePickerEvent, date?: Date) => {
        if (event.type !== 'set' || !date) return;
        onChange(mode === 'date' ? combineDateAndTime(date, value) : combineDateAndTime(value, date));
      },
    });
  };

  return (
    <View style={styles.row}>
      <Pressable style={styles.button} onPress={() => open('date')} accessibilityRole="button">
        <Text style={styles.buttonText}>{formatDate(value)}</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => open('time')} accessibilityRole="button">
        <Text style={styles.buttonText}>{formatTime(value)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  button: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonText: { fontSize: 16, color: colors.text },
});
