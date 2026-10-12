import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyItemMarks, serializeItemMarks } from './item-condition-marks.ts';
import { haversineKm } from './travel.ts';

test('a good item serializes as clean, undamaged, and working', () => {
  const marks = emptyItemMarks();
  marks.clean = true;
  marks.undamaged = true;
  marks.working = true;
  assert.deepEqual(serializeItemMarks(marks), ['Clean', 'Undamaged', 'Working']);
});

test('haversine distance across Sydney is a few kilometres', () => {
  const km = haversineKm(-33.8688, 151.2093, -33.8915, 151.2767);
  assert.ok(km > 5 && km < 10);
});
