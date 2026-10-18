import { describe, expect, it } from 'vitest';
import { LOW_SCORE_CAPTIONS, RESULT_CAPTIONS, questionBank, resultCaption, scoreBand, selectQuestions } from './quiz.js';

describe('quiz domain', () => {
  it('selects ten unique questions for the chosen level', () => {
    const questions = selectQuestions('easy', 10, () => 0.25);
    expect(questions).toHaveLength(10);
    expect(new Set(questions.map((question) => question.id)).size).toBe(10);
    expect(questions.every((question) => question.level === 'easy')).toBe(true);
  });

  it('throws instead of repeating questions when a bank is too small', () => {
    expect(() => selectQuestions('easy', questionBank.easy.length + 1)).toThrow(/недостаточно вопросов/i);
  });

  it('uses only plausible sentence-like distractors on the medium level', () => {
    const bannedGiveaways = /килограмм|зарядил|вкусн|автобус|холодильник|духовк|салат|завтрак|поливать|точное время/i;
    for (const question of questionBank.medium) {
      expect(question.options.every((option) => option.length >= 24 && option.includes(' '))).toBe(true);
      expect(question.options.join(' ')).not.toMatch(bannedGiveaways);
    }
  });

  it('uses definition-like distractors without absurd giveaways on the easy level', () => {
    const bannedGiveaways = /килограмм|зарядил|вкусн|автобус|холодильник|духовк|салат|завтрак|поливать|точное время/i;
    for (const question of questionBank.easy) {
      expect(question.options.every((option) => option.length >= 20)).toBe(true);
      expect(question.options.join(' ')).not.toMatch(bannedGiveaways);
    }
  });

  it('keeps hard-level alternatives within the same slang vocabulary', () => {
    const terms = new Set(questionBank.easy.map((question) => question.eyebrow));
    for (const question of questionBank.hard) {
      expect(question.options.every((option) => terms.has(option))).toBe(true);
      expect(new Set(question.options).size).toBe(4);
    }
  });

  it.each([
    [0, 'Скуф detected'], [3, 'Скуф detected'], [4, 'Уже не скуф'], [6, 'Уже не скуф'],
    [7, 'Почти сигма'], [8, 'Почти сигма'], [9, 'Сигма словаря'], [10, 'Сигма словаря'],
  ])('maps score %s to %s', (score, label) => {
    expect(scoreBand(score).label).toBe(label);
  });

  it('keeps exactly the eight approved result captions', () => {
    expect(RESULT_CAPTIONS).toEqual([
      'Я понимаю интернет лучше, чем делаю вид',
      'Мемы меняются — я держусь',
      'Скуфометр сегодня молчит',
      'Вайб распознан, кринж обезврежен',
      'Мой словарный запас — имба',
      'Перевожу с молодёжного без субтитров',
      'Знаю лор, чувствую контекст',
      'Сегодня точно не скуф',
    ]);
  });

  it('keeps the nine approved low-score captions without the rejected eighth draft', () => {
    expect(LOW_SCORE_CAPTIONS).toEqual({
      veryLow: ['Интернет обновился без меня', 'Словарь ещё загружается', 'Мемы пока говорят на иностранном', 'Я пришёл за лором, но лор оказался сильнее'],
      low: ['Уже не офлайн, но ещё в буфере', 'Вайб ловлю, контекст иногда убегает', 'Скуфометр сомневается, но даёт шанс'],
      halfway: ['Ещё немного — и кринж будет обезврежен', 'В комментариях уже почти не теряюсь'],
    });
    expect(JSON.stringify(LOW_SCORE_CAPTIONS)).not.toContain('Половина базы уже в кармане');
  });

  it.each([
    [0, 'Интернет обновился без меня'], [2, 'Интернет обновился без меня'],
    [3, 'Уже не офлайн, но ещё в буфере'], [4, 'Уже не офлайн, но ещё в буфере'],
    [5, 'Ещё немного — и кринж будет обезврежен'],
    [6, 'Я понимаю интернет лучше, чем делаю вид'], [10, 'Я понимаю интернет лучше, чем делаю вид'],
  ])('selects a caption from the score range for %s points', (score, expected) => {
    expect(resultCaption(score, () => 0)).toBe(expected);
  });
});
