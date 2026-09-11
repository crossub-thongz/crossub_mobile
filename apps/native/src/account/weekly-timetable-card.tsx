import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  fetchInspectorTimetable,
  saveInspectorTimetable,
} from '@/src/api/inspector';
import {
  DEFAULT_AVAILABILITY_END_MINUTE,
  DEFAULT_AVAILABILITY_START_MINUTE,
  INVALID_WINDOW_MESSAGE,
} from '@/src/constants/availability';
import {
  daysInMonth,
  entriesToMap,
  formatSelectedDateLabel,
  isPastDateKey,
  isValidWindow,
  mapToEntries,
  minuteToTimeInput,
  monthRange,
  monthStartWeekday,
  parseTimeInput,
  sydneyTodayParts,
  WEEKDAY_HEADERS,
  type InspectorDateAvailabilityEntry,
} from '@/src/lib/inspector-timetable';
import { colors } from '@/src/theme';

export function WeeklyTimetableCard() {
  const today = sydneyTodayParts();
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [entriesByDate, setEntriesByDate] = useState<
    Map<string, InspectorDateAvailabilityEntry>
  >(new Map());
  const [unavailableDates, setUnavailableDates] = useState<Set<string>>(new Set());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [startMinute, setStartMinute] = useState(DEFAULT_AVAILABILITY_START_MINUTE);
  const [endMinute, setEndMinute] = useState(DEFAULT_AVAILABILITY_END_MINUTE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);

  const range = useMemo(() => monthRange(year, month), [year, month]);
  const monthLabel = useMemo(
    () =>
      new Date(Date.UTC(year, month - 1, 1, 12)).toLocaleDateString('en-AU', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Australia/Sydney',
      }),
    [year, month],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const timetable = await fetchInspectorTimetable(range.from, range.to);
      setEntriesByDate(entriesToMap(timetable.entries));
      setSelectedDates(new Set());
      setUnavailableDates(new Set());
      setTimeError(null);
      setDirty(false);
    } catch (err) {
      Alert.alert(
        'Could not load availability',
        err instanceof Error ? err.message : 'Try again in a moment.',
      );
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const shiftMonth = (delta: number) => {
    if (dirty) {
      Alert.alert('Unsaved changes', 'Save this month first, or discard the changes.');
      return;
    }
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth() + 1);
    setSelectedDates(new Set());
    setUnavailableDates(new Set());
    setTimeError(null);
  };

  const dateKeyForDay = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const toggleSelected = (dateKey: string) => {
    const next = new Set(selectedDates);
    const selecting = !next.has(dateKey);
    if (selecting) next.add(dateKey);
    else next.delete(dateKey);
    setSelectedDates(next);
    if (next.size === 0) setTimeError(null);
    const entry = entriesByDate.get(dateKey);
    if (selecting && entry) {
      setStartMinute(entry.startMinute);
      setEndMinute(entry.endMinute);
    }
  };

  const markSelectedAvailable = () => {
    if (selectedDates.size === 0) {
      Alert.alert('Select dates', 'Select one or more dates on the calendar.');
      return;
    }
    if (!isValidWindow(startMinute, endMinute)) {
      setTimeError(INVALID_WINDOW_MESSAGE);
      Alert.alert('Hours', INVALID_WINDOW_MESSAGE);
      return;
    }
    setTimeError(null);
    setEntriesByDate((current) => {
      const next = new Map(current);
      for (const dateKey of selectedDates) {
        next.set(dateKey, { date: dateKey, startMinute, endMinute });
      }
      return next;
    });
    setUnavailableDates((current) => {
      const next = new Set(current);
      for (const dateKey of selectedDates) next.delete(dateKey);
      return next;
    });
    setDirty(true);
  };

  const markSelectedUnavailable = () => {
    if (selectedDates.size === 0) {
      Alert.alert('Select dates', 'Select one or more dates on the calendar.');
      return;
    }
    setTimeError(null);
    setEntriesByDate((current) => {
      const next = new Map(current);
      for (const dateKey of selectedDates) next.delete(dateKey);
      return next;
    });
    setUnavailableDates((current) => {
      const next = new Set(current);
      for (const dateKey of selectedDates) next.add(dateKey);
      return next;
    });
    setDirty(true);
  };

  const applyWindowToSelected = (nextStart: number, nextEnd: number) => {
    if (selectedDates.size === 0) return;
    if (!isValidWindow(nextStart, nextEnd)) {
      setTimeError(INVALID_WINDOW_MESSAGE);
      return;
    }
    setTimeError(null);
    const targets = [...selectedDates].filter(
      (dateKey) => !unavailableDates.has(dateKey) || entriesByDate.has(dateKey),
    );
    if (targets.length === 0) return;
    setEntriesByDate((current) => {
      const next = new Map(current);
      for (const dateKey of targets) {
        next.set(dateKey, { date: dateKey, startMinute: nextStart, endMinute: nextEnd });
      }
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    const entries = mapToEntries(entriesByDate).filter(
      (entry) => entry.date >= range.from && entry.date <= range.to,
    );
    const invalid = entries.find((entry) => !isValidWindow(entry.startMinute, entry.endMinute));
    if (invalid) {
      setTimeError(INVALID_WINDOW_MESSAGE);
      Alert.alert(
        'Hours',
        `${INVALID_WINDOW_MESSAGE} Fix ${formatSelectedDateLabel(invalid.date)}.`,
      );
      return;
    }
    setSaving(true);
    try {
      const timetable = await saveInspectorTimetable(range.from, range.to, entries);
      const savedEntries = entriesToMap(timetable.entries);
      setEntriesByDate(savedEntries);
      setUnavailableDates((current) => {
        const next = new Set<string>();
        for (const dateKey of current) {
          if (dateKey >= range.from && dateKey <= range.to && !savedEntries.has(dateKey)) {
            next.add(dateKey);
          }
        }
        return next;
      });
      setSelectedDates(new Set());
      setTimeError(null);
      setDirty(false);
      Alert.alert(
        'Availability saved',
        savedEntries.size > 0
          ? `${savedEntries.size} day${savedEntries.size === 1 ? '' : 's'} in ${monthLabel}`
          : `No available days in ${monthLabel}`,
      );
    } catch (err) {
      Alert.alert(
        'Could not save',
        err instanceof Error ? err.message : 'Try again in a moment.',
      );
    } finally {
      setSaving(false);
    }
  };

  const startPad = monthStartWeekday(year, month);
  const totalDays = daysInMonth(year, month);
  const cells: Array<{ day: number; dateKey: string } | null> = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1;
      return { day, dateKey: dateKeyForDay(day) };
    }),
  ];
  const selectedList = [...selectedDates].sort();
  const anySelectedAvailable = selectedList.some((key) => entriesByDate.has(key));
  const showAvailableActive =
    selectedList.length > 0 && selectedList.every((key) => entriesByDate.has(key));
  const showUnavailableActive =
    selectedList.length > 0 &&
    selectedList.every((key) => unavailableDates.has(key) && !entriesByDate.has(key));
  const todayKey = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Availability calendar</Text>
      <Text style={styles.hint}>
        Tap dates (yellow), set hours or mark Not available (red), then Save. A green
        mark means the day is published.
      </Text>

      <View style={styles.monthRow}>
        <Pressable onPress={() => shiftMonth(-1)} style={styles.monthBtn}>
          <Text style={styles.monthBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={() => shiftMonth(1)} style={styles.monthBtn}>
          <Text style={styles.monthBtnText}>›</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
      ) : (
        <>
          <View style={styles.grid}>
            {WEEKDAY_HEADERS.map((label) => (
              <Text key={label} style={styles.weekday}>
                {label}
              </Text>
            ))}
            {cells.map((cell, index) => {
              if (!cell) return <View key={`pad-${index}`} style={styles.cell} />;
              const entry = entriesByDate.get(cell.dateKey);
              const isAvailable = Boolean(entry);
              const isUnavailable = unavailableDates.has(cell.dateKey) && !isAvailable;
              const isSelected = selectedDates.has(cell.dateKey);
              const isPast = isPastDateKey(cell.dateKey);
              const isToday = cell.dateKey === todayKey;
              return (
                <Pressable
                  key={cell.dateKey}
                  disabled={isPast}
                  onPress={() => toggleSelected(cell.dateKey)}
                  style={[
                    styles.cell,
                    styles.day,
                    isPast && styles.dayPast,
                    isToday && !isSelected && styles.dayToday,
                    isSelected && styles.daySelected,
                    !isSelected && isAvailable && styles.dayAvailable,
                    !isSelected && isUnavailable && styles.dayUnavailable,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                      isAvailable && !isSelected && styles.dayTextAvailable,
                      isUnavailable && !isSelected && styles.dayTextUnavailable,
                    ]}
                  >
                    {cell.day}
                  </Text>
                  {isAvailable ? <View style={styles.dotGreen} /> : null}
                  {isUnavailable ? <View style={styles.dotRed} /> : null}
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {selectedList.length > 0 ? (
        <View style={styles.editor}>
          <Text style={styles.editorTitle}>
            {selectedList.length} date{selectedList.length === 1 ? '' : 's'} selected
          </Text>
          <Text style={styles.hint}>{selectedList.map(formatSelectedDateLabel).join(' · ')}</Text>
          <View style={styles.row}>
            <Pressable
              onPress={markSelectedAvailable}
              style={[styles.chip, showAvailableActive && styles.chipAvailable]}
            >
              <Text style={[styles.chipText, showAvailableActive && styles.chipTextOn]}>
                Available
              </Text>
            </Pressable>
            <Pressable
              onPress={markSelectedUnavailable}
              style={[styles.chip, showUnavailableActive && styles.chipUnavailable]}
            >
              <Text style={[styles.chipText, showUnavailableActive && styles.chipTextOn]}>
                Not available
              </Text>
            </Pressable>
          </View>
          {!showUnavailableActive ? (
            <>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>From</Text>
                  <TextInput
                    value={minuteToTimeInput(startMinute)}
                    onChangeText={(value) => {
                      const next = parseTimeInput(value);
                      if (next === null) return;
                      setStartMinute(next);
                      applyWindowToSelected(next, endMinute);
                    }}
                    placeholder="09:00"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>To</Text>
                  <TextInput
                    value={minuteToTimeInput(endMinute)}
                    onChangeText={(value) => {
                      const next = parseTimeInput(value);
                      if (next === null) return;
                      setEndMinute(next);
                      applyWindowToSelected(startMinute, next);
                    }}
                    placeholder="17:00"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <Text style={[styles.hint, timeError ? { color: colors.destructive } : null]}>
                {timeError ??
                  (anySelectedAvailable
                    ? 'These hours apply to every selected date. Save to publish them.'
                    : 'Set your hours — the selected dates are marked available. Then save.')}
              </Text>
            </>
          ) : (
            <Text style={styles.hint}>
              Selected dates are marked unavailable — no time window is required.
            </Text>
          )}
        </View>
      ) : (
        <Text style={styles.hint}>Select one or more dates on the calendar.</Text>
      )}

      <Pressable
        disabled={loading || saving || !dirty || timeError !== null}
        onPress={() => {
          void save();
        }}
        style={[
          styles.save,
          (loading || saving || !dirty || timeError !== null) && styles.saveOff,
        ]}
      >
        <Text style={styles.saveText}>{saving ? 'Saving…' : `Save ${monthLabel}`}</Text>
      </Pressable>
      {dirty ? (
        <Pressable disabled={saving} onPress={() => void load()}>
          <Text style={styles.discard}>Discard changes</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnText: { color: colors.text, fontSize: 18 },
  monthLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: {
    width: '14.28%',
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  cell: { width: '14.28%', aspectRatio: 1, padding: 2 },
  day: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPast: { opacity: 0.35 },
  dayToday: { borderColor: 'rgba(0,212,164,0.4)' },
  daySelected: { backgroundColor: 'rgba(251,191,36,0.28)', borderColor: colors.amber },
  dayAvailable: { backgroundColor: 'rgba(16,185,129,0.18)', borderColor: 'rgba(16,185,129,0.6)' },
  dayUnavailable: { backgroundColor: 'rgba(239,68,68,0.18)', borderColor: 'rgba(239,68,68,0.6)' },
  dayText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  dayTextSelected: { color: '#fff' },
  dayTextAvailable: { color: '#6ee7b7' },
  dayTextUnavailable: { color: '#fca5a5' },
  dotGreen: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  dotRed: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.destructive,
  },
  editor: { gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  editorTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chipAvailable: { backgroundColor: '#059669', borderColor: '#059669' },
  chipUnavailable: { backgroundColor: colors.destructive, borderColor: colors.destructive },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  chipTextOn: { color: '#fff' },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 10,
    color: colors.text,
    marginTop: 4,
  },
  save: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveOff: { opacity: 0.45 },
  saveText: { color: colors.primaryFg, fontWeight: '700' },
  discard: { color: colors.muted, fontSize: 11, textAlign: 'center', textDecorationLine: 'underline' },
});
