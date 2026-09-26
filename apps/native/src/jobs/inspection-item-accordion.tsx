import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTextInput } from '@/src/ui/app-text-input';

import { InspectionPhotosField } from '@/src/jobs/inspection-photos-field';
import type { LocalPhoto } from '@/src/jobs/compress-photo';
import { inspectionItemIcon } from '@/src/lib/inspection-item-icon';
import {
  cycleItemMark,
  emptyItemMarks,
  ISSUE_DETAIL_LABEL,
  ITEM_CONDITION_KEYS,
  ITEM_CONDITION_LABEL,
  itemMarkStatus,
  marksHaveAnswer,
  type ItemConditionKey,
  type ItemConditionMarks,
} from '@/src/lib/item-condition-marks';
import { colors } from '@/src/theme';

const COMMENT_MAX = 200;

export function InspectionItemAccordion({
  name,
  marks,
  comment,
  photoUrls,
  busy = false,
  photoUploading = false,
  open,
  onOpenChange,
  onRename,
  onRemove,
  onChangeMarks,
  onChangeComment,
  onTakePhotos,
  onAddPhotos,
  onRemovePhoto,
  extra,
  showItemPhotos = true,
  onOpenedVisible,
}: {
  name: string;
  marks: ItemConditionMarks | undefined;
  comment: string;
  photoUrls: string[];
  busy?: boolean;
  photoUploading?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onRemove: () => void;
  onChangeMarks: (marks: ItemConditionMarks) => void;
  onChangeComment: (comment: string) => void;
  onTakePhotos?: () => void;
  onAddPhotos?: (photos: LocalPhoto[]) => void;
  onRemovePhoto?: (index: number) => void;
  extra?: ReactNode;
  showItemPhotos?: boolean;
  onOpenedVisible?: (itemWindowY: number) => void;
}) {
  const current = marks ?? emptyItemMarks();
  const status = itemMarkStatus(current);
  const icon = inspectionItemIcon(name);
  const rootRef = useRef<View>(null);
  const photoCount = photoUrls.filter(Boolean).length;
  const missingPhotos = photoCount === 0;

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      rootRef.current?.measureInWindow((_x, y) => {
        onOpenedVisible?.(y);
      });
    }, 80);
    return () => clearTimeout(timer);
  }, [open, onOpenedVisible]);

  const toggleChip = (key: ItemConditionKey) => {
    onChangeMarks({
      ...current,
      [key]: cycleItemMark(current[key]),
    });
  };

  const statusColor =
    status.tone === 'issue'
      ? colors.destructive
      : status.tone === 'good'
        ? '#34d399'
        : status.tone === 'partial'
          ? colors.amber
          : colors.muted;
  const statusLabel = status.label;

  return (
    <View ref={rootRef} collapsable={false} style={styles.root}>
      <Pressable onPress={() => onOpenChange(!open)} style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name={icon as never} size={16} color={colors.muted} />
        </View>
        <Text style={styles.name}>{name}</Text>
        <View style={styles.status}>
          <View
            style={[styles.photoBadge, missingPhotos && styles.photoBadgeEmpty]}
            accessibilityLabel={
              missingPhotos ? 'No photos for this item' : `${photoCount} photos for this item`
            }
          >
            <Ionicons
              name={missingPhotos ? 'camera-outline' : 'camera'}
              size={12}
              color={missingPhotos ? '#fbbf24' : colors.primary}
            />
            <Text style={[styles.photoBadgeText, missingPhotos && styles.photoBadgeTextEmpty]}>
              {photoCount}
            </Text>
          </View>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          {status.tone === 'issue' ? (
            <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
          ) : status.tone === 'good' ? (
            <Ionicons name="checkmark" size={14} color="#34d399" />
          ) : null}
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
        </View>
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <View style={styles.actions}>
            <Pressable onPress={onRename} disabled={busy}>
              <Text style={styles.rename}>Rename item</Text>
            </Pressable>
            <Pressable onPress={onRemove} disabled={busy} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={14} color={colors.muted} />
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          </View>

          <View>
            <View style={styles.conditionHead}>
              <Text style={styles.sectionTitle}>Condition</Text>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={colors.muted}
              />
              <Pressable
                disabled={busy || !marksHaveAnswer(current)}
                onPress={() => onChangeMarks(emptyItemMarks())}
                style={[styles.unmarkItem, !marksHaveAnswer(current) && styles.unmarkItemOff]}
                accessibilityRole="button"
                accessibilityLabel="Unmark this section"
              >
                <Text style={styles.unmarkItemText}>Unmark</Text>
              </Pressable>
            </View>
            <View style={styles.chips}>
              {ITEM_CONDITION_KEYS.map((key) => {
                const value = current[key];
                const marked = value === true || value === false;
                return (
                  <Pressable
                    key={key}
                    disabled={busy}
                    onPress={() => toggleChip(key)}
                    accessibilityRole="button"
                    accessibilityState={{ checked: marked }}
                    accessibilityLabel={
                      value === true
                        ? `${ITEM_CONDITION_LABEL[key]}, good`
                        : value === false
                          ? `${ITEM_CONDITION_LABEL[key]}, not good`
                          : `${ITEM_CONDITION_LABEL[key]}, not marked`
                    }
                    style={[
                      styles.chip,
                      value === true && styles.chipYes,
                      value === false && styles.chipNo,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        marked && styles.chipTextOn,
                      ]}
                      numberOfLines={1}
                    >
                      {ITEM_CONDITION_LABEL[key]}
                    </Text>
                    {value === true ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : value === false ? (
                      <Ionicons name="close" size={12} color="#fff" />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.details}>
              {ITEM_CONDITION_KEYS.map((key) => {
                const selected = current[key] === false;
                return (
                  <Pressable
                    key={key}
                    disabled={busy}
                    onPress={() =>
                      onChangeMarks({
                        ...current,
                        [key]: selected ? null : false,
                      })
                    }
                    style={styles.detailRow}
                  >
                    <View style={[styles.radio, selected && styles.radioOn]} />
                    <Text style={[styles.detailText, selected && styles.detailTextOn]}>
                      {ISSUE_DETAIL_LABEL[key]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.commentsLabel}>COMMENTS</Text>
            <AppTextInput
              value={comment}
              onChangeText={(value) => onChangeComment(value.slice(0, COMMENT_MAX))}
              editable={!busy}
              placeholder="Describe the issue or leave blank if all good..."
              placeholderTextColor={colors.muted}
              autoFocus={false}
              multiline
              style={styles.comment}
            />
            <Text style={styles.counter}>
              {comment.length}/{COMMENT_MAX}
            </Text>
          </View>

          {extra}

          {showItemPhotos && onTakePhotos ? (
            <InspectionPhotosField
              label="Item photos"
              photoUrls={photoUrls}
              uploading={photoUploading}
              disabled={busy}
              compact
              emptyLabel="Take or upload close-ups of this item."
              onTakePhotos={onTakePhotos}
              onAddPhotos={onAddPhotos}
              onRemove={onRemovePhoto}
            />
          ) : null}

          <Pressable onPress={() => onOpenChange(false)} style={styles.collapse}>
            <Ionicons name="chevron-up" size={16} color={colors.muted} />
            <Text style={styles.collapseText}>Collapse</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  name: { color: colors.text, fontSize: 14, fontWeight: '500', flex: 1, minWidth: 0 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  photoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 32,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(0,212,164,0.18)',
  },
  photoBadgeEmpty: { backgroundColor: 'rgba(251,191,36,0.16)' },
  photoBadgeText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  photoBadgeTextEmpty: { color: '#fbbf24' },
  statusText: { fontSize: 11, fontWeight: '600' },
  body: { marginTop: 12, paddingLeft: 8, gap: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rename: { color: colors.muted, fontSize: 11, textDecorationLine: 'underline' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  delete: { color: colors.muted, fontSize: 11 },
  conditionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  unmarkItem: { marginLeft: 'auto' },
  unmarkItemOff: { opacity: 0.45 },
  unmarkItemText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  chipYes: { backgroundColor: '#047857' },
  chipNo: { backgroundColor: colors.destructive },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  chipTextOn: { color: '#fff' },
  details: { gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(107,114,128,0.5)',
  },
  radioOn: { borderColor: colors.destructive, backgroundColor: colors.destructive },
  detailText: { color: colors.muted, fontSize: 14 },
  detailTextOn: { color: colors.text },
  commentsLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  comment: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  counter: { color: colors.muted, fontSize: 10, textAlign: 'right', marginTop: 4 },
  collapse: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  collapseText: { color: colors.muted, fontSize: 12 },
});
