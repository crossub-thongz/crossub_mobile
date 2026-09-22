import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTextInput } from '@/src/ui/app-text-input';

import { DraggableNamedList } from '@/src/jobs/draggable-named-list';

import {
  classifyAddedAreaName,
  normalizeCustomAreaName,
  type CustomAreaSectionMode,
} from '@/src/lib/custom-inspection-areas';
import { validateUniqueLabel } from '@/src/lib/inspection-layout-edit';
import { setupStartLabel } from '@/src/lib/inspection-start-flow';
import { colors } from '@/src/theme';

type AreaSetupPanelProps = {
  kind: 'ingoing' | 'outgoing' | 'routine';
  selectedAreaNames: string[];
  existingAreaNames?: string[];
  continuing?: boolean;
  sourceLabel?: string | null;
  extraHeader?: ReactNode;
  onAddBuiltInArea: (name: string) => void;
  onAddCustomArea: (name: string, sectionMode: CustomAreaSectionMode) => void;
  onRemoveArea: (name: string) => void;
  onRenameArea: (from: string, to: string) => void;
  onMoveArea: (from: number, to: number) => void;
  onDraggingChange?: (dragging: boolean) => void;
  onAddAllExisting?: () => void;
  onComplete: () => void;
};

export function AreaSetupPanel({
  kind,
  selectedAreaNames,
  existingAreaNames = [],
  continuing = false,
  sourceLabel,
  extraHeader,
  onAddBuiltInArea,
  onAddCustomArea,
  onRemoveArea,
  onRenameArea,
  onMoveArea,
  onDraggingChange,
  onAddAllExisting,
  onComplete,
}: AreaSetupPanelProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [renameFrom, setRenameFrom] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const selectedSet = new Set(selectedAreaNames.map((name) => name.toLowerCase()));
  const availableExisting = existingAreaNames.filter((name) => !selectedSet.has(name.toLowerCase()));

  const addArea = (name: string, sectionMode: CustomAreaSectionMode) => {
    const normalized = normalizeCustomAreaName(name);
    const fromIngoing = existingAreaNames.find(
      (item) => item.trim().toLowerCase() === normalized.toLowerCase(),
    );
    if (fromIngoing) {
      onAddBuiltInArea(fromIngoing);
      return;
    }
    const classified = classifyAddedAreaName(normalized);
    if (classified.kind === 'catalog') onAddBuiltInArea(classified.name);
    else onAddCustomArea(classified.name, sectionMode);
  };

  return (
    <View style={styles.wrap}>
      {extraHeader}
      {sourceLabel ? <Text style={styles.banner}>{sourceLabel}</Text> : null}
      {availableExisting.length > 0 && onAddAllExisting ? (
        <Pressable onPress={onAddAllExisting} style={styles.secondary}>
          <Text style={styles.secondaryText}>
            Add remaining from ingoing report ({availableExisting.length})
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.head}>
        <Text style={styles.headTitle}>Property areas</Text>
        <View style={styles.count}>
          <Text style={styles.countText}>{selectedAreaNames.length}</Text>
        </View>
        <Pressable onPress={() => setAddOpen(true)} style={styles.addLink}>
          <Text style={styles.addLinkText}>+ Add Area</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        {continuing
          ? 'Add, remove, rename, or reorder areas. You can keep editing after the inspection has started.'
          : 'Confirm the areas before starting the inspection.'}
      </Text>

      {selectedAreaNames.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.empty}>Add at least one area, then start the inspection.</Text>
        </View>
      ) : (
        <DraggableNamedList
          items={selectedAreaNames}
          onReorder={onMoveArea}
          onDraggingChange={(dragging) => {
            if (dragging) setMenuFor(null);
            onDraggingChange?.(dragging);
          }}
          renderItem={(name) => (
            <>
              <Text style={styles.areaName}>{name}</Text>
              <View style={styles.menuWrap}>
                <Pressable
                  onPress={() => setMenuFor((current) => (current === name ? null : name))}
                  hitSlop={8}
                  style={styles.menuBtn}
                  accessibilityLabel={`More actions for ${name}`}
                >
                  <Ionicons name="ellipsis-vertical" size={16} color={colors.muted} />
                </Pressable>
                {menuFor === name ? (
                  <View style={styles.menu}>
                    <Pressable
                      onPress={() => {
                        setMenuFor(null);
                        setRenameFrom(name);
                      }}
                      style={styles.menuItem}
                    >
                      <Text style={styles.menuText}>Rename</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setMenuFor(null);
                        onRemoveArea(name);
                      }}
                      style={styles.menuItem}
                    >
                      <Text style={styles.menuDanger}>Delete</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </>
          )}
        />
      )}

      <Pressable
        onPress={onComplete}
        disabled={selectedAreaNames.length === 0}
        style={[styles.primary, selectedAreaNames.length === 0 && styles.disabled]}
      >
        <Text style={styles.primaryText}>{setupStartLabel(kind, continuing)}</Text>
      </Pressable>

      <AddAreaModal
        open={addOpen}
        existingNames={selectedAreaNames}
        onClose={() => setAddOpen(false)}
        onConfirm={(name, mode) => addArea(name, mode)}
      />
      <RenameAreaModal
        open={Boolean(renameFrom)}
        initialValue={renameFrom ?? ''}
        existingNames={selectedAreaNames}
        onClose={() => setRenameFrom(null)}
        onConfirm={(value) => {
          if (!renameFrom) return;
          const error = validateUniqueLabel(value, selectedAreaNames, renameFrom);
          if (error) {
            Alert.alert('Rename area', error);
            return;
          }
          onRenameArea(renameFrom, normalizeCustomAreaName(value));
          setRenameFrom(null);
        }}
      />
    </View>
  );
}

