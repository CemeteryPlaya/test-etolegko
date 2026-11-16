import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, formatMbps, formatMBps, toMegabitsPerSecond } from '../src/format.js';

test('перевод в Мбит/с — десятичные мегабиты', () => {
  assert.equal(toMegabitsPerSecond(125_000), 1);
  assert.equal(formatMbps(12_500_000), '100.00 Мбит/с');
  assert.equal(formatMBps(12_500_000), '12.50 МБ/с');
});

test('formatBytes выбирает подходящую единицу', () => {
  assert.equal(formatBytes(512), '512 Б');
  assert.equal(formatBytes(1_500), '1.50 КБ');
  assert.equal(formatBytes(2_500_000), '2.50 МБ');
  assert.equal(formatBytes(3_000_000_000), '3.00 ГБ');
});
