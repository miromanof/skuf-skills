import { describe, expect, it } from 'vitest';
import { alphabetBucket } from '../src/alphabet.js';

describe('alphabetBucket', () => {
  it.each([
    ['Аура', 'А'],
    ['pov', 'P'],
    ['42', '0–9'],
    ['  «Вайб»', 'В'],
    ['— "Glow up"', 'G'],
    ['😀 вайб', 'В'],
    ['', '#'],
    ['!?', '#'],
  ])('maps %j to %s', (title, bucket) => {
    expect(alphabetBucket(title)).toBe(bucket);
  });
});
