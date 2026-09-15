export const COMMON_DEFAULT_SECTIONS = [
  'Walls / Picture Hooks',
  'Doors / Door Frames',
  'Windows / Screens / Window Safety Devices',
  'Ceiling / Light Fittings',
  'Blinds / Curtains',
  'Lights / Power Points',
  'Skirting Boards',
  'Floor Coverings',
] as const;

export const BATHROOM_DEFAULT_SECTIONS = [
  'Walls/tiles',
  'Floor tiles/floor coverings',
  'Doors/doorway frames',
  'Windows/screens/window safety devices',
  'Ceiling/light fittings',
  'Blinds/curtains',
  'Lights/power points',
  'Bath/taps',
  'Shower/screen/taps',
  'Wash basin/taps',
  'Mirror/cabinet/vanity',
  'Towel rails',
  'Toilet/cistern/seat',
  'Toilet roll holder',
  'Heating/exhaust fan/vent',
  'Other',
] as const;

export const LAUNDRY_DEFAULT_SECTIONS = [
  'Walls/tiles',
  'Floor tiles/floor coverings',
  'Doors/doorway frames',
  'Windows/screens/window safety devices',
  'Ceiling/light fittings',
  'Blinds/curtains',
  'Lights/power points',
  'Washing machine/taps',
  'Exhaust fan/vent',
  'Washing tub',
  'Dryer',
  'Other',
] as const;

export type InspectionAreaDefinition = {
  name: string;
  defaultSections: readonly string[];
  optionalSections: readonly string[];
};

export const INSPECTION_AREA_CATALOG: readonly InspectionAreaDefinition[] = [
  { name: 'Entry', defaultSections: COMMON_DEFAULT_SECTIONS, optionalSections: ['Custom / Other'] },
  { name: 'Lounge Room', defaultSections: COMMON_DEFAULT_SECTIONS, optionalSections: ['Custom / Other'] },
  { name: 'Dining Room', defaultSections: COMMON_DEFAULT_SECTIONS, optionalSections: ['Custom / Other'] },
  { name: 'Living Room', defaultSections: COMMON_DEFAULT_SECTIONS, optionalSections: ['Custom / Other'] },
  {
    name: 'Kitchen',
    defaultSections: COMMON_DEFAULT_SECTIONS,
    optionalSections: [
      'Cupboards / Drawers',
      'Bench Tops / Tiling',
      'Sink / Taps / Disposal Unit',
      'Stove Top / Hot Plates',
      'Oven / Grill',
      'Exhaust Fan / Hood',
      'Dishwasher',
      'Custom / Other',
    ],
  },
  {
    name: 'Laundry',
    defaultSections: LAUNDRY_DEFAULT_SECTIONS,
    optionalSections: ['Cupboards / Drawers', 'Bench Tops / Tiling', 'Sink / Taps / Disposal Unit', 'Custom / Other'],
  },
  { name: 'Bedroom', defaultSections: COMMON_DEFAULT_SECTIONS, optionalSections: ['Custom / Other'] },
  { name: 'Bathroom', defaultSections: BATHROOM_DEFAULT_SECTIONS, optionalSections: ['Custom / Other'] },
  { name: 'Ensuite', defaultSections: BATHROOM_DEFAULT_SECTIONS, optionalSections: ['Custom / Other'] },
  {
    name: 'Balcony',
    defaultSections: COMMON_DEFAULT_SECTIONS,
    optionalSections: ['Balustrade / Railings', 'Custom / Other'],
  },
  {
    name: 'Garage',
    defaultSections: [],
    optionalSections: [
      'Garage Door & Remote Control',
      'Walls / Ceiling',
      'Floor / Concrete Slab',
      'Lights / Power Points',
      'Shelving / Storage Areas',
      'Custom / Other',
    ],
  },
  {
    name: 'Security',
    defaultSections: [],
    optionalSections: [
      'External Door Locks',
      'Window Locks',
      'Keys / Security Remotes / Fobs',
      'Security Cameras',
      'Security Alarms',
      'Smoke Alarms',
      'Electrical Safety Switches',
      'Custom / Other',
    ],
  },
  {
    name: 'General & Exterior',
    defaultSections: [],
    optionalSections: [
      'Heating / Air Conditioning',
      'Staircase / Handrails',
      'External Television Antenna / TV Points',
      'Lawn & Garden',
      'Garden Hose / Fittings / Watering System',
      'Gates & Fences / Pool Fence & Gate',
      'Letterbox / Street Number',
      'Water Tanks / Septic Tanks',
      'Garbage Bins',
      'Pavement / Driveway',
      'Clothes Line',
      'Garage / Carport / Storeroom',
      'Hot Water System',
      'Gutters / Downpipes',
      'Custom / Other',
    ],
  },
];

export function catalogAreaNameFor(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  const exact = INSPECTION_AREA_CATALOG.find((area) => area.name.toLowerCase() === lower);
  if (exact) return exact.name;
  const numbered = /^(.+?)\s+\d+$/.exec(trimmed);
  if (!numbered) return undefined;
  const base = numbered[1].trim().toLowerCase();
  return INSPECTION_AREA_CATALOG.find((area) => area.name.toLowerCase() === base)?.name;
}

export function getInspectionAreaDefinition(name: string): InspectionAreaDefinition | undefined {
  const catalogName = catalogAreaNameFor(name);
  if (!catalogName) return undefined;
  const def = INSPECTION_AREA_CATALOG.find((area) => area.name === catalogName);
  if (!def) return undefined;
  const trimmed = name.trim();
  return def.name === trimmed ? def : { ...def, name: trimmed };
}

function normalizeRoom(name: string): string {
  return name.trim().toLowerCase();
}

export function defaultSectionsForRoom(name: string): string[] {
  const catalog = getInspectionAreaDefinition(name);
  if (catalog) return [...catalog.defaultSections];
  const key = normalizeRoom(name);
  if (key.includes('bath') || key.includes('ensuite')) return [...BATHROOM_DEFAULT_SECTIONS];
  if (key.includes('laundry')) return [...LAUNDRY_DEFAULT_SECTIONS];
  return [...COMMON_DEFAULT_SECTIONS];
}

export function sectionAreaName(area: string, section: string): string {
  return `${area} \u00b7 ${section}`;
}

export function parseSectionAreaName(
  combined: string,
): { area: string; section: string } | null {
  const sep = ' \u00b7 ';
  const idx = combined.indexOf(sep);
  if (idx <= 0) return null;
  return {
    area: combined.slice(0, idx).trim(),
    section: combined.slice(idx + sep.length).trim(),
  };
}

export function photoAreaName(
  room: string,
  section: string,
  side?: 'ingoing' | 'outgoing',
): string {
  const base = sectionAreaName(room, section);
  if (side === 'ingoing') return `${base} (Ingoing)`;
  if (side === 'outgoing') return `${base} (Outgoing)`;
  return base;
}