function AddAreaModal({
  open,
  existingNames,
  onClose,
  onConfirm,
}: {
  open: boolean;
  existingNames: readonly string[];
  onClose: () => void;
  onConfirm: (name: string, sectionMode: CustomAreaSectionMode) => void;
}) {
  const [name, setName] = useState('');
  const [sectionMode, setSectionMode] = useState<CustomAreaSectionMode>('standard');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setSectionMode('standard');
    setError(null);
  }, [open]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.sheetTitle}>Add area</Text>
          <Text style={styles.hint}>
            Name the area, then choose standard wall-to-floor sections or add sections manually.
          </Text>
          <AppTextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              setError(null);
            }}
            placeholder="e.g. Rumpus room, Studio, Shed"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={() => setSectionMode('standard')}
            style={[styles.mode, sectionMode === 'standard' && styles.modeOn]}
          >
            <Text style={styles.modeTitle}>Standard sections</Text>
            <Text style={styles.hint}>Walls, floors, doors, windows, and other common checklist items.</Text>
          </Pressable>
          <Pressable
            onPress={() => setSectionMode('manual')}
            style={[styles.mode, sectionMode === 'manual' && styles.modeOn]}
          >
            <Text style={styles.modeTitle}>Add sections manually</Text>
            <Text style={styles.hint}>Start with no sections - pick each one from the list as you go.</Text>
          </Pressable>
          <View style={styles.sheetRow}>
            <Pressable onPress={onClose} style={[styles.sheetBtn, styles.sheetGhost]}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const classified = classifyAddedAreaName(name);
                if (classified.name.length < 2) {
                  setError('Enter an area name (at least 2 characters).');
                  return;
                }
                if (existingNames.some((item) => item.trim().toLowerCase() === classified.name.toLowerCase())) {
                  setError('An area with this name already exists.');
                  return;
                }
                onConfirm(classified.name, sectionMode);
                onClose();
              }}
              style={[styles.sheetBtn, styles.sheetPrimary]}
            >
              <Text style={styles.primaryText}>Add area</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RenameAreaModal({
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
          <Text style={styles.sheetTitle}>Rename area</Text>
          <AppTextInput
            value={value}
            onChangeText={setValue}
            placeholder="Area name"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <View style={styles.sheetRow}>
            <Pressable onPress={onClose} style={[styles.sheetBtn, styles.sheetGhost]}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(value)}
              style={[styles.sheetBtn, styles.sheetPrimary]}
            >
              <Text style={styles.primaryText}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  banner: {
    color: colors.amber,
    backgroundColor: colors.amberBg,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headTitle: { color: colors.text, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  count: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: { color: colors.primaryFg, fontSize: 11, fontWeight: '700' },
  addLink: { marginLeft: 'auto' },
  addLinkText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
  },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 24, fontSize: 12 },
  areaName: { color: colors.text, fontWeight: '500', flex: 1, fontSize: 14 },
  menuWrap: { position: 'relative', flexShrink: 0 },
  menuBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  menu: {
    position: 'absolute',
    right: 0,
    bottom: 40,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    minWidth: 136,
    zIndex: 50,
    elevation: 8,
  },
  menuItem: { paddingHorizontal: 12, paddingVertical: 10 },
  menuText: { color: colors.text, fontSize: 13 },
  menuDanger: { color: colors.destructive, fontSize: 13 },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: colors.primaryFg, fontWeight: '700' },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontWeight: '600' },
  disabled: { opacity: 0.45 },
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
  error: { color: colors.destructive, fontSize: 12 },
  mode: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
  },
  modeOn: { borderColor: colors.primary, backgroundColor: 'rgba(0,212,164,0.1)' },
  modeTitle: { color: colors.text, fontWeight: '600', marginBottom: 4 },
  sheetRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  sheetBtn: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  sheetGhost: { borderWidth: 1, borderColor: colors.border },
  sheetPrimary: { backgroundColor: colors.primary },
});
