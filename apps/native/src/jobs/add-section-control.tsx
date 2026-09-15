import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  normalizeSectionName,
  validateNewSectionName,
} from '@/src/lib/inspection-section-utils';
import { colors } from '@/src/theme';

export function AddSectionControl({
  optionalSections,
  activeSections,
  onAddSection,
}: {
  optionalSections: readonly string[];
  activeSections: readonly string[];
  onAddSection: (section: string) => void;
}) {
  const [sectionName, setSectionName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const available = optionalSections.filter(
    (section) => !activeSections.some((item) => item.toLowerCase() === section.toLowerCase()),
  );

  const commit = (raw: string) => {
    const validationError = validateNewSectionName(raw, activeSections);
    if (validationError) {
      setError(validationError);
      return;
    }
    onAddSection(normalizeSectionName(raw));
    setSectionName('');
    setError(null);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Add item</Text>
      <Text style={styles.hint}>Name the item, then mark Clean / Undamaged / Working on the card above.</Text>
      <View style={styles.row}>
        <TextInput
          value={sectionName}
          onChangeText={(value) => {
            setSectionName(value);
            setError(null);
          }}
          placeholder="e.g. Built-in wardrobe"
          placeholderTextColor={colors.muted}
          style={styles.input}
          onSubmitEditing={() => commit(sectionName)}
        />
        <Pressable onPress={() => commit(sectionName)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {available.length > 0 ? (
        <View style={styles.chips}>
          {available.map((section) => (
            <Pressable
              key={section}
              onPress={() => commit(section)}
              style={styles.chip}
            >
              <Text style={styles.chipText}>{section}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  label: { color: colors.text, fontWeight: '600', fontSize: 13 },
  hint: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  addBtnText: { color: colors.text, fontWeight: '700' },
  error: { color: colors.destructive, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { color: colors.muted, fontSize: 11 },
});
