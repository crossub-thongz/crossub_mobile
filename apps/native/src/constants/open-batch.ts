export const OPEN_BATCH_TIMEZONE = 'Australia/Sydney';

export const OPEN_BATCH_STATE = {
  ACCUMULATING: 'ACCUMULATING',
  SELECTING: 'SELECTING',
  PAST_DEADLINE: 'PAST_DEADLINE',
} as const;

export type OpenBatchStateValue =
  (typeof OPEN_BATCH_STATE)[keyof typeof OPEN_BATCH_STATE];

export const OPEN_ROUTE_STOP_BASIS = {
  COORDINATES: 'COORDINATES',
  SUBURB: 'SUBURB',
  UNPLACED: 'UNPLACED',
} as const;

export const OPEN_ROUTE_BASIS_NOTE: Record<string, string | null> = {
  [OPEN_ROUTE_STOP_BASIS.COORDINATES]: null,
  [OPEN_ROUTE_STOP_BASIS.SUBURB]: 'Placed by suburb — travel time is an estimate',
  [OPEN_ROUTE_STOP_BASIS.UNPLACED]: 'No map position — check the drive yourself',
};

export const OPEN_BATCH_EMPTY = {
  NO_PROPERTIES: {
    title: 'No properties waiting',
    description:
      'Agents add properties through the week. The list closes Wednesday at 12:00pm and you pick from it that afternoon.',
  },
  NOT_RECEIVING: {
    title: "You're on break",
    description:
      'Turn on receiving jobs to select opens from the pool. You can still see what is waiting while you are on break.',
  },
  ALL_TAKEN: {
    title: 'Every open is taken',
    description: 'Other inspectors have picked up everything in this batch.',
  },
} as const;

export const OPEN_TIME_PENDING_LABEL = 'Time set after selection';
