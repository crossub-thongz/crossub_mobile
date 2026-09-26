import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTextInput } from '@/src/ui/app-text-input';

import { AddSectionControl } from '@/src/jobs/add-section-control';
import { DraggableNamedList } from '@/src/jobs/draggable-named-list';
import { InspectionItemAccordion } from '@/src/jobs/inspection-item-accordion';
import type { LocalPhoto } from '@/src/jobs/compress-photo';
import type { InspectionAreaDefinition } from '@/src/constants/inspection-areas';
import { validateUniqueLabel } from '@/src/lib/inspection-layout-edit';
import { buildSectionPickerOptions } from '@/src/lib/inspection-section-utils';
import {
  emptyItemMarks,
  marksAreAllGood,
  marksHaveAnswer,
  marksHaveNo,
  type ItemConditionMarks,
} from '@/src/lib/item-condition-marks';
import { colors } from '@/src/theme';

type ItemFilter = 'all' | 'issues' | 'unmarked';
type SectionPhotos = { ingoingPhotoUrls: string[]; outgoingPhotoUrls: string[] };

export function MarkAllItemsControl({
  activeSections,
  itemMarks,
  busy = false,
  onMarkAllGood,
  onUnmarkAll,
}: {
  activeSections: string[];
  itemMarks?: Record<string, ItemConditionMarks>;
  busy?: boolean;
  onMarkAllGood: () => void;
  onUnmarkAll?: () => void;
}) {
  const allMarkedGood =
    activeSections.length > 0 &&
    activeSections.every((section) => marksAreAllGood(itemMarks?.[section]));
  const canUnmark =
    Boolean(onUnmarkAll) &&
    activeSections.some((section) => marksHaveAnswer(itemMarks?.[section]));

  return (
    <View style={styles.markAll}>
      <View style={styles.markAllCopy}>
        <Text style={styles.markAllTitle}>Mark items</Text>
        <Text style={styles.hint}>
          Mark items that apply. Unmark a section that does not need a condition.
        </Text>
      </View>
      <View style={styles.markAllActions}>
        <Pressable
          disabled={busy || allMarkedGood}
          onPress={() => {
            Alert.alert(
              'Mark all items as good?',
              'This marks Clean, Undamaged, and Working as yes for every item in this room.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Mark all good', onPress: onMarkAllGood },
              ],
            );
          }}
          style={[styles.markAllBtn, (busy || allMarkedGood) && styles.markAllBtnOff]}
        >
          <Ionicons name="checkmark" size={14} color="#34d399" />
          <Text style={styles.markAllBtnText}>All good</Text>
        </Pressable>
        {onUnmarkAll ? (
          <Pressable
            disabled={busy || !canUnmark}
            onPress={() => {
              Alert.alert(
                'Unmark all items?',
                'This clears Clean, Undamaged, and Working. Sections that do not need a mark can stay unmarked.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Unmark all', style: 'destructive', onPress: onUnmarkAll },
                ],
              );
            }}
            style={[styles.markAllBtn, (busy || !canUnmark) && styles.markAllBtnOff]}
          >
            <Ionicons name="close-circle-outline" size={14} color={colors.muted} />
            <Text style={styles.unmarkBtnText}>Unmark</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function InspectionSectionPhotos({
  definition,
  activeSections,
  photosBySection,
  itemMarks,
  itemComments,
  busy = false,
  photoUploading = false,
  photoSide = 'ingoing',
  onAddSection,
  onRemoveSection,
  onRenameSection,
  onMoveSection,
  onChangeMarks,
  onMarkAllGood,
  onUnmarkAll,
  onChangeComment,
  onTakePhotos,
  onAddPhotos,
  onRemovePhoto,
  onDraggingChange,
  onOpenedItemVisible,
}: {
  definition: InspectionAreaDefinition;
  activeSections: string[];
  photosBySection: Record<string, SectionPhotos>;
  itemMarks?: Record<string, ItemConditionMarks>;
  itemComments?: Record<string, string>;
  busy?: boolean;
  photoUploading?: boolean;
  photoSide?: 'ingoing' | 'outgoing';
  onAddSection: (section: string) => void;
  onRemoveSection: (section: string) => void;
  onRenameSection: (from: string, to: string) => void;
  onMoveSection: (from: number, to: number) => void;
  onChangeMarks: (section: string, marks: ItemConditionMarks) => void;
  onMarkAllGood?: () => void;
  onUnmarkAll?: () => void;
  onChangeComment: (section: string, comment: string) => void;
  onTakePhotos: (section: string, side?: 'ingoing' | 'outgoing') => void;
  onAddPhotos?: (section: string, photos: LocalPhoto[], side?: 'ingoing' | 'outgoing') => void;
  onRemovePhoto: (section: string, index: number, side?: 'ingoing' | 'outgoing') => void;
  onDraggingChange?: (dragging: boolean) => void;
  onOpenedItemVisible?: (itemWindowY: number) => void;
}) {
  const [renameFrom, setRenameFrom] = useState<string | null>(null);
  const [openName, setOpenName] = useState<string | null>(null);
  const [filter, setFilter] = useState<ItemFilter>('all');

  const sectionPickerOptions = useMemo(() => buildSectionPickerOptions(definition), [definition]);

  const visibleSections = activeSections.filter((section) => {
    const marks = itemMarks?.[section];
    if (filter === 'issues') return marksHaveNo(marks);
    if (filter === 'unmarked') return !marksAreAllGood(marks) && !marksHaveNo(marks);
    return true;
  });

  const cycleFilter = () => {
    setFilter((current) => (current === 'all' ? 'issues' : current === 'issues' ? 'unmarked' : 'all'));
  };

  return (
    <View style={styles.wrap}>
      {onMarkAllGood && activeSections.length > 0 ? (
        <MarkAllItemsControl
          activeSections={activeSections}
          itemMarks={itemMarks}
          busy={busy}
          onMarkAllGood={onMarkAllGood}
          onUnmarkAll={onUnmarkAll}
        />
      ) : null}

      {activeSections.length === 0 ? (
        <Text style={styles.hint}>No items yet. Add one below. Condition marks are optional on sections that do not apply.</Text>
      ) : (
        <>
          <View style={styles.itemsHead}>
            <View style={styles.itemsTitleRow}>
              <Text style={styles.itemsTitle}>Items in this area</Text>
              <View style={styles.count}>
                <Text style={styles.countText}>{activeSections.length}</Text>
              </View>
            </View>
            <Pressable onPress={cycleFilter} style={styles.filterBtn}>
              <Ionicons name="filter-outline" size={14} color={colors.muted} />
              <Text style={styles.filterText}>
                {filter === 'all' ? 'Filters' : filter === 'issues' ? 'Issues' : 'Unmarked'}
              </Text>
            </Pressable>
          </View>
          {visibleSections.length === 0 ? (
            <View style={styles.filterEmpty}>
              <Text style={styles.hint}>No items match this filter.</Text>
            </View>
          ) : (
            <DraggableNamedList
              items={visibleSections}
              variant="card"
              disabled={busy}
              onDraggingChange={onDraggingChange}
              onReorder={(from, to) => {
                const fromName = visibleSections[from];
                const toName = visibleSections[to];
                if (!fromName || !toName) return;
                onMoveSection(activeSections.indexOf(fromName), activeSections.indexOf(toName));
              }}
              renderItem={(section) => {
                const photos = photosBySection[section] ?? {
                  ingoingPhotoUrls: [],
                  outgoingPhotoUrls: [],
                };
                return (
                  <InspectionItemAccordion
                    name={section}
                    marks={itemMarks?.[section] ?? emptyItemMarks()}
                    comment={itemComments?.[section] ?? ''}
                    photoUrls={
                      photoSide === 'outgoing'
                        ? photos.outgoingPhotoUrls
                        : photos.ingoingPhotoUrls
                    }
                    busy={busy}
                    photoUploading={photoUploading}
                    showItemPhotos
                    open={openName === section}
                    onOpenChange={(next) => setOpenName(next ? section : null)}
                    onOpenedVisible={onOpenedItemVisible}
                    onRename={() => setRenameFrom(section)}
                    onRemove={() => onRemoveSection(section)}
                    onChangeMarks={(marks) => onChangeMarks(section, marks)}
                    onChangeComment={(comment) => onChangeComment(section, comment)}
                    onTakePhotos={() => onTakePhotos(section, photoSide)}
                    onAddPhotos={
                      onAddPhotos ? (photos) => onAddPhotos(section, photos, photoSide) : undefined
                    }
                    onRemovePhoto={(index) => onRemovePhoto(section, index, photoSide)}
                  />
                );
              }}
            />
          )}
        </>
      )}

      <AddSectionControl
        optionalSections={sectionPickerOptions}
        activeSections={activeSections}
        onAddSection={onAddSection}
      />

      <RenameItemModal
        open={Boolean(renameFrom)}
        initialValue={renameFrom ?? ''}
        existingNames={activeSections}
        onClose={() => setRenameFrom(null)}
        onConfirm={(value) => {
          if (!renameFrom) return;
          const error = validateUniqueLabel(value, activeSections, renameFrom);
          if (error) {
            Alert.alert('Rename item', error);
            return;
          }
          onRenameSection(renameFrom, value.trim().replace(/\s+/g, ' '));
          setRenameFrom(null);
        }}
      />
    </View>
  );
}

