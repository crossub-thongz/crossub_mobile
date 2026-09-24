export function inspectionItemIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('floor')) return 'layers-outline';
  if (n.includes('wall') || n.includes('ceiling') || n.includes('tile')) return 'grid-outline';
  if (n.includes('door')) return 'enter-outline';
  if (
    n.includes('window') ||
    n.includes('blind') ||
    n.includes('curtain') ||
    n.includes('screen')
  ) {
    return 'tablet-landscape-outline';
  }
  if (
    n.includes('vanity') ||
    n.includes('basin') ||
    n.includes('bath') ||
    n.includes('shower') ||
    n.includes('toilet') ||
    n.includes('tap')
  ) {
    return 'water-outline';
  }
  if (n.includes('light') || n.includes('power')) return 'bulb-outline';
  if (n.includes('skirt')) return 'square-outline';
  if (n.includes('dishwasher')) return 'restaurant-outline';
  if (
    n.includes('washing') ||
    n.includes('laundry') ||
    n.includes('dryer')
  ) {
    return 'shirt-outline';
  }
  if (n.includes('exhaust') || n.includes('fan') || n.includes('vent') || n.includes('heat')) {
    return 'sync-outline';
  }
  if (n.includes('towel') || n.includes('rail')) return 'shirt-outline';
  return 'cube-outline';
}
