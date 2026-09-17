import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { colors } from '@/src/theme';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function parseYmd(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toYmd(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateTimeLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateTimeLocal(date: Date): string {
  return `${toYmd(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatYmdLabel(value: string): string {
  const date = parseYmd(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDateTimeLabel(value: string): string {
  const date = parseDateTimeLocal(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

type DateFieldProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  optional?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
};

export function DateField({
  value,
  onChange,
  placeholder = 'Select date',
  optional = false,
  minimumDate,
  maximumDate,
}: DateFieldProps) {
  return (
    <NativePickerField
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      optional={optional}
      mode="date"
      label={value ? formatYmdLabel(value) : ''}
      parse={parseYmd}
      format={toYmd}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
    />
  );
}

export function DateTimeField({
  value,
  onChange,
  placeholder = 'Select date and time',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <NativePickerField
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      mode={Platform.OS === 'ios' ? 'datetime' : 'date'}
      androidFollowUpTime
      label={value ? formatDateTimeLabel(value) : ''}
      parse={parseDateTimeLocal}
      format={toDateTimeLocal}
    />
  );
}

function NativePickerField({
  value,
  onChange,
  placeholder,
  optional = false,
  mode,
  androidFollowUpTime = false,
  label,
  parse,
  format,
  minimumDate,
  maximumDate,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  optional?: boolean;
  mode: 'date' | 'time' | 'datetime';
  androidFollowUpTime?: boolean;
  label: string;
  parse: (value: string) => Date | null;
  format: (date: Date) => string;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const [androidTimeOpen, setAndroidTimeOpen] = useState(false);
  const [draft, setDraft] = useState(() => parse(value) ?? new Date());

  const selected = open || androidTimeOpen ? draft : parse(value) ?? draft;

  const commit = (date: Date) => {
    setDraft(date);
    onChange(format(date));
  };

  const onNativeChange = (
    event: DateTimePickerEvent,
    date: Date | undefined,
    currentMode: 'date' | 'time' | 'datetime',
  ) => {
    if (event.type === 'dismissed') {
      setOpen(false);
      setAndroidTimeOpen(false);
      return;
    }
    if (!date) return;
    let next = date;
    if (currentMode === 'date' && (mode === 'datetime' || androidFollowUpTime)) {
      next = new Date(date);
      next.setHours(draft.getHours(), draft.getMinutes(), 0, 0);
    }
    if (Platform.OS === 'android') {
      setOpen(false);
      if (androidFollowUpTime && currentMode === 'date') {
        setDraft(next);
        setAndroidTimeOpen(true);
        return;
      }
      setAndroidTimeOpen(false);
    }
    commit(next);
  };

  const picker = (currentMode: 'date' | 'time' | 'datetime', visible: boolean) => {
    if (!visible) return null;
    const shared = {
      value: selected,
      mode: currentMode,
      themeVariant: 'dark' as const,
      minimumDate,
      maximumDate,
      onChange: (event: DateTimePickerEvent, date: Date | undefined) =>
        onNativeChange(event, date, currentMode),
    };
    return Platform.OS === 'ios' ? (
      <DateTimePicker
        {...shared}
        display={currentMode === 'time' ? 'spinner' : 'inline'}
        accentColor={colors.primary}
        style={currentMode === 'time' ? styles.iosTime : styles.iosCalendar}
      />
    ) : (
      <DateTimePicker
        {...shared}
        display={currentMode === 'date' ? 'calendar' : 'clock'}
      />
    );
  };

  return (
    <View>
      <Pressable
        onPress={() => {
          setDraft(parse(value) ?? new Date());
          setOpen(true);
        }}
        style={styles.field}
      >
        <Text style={label ? styles.value : styles.placeholder}>{label || placeholder}</Text>
      </Pressable>
      {optional && value ? (
        <Pressable onPress={() => onChange('')} style={styles.clear}>
          <Text style={styles.clearText}>Clear date</Text>
        </Pressable>
      ) : null}

      {Platform.OS === 'android' ? (
        <>
          {picker(mode === 'datetime' ? 'date' : mode, open)}
          {picker('time', androidTimeOpen)}
        </>
      ) : (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          presentationStyle="overFullScreen"
          onRequestClose={() => setOpen(false)}
        >
          <View style={styles.modalRoot}>
            <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
            <View style={styles.popover}>
              {mode === 'datetime' ? picker('datetime', true) : picker(mode, true)}
              <Pressable onPress={() => setOpen(false)} style={styles.done}>
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  value: { color: colors.text, fontSize: 15 },
  placeholder: { color: colors.muted, fontSize: 15 },
  clear: { alignSelf: 'flex-start', marginTop: 6 },
  clearText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  popover: {
    width: 340,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 8,
  },
  iosCalendar: {
    width: 320,
    height: 334,
    alignSelf: 'center',
  },
  iosTime: {
    width: 320,
    height: 180,
    alignSelf: 'center',
  },
  done: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  doneText: { color: colors.primaryFg, fontWeight: '700' },
});
