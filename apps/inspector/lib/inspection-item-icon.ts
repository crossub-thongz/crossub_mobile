import type { LucideIcon } from 'lucide-react';
import {
  AppWindow,
  Bath,
  Box,
  DoorOpen,
  Fan,
  Lamp,
  Layers,
  PanelsTopLeft,
  Shirt,
  Square,
  UtensilsCrossed,
  WashingMachine,
} from 'lucide-react';

export function inspectionItemIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes('floor')) return Layers;
  if (n.includes('wall') || n.includes('ceiling') || n.includes('tile')) {
    return PanelsTopLeft;
  }
  if (n.includes('door')) return DoorOpen;
  if (n.includes('window') || n.includes('blind') || n.includes('curtain') || n.includes('screen')) {
    return AppWindow;
  }
  if (
    n.includes('vanity') ||
    n.includes('basin') ||
    n.includes('bath') ||
    n.includes('shower') ||
    n.includes('toilet') ||
    n.includes('tap')
  ) {
    return Bath;
  }
  if (n.includes('light') || n.includes('power')) return Lamp;
  if (n.includes('skirt')) return Square;
  if (n.includes('dishwasher')) return UtensilsCrossed;
  if (n.includes('washing') || n.includes('laundry') || n.includes('dryer')) {
    return WashingMachine;
  }
  if (n.includes('exhaust') || n.includes('fan') || n.includes('vent') || n.includes('heat')) {
    return Fan;
  }
  if (n.includes('towel') || n.includes('rail')) return Shirt;
  return Box;
}
