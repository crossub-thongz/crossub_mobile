import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  type PanResponderGestureState,
} from 'react-native';

import { colors } from '@/src/theme';

const ACTIVATE_PX = 20;
const DEFAULT_ROW_H = 48;

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
  const fromRef = useRef(0);
  const overRef = useRef(0);
  const fromHeightRef = useRef(DEFAULT_ROW_H);
  const dragY = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  itemsRef.current = items;
  onReorderRef.current = onReorder;
  onDraggingChangeRef.current = onDraggingChange;
  disabledRef.current = disabled;

  const gap = variant === 'card' ? 8 : 0;

  const shouldActivate = (gesture: PanResponderGestureState) => {
    if (disabledRef.current) return false;
    return (
      Math.abs(gesture.dy) >= ACTIVATE_PX &&
      Math.abs(gesture.dy) > Math.abs(gesture.dx) + 4
    );
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

  const endDrag = (commit: boolean) => {
    const from = fromRef.current;
    const over = overRef.current;
    const moved = commit && draggingRef.current && from !== over;
    draggingRef.current = false;
    dragY.setValue(0);
    lift.setValue(0);
    onDraggingChangeRef.current?.(false);
    setActiveIndex(null);
    setOverIndex(null);
    if (moved) onReorderRef.current(from, over);
  };

  const responders = useMemo(
    () =>
      items.map((_, index) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => false,
          onStartShouldSetPanResponderCapture: () => false,
          onMoveShouldSetPanResponder: (_event, gesture) => shouldActivate(gesture),
          onMoveShouldSetPanResponderCapture: (_event, gesture) => shouldActivate(gesture),
          onPanResponderTerminationRequest: () => false,
          onShouldBlockNativeResponder: () => true,
          onPanResponderGrant: (_event, gesture) => {
            if (disabledRef.current) return;
            fromRef.current = index;
            overRef.current = index;
            draggingRef.current = true;
            fromHeightRef.current = heights.current[index] ?? DEFAULT_ROW_H;
            dragY.setValue(gesture.dy);
            onDraggingChangeRef.current?.(true);
            setActiveIndex(index);
            setOverIndex(index);
            Animated.spring(lift, {
              toValue: 1,
              useNativeDriver: true,
              friction: 6,
              tension: 80,
            }).start();
          },
          onPanResponderMove: (_event, gesture) => {
            if (!draggingRef.current) return;
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
    <View style={variant === 'card' ? styles.cardList : styles.list}>
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
                          outputRange: [1, 1.04],
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
            {dropTarget && activeIndex != null && overIndex < activeIndex ? (
              <View style={styles.slotTop} pointerEvents="none" />
            ) : null}
            <View
              {...(disabled ? {} : responders[index]?.panHandlers)}
              style={[styles.grip, disabled && styles.gripDisabled]}
              accessibilityRole="button"
              accessibilityLabel={`Drag ${name} to reorder`}
            >
              <View style={styles.gripCol}>
                <View style={styles.gripDot} />
                <View style={styles.gripDot} />
                <View style={styles.gripDot} />
              </View>
              <View style={styles.gripCol}>
                <View style={styles.gripDot} />
                <View style={styles.gripDot} />
                <View style={styles.gripDot} />
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
    borderRadius: 16,
    overflow: 'visible',
  },
  cardList: { gap: 8, overflow: 'visible' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingRight: 4,
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
  rowLast: { borderBottomWidth: 0 },
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    flexShrink: 0,
  },
  gripDisabled: { opacity: 0.3 },
  gripCol: { gap: 3 },
  gripDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.muted,
  },
});
