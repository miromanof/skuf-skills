import { describe, expect, it } from 'vitest';
import { dictionaryCards, memeCards } from './builtin-cards.js';

describe('built-in content', () => {
  it('keeps dictionary and meme entries in separate, uniquely named collections', () => {
    expect(dictionaryCards.length).toBeGreaterThan(30);
    expect(memeCards.length).toBeGreaterThan(0);
    expect(dictionaryCards.every((card) => card.type === 'Словарь' || card.type === 'English')).toBe(true);
    expect(memeCards.every((card) => card.type === 'Мемология')).toBe(true);

    const titles = [...dictionaryCards, ...memeCards].map((card) => card.title.toLocaleLowerCase('ru-RU'));
    expect(new Set(titles).size).toBe(titles.length);
  });
});

