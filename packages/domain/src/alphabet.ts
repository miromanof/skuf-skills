export function alphabetBucket(title: string): string {
  for (const character of title.normalize('NFC')) {
    const upper = character.toLocaleUpperCase('ru-RU');
    if (/^[А-ЯЁ]$/u.test(upper)) return upper;
    if (/^[A-Z]$/u.test(upper)) return upper;
    if (/^[0-9]$/u.test(upper)) return '0–9';
  }
  return '#';
}