function RenameItemModal({
  open,
  initialValue,
  onClose,
  onConfirm,
}: {
  open: boolean;
  initialValue: string;
  existingNames: readonly string[];
  onClose: () => void;
  onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.sheetTitle}>Rename item</Text>
          <AppTextInput
            value={value}
            onChangeText={setValue}
            placeholder="Item name"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <View style={styles.sheetRow}>
            <Pressable onPress={onClose} style={[styles.sheetBtn, styles.sheetGhost]}>
              <Text style={styles.sheetGhostText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(value)} style={[styles.sheetBtn, styles.sheetPrimary]}>
              <Text style={styles.sheetPrimaryText}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  markAll: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  markAllCopy: { flex: 1 },
  markAllTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  markAllActions: { alignItems: 'flex-end', gap: 2 },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 8 },
  markAllBtnText: { color: '#34d399', fontSize: 12, fontWeight: '600' },
  unmarkBtnText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  markAllBtnOff: { opacity: 0.45 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  itemsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemsTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  count: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: { color: colors.primaryFg, fontSize: 10, fontWeight: '700' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  filterEmpty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sheetRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  sheetBtn: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  sheetGhost: { borderWidth: 1, borderColor: colors.border },
  sheetGhostText: { color: colors.text, fontWeight: '600' },
  sheetPrimary: { backgroundColor: colors.primary },
  sheetPrimaryText: { color: colors.primaryFg, fontWeight: '700' },
});
