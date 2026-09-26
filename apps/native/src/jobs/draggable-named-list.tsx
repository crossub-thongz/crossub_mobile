import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type PanResponderGestureState,
} from 'react-native';

import { colors } from '@/src/theme';

const HOLD_MS = 500;
const CANCEL_HOLD_PX = 12;
const DEFAULT_ROW_H = 48;
const LIST_RADIUS = 16;

export function DraggableNamedList({
  items,
  onReorder,
  onDraggingChange,
  renderItem,
  variant = 'row',
  disabled = false,
}: {
  items: string[];
  onReorder: (from: number, to: number) => void;
  onDraggingChange?: (dragging: boolean) => void;
  renderItem: (name: string, index: number) => ReactNode;
  variant?: 'row' | 'card';
  disabled?: boolean;
}) {
  const heights = useRef<number[]>([]);
  const itemsRef = useRef(items);
  const onReorderRef = useRef(onReorder);
  const onDraggingChangeRef = useRef(onDraggingChange);
  const disabledRef = useRef(disabled);
  const draggingRef = useRef(false);
  const armedRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fromRef = useRef(0);
  const overRef = useRef(0);
  const fromHeightRef = useRef(DEFAULT_ROW_H);
  const dragY = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [hintVisible, setHintVisible] = useState(false);

  itemsRef.current = items;
  onReorderRef.current = onReorder;
  onDraggingChangeRef.current = onDraggingChange;
  disabledRef.current = disabled;

  const gap = variant === 'card' ? 8 : 0;

  const clearHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const indexFromDy = (dy: number): number => {
    const from = fromRef.current;
    const count = itemsRef.current.length;
    if (count <= 1) return from;
    let travelled = 0;
    if (dy >= 0) {
      for (let i = from; i < count - 1; i += 1) {
        const step = (heights.current[i + 1] ?? fromHeightRef.current) + gap;
        if (dy < travelled + step / 2) return i;
        travelled += step;
      }
      return count - 1;
    }
    for (let i = from; i > 0; i -= 1) {
      const step = (heights.current[i - 1] ?? fromHeightRef.current) + gap;
      if (-dy < travelled + step / 2) return i;
      travelled += step;
    }
    return 0;
  };

  const armDrag = (index: number) => {
    if (disabledRef.current || armedRef.current) return;
    armedRef.current = true;
    draggingRef.current = true;
    fromRef.current = index;
    overRef.current = index;
    fromHeightRef.current = heights.current[index] ?? DEFAULT_ROW_H;
    dragY.setValue(0);
    onDraggingChangeRef.current?.(true);
    setActiveIndex(index);
    setOverIndex(index);
    setHintVisible(true);
    Animated.spring(lift, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  };

  const endDrag = (commit: boolean) => {
    clearHold();
    const from = fromRef.current;
    const over = overRef.current;
    const moved = commit && armedRef.current && draggingRef.current && from !== over;
    armedRef.current = false;
    draggingRef.current = false;
    dragY.setValue(0);
    lift.setValue(0);
    onDraggingChangeRef.current?.(false);
    setActiveIndex(null);
    setOverIndex(null);
    setHintVisible(false);
    if (moved) onReorderRef.current(from, over);
  };

  const responders = useMemo(
    () =>
      items.map((_, index) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => !disabledRef.current,
          onStartShouldSetPanResponderCapture: () => !disabledRef.current,
          onMoveShouldSetPanResponder: (_event, gesture: PanResponderGestureState) => {
            if (disabledRef.current) return false;
            if (armedRef.current) return true;
            return Math.abs(gesture.dy) + Math.abs(gesture.dx) < CANCEL_HOLD_PX;
          },
          onMoveShouldSetPanResponderCapture: () => armedRef.current,
          onPanResponderTerminationRequest: () => !armedRef.current,
          onShouldBlockNativeResponder: () => true,
          onPanResponderGrant: () => {
            if (disabledRef.current) return;
            armedRef.current = false;
            draggingRef.current = false;
            fromRef.current = index;
            overRef.current = index;
            clearHold();
            holdTimerRef.current = setTimeout(() => {
              holdTimerRef.current = null;
              armDrag(index);
            }, HOLD_MS);
          },
          onPanResponderMove: (_event, gesture) => {
            if (!armedRef.current) {
              if (Math.abs(gesture.dy) >= CANCEL_HOLD_PX || Math.abs(gesture.dx) >= CANCEL_HOLD_PX) {
                clearHold();
              }
              return;
            }
            if (Math.abs(gesture.dy) > 8) setHintVisible(false);
            dragY.setValue(gesture.dy);
            const over = indexFromDy(gesture.dy);
            if (overRef.current === over) return;
            overRef.current = over;
            setOverIndex(over);
          },
          onPanResponderRelease: () => endDrag(true),
          onPanResponderTerminate: () => endDrag(false),
        }),
      ),
    [items.length, lift, dragY],
  );

  const shiftFor = (index: number): number => {
    if (activeIndex == null || overIndex == null || index === activeIndex) return 0;
    const distance = fromHeightRef.current + gap;
    if (activeIndex < overIndex && index > activeIndex && index <= overIndex) return -distance;
    if (activeIndex > overIndex && index >= overIndex && index < activeIndex) return distance;
    return 0;
  };

  return (
    <View
      style={[
        variant === 'card' ? styles.cardList : styles.list,
        variant === 'row' && activeIndex == null && styles.listClip,
      ]}
    >
      {items.map((name, index) => {
        const dragging = activeIndex === index;
        const dropTarget =
          overIndex === index && activeIndex != null && activeIndex !== index;
        const shift = shiftFor(index);
        return (
          <Animated.View
            key={`${name}-${index}`}
            collapsable={false}
            onLayout={(event) => {
              heights.current[index] = event.nativeEvent.layout.height;
            }}
            style={[
              variant === 'card' ? styles.cardRow : styles.row,
              variant === 'row' && index === 0 && styles.rowFirst,
              variant === 'row' && index === items.length - 1 && styles.rowLast,
              activeIndex != null && !dragging && styles.rowDim,
              dropTarget && styles.rowOver,
              dragging
                ? {
                    zIndex: 40,
                    elevation: 18,
                    transform: [
                      { translateY: dragY },
                      {
                        scale: lift.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.05],
                        }),
                      },
                    ],
                  }
                : {
                    zIndex: 1,
                    transform: [{ translateY: shift }],
                  },
              dragging && styles.rowFloating,
            ]}
          >
            {dragging && hintVisible ? (
              <View style={styles.dragHint} pointerEvents="none">
                <Text style={styles.dragHintText}>Drag to rearrange</Text>
              </View>
            ) : null}
            {dropTarget && activeIndex != null && overIndex < activeIndex ? (
              <View style={styles.slotTop} pointerEvents="none" />
            ) : null}
            <View
              {...(disabled ? {} : responders[index]?.panHandlers)}
              style={[
                styles.grip,
                variant === 'card' && styles.gripCard,
                dragging && styles.gripArmed,
                disabled && styles.gripDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Drag ${name} to reorder`}
              accessibilityHint="Hold for half a second, then drag up or down to rearrange"
            >
              <View style={styles.gripCol}>
                <View style={[styles.gripDot, dragging && styles.gripDotArmed]} />
                <View style={[styles.gripDot, dragging && styles.gripDotArmed]} />
                <View style={[styles.gripDot, dragging && styles.gripDotArmed]} />
              </View>
              <View style={styles.gripCol}>
                <View style={[styles.gripDot, dragging && styles.gripDotArmed]} />
                <View style={[styles.gripDot, dragging && styles.gripDotArmed]} />
                <View style={[styles.gripDot, dragging && styles.gripDotArmed]} />
              </View>
            </View>
            {renderItem(name, index)}
            {dropTarget && activeIndex != null && overIndex > activeIndex ? (
              <View style={styles.slotBottom} pointerEvents="none" />
            ) : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: LIST_RADIUS,
    overflow: 'visible',
  },
  listClip: { overflow: 'hidden' },
  cardList: { gap: 8, overflow: 'visible' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingRight: 8,
    minHeight: 48,
    position: 'relative',
    overflow: 'visible',
    backgroundColor: colors.card,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    overflow: 'visible',
    position: 'relative',
  },
  rowFirst: {
    borderTopLeftRadius: LIST_RADIUS,
    borderTopRightRadius: LIST_RADIUS,
  },
  rowLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: LIST_RADIUS,
    borderBottomRightRadius: LIST_RADIUS,
  },
  rowDim: { opacity: 0.55 },
  rowOver: {},
  rowFloating: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  dragHint: {
    position: 'absolute',
    top: -34,
    left: 12,
    zIndex: 50,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dragHintText: { color: colors.primaryFg, fontSize: 12, fontWeight: '700' },
  slotTop: {
    position: 'absolute',
    top: -5,
    left: 10,
    right: 10,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    zIndex: 20,
  },
  slotBottom: {
    position: 'absolute',
    bottom: -5,
    left: 10,
    right: 10,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    zIndex: 20,
  },
  grip: {
    width: 40,
    height: 36,
    marginLeft: 8,
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
    borderRadius: 8,
    backgroundColor: 'rgba(0,212,164,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,164,0.55)',
  },
  gripCard: { marginLeft: 0, marginRight: 8, marginVertical: 0 },
  gripArmed: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  gripDisabled: { opacity: 0.3 },
  gripCol: { gap: 3 },
  gripDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary,
  },
  gripDotArmed: { backgroundColor: colors.primaryFg },
});
