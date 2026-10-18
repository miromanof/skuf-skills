export type QuizResultArt = { score: number; total: number; band: string; caption: string; levelLabel: string };

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Не удалось создать PNG')), 'image/png'));
}

function wrappedLines(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderResultCard(result: QuizResultArt): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1080;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Браузер не поддерживает создание карточки');
  context.fillStyle = '#6037ff'; context.fillRect(0, 0, 1080, 1080);
  context.strokeStyle = '#baff2a'; context.lineWidth = 110; context.beginPath(); context.arc(910, 930, 330, 0, Math.PI * 2); context.stroke();
  context.fillStyle = '#fff'; context.font = '900 92px Arial Black, Arial'; context.fillText('SKUF', 85, 145);
  context.fillStyle = '#ff5dad'; context.fillText('СКИЛС', 115, 225);
  context.fillStyle = '#171717'; context.font = '900 32px Arial'; context.fillText(`ТЕСТ · ${result.levelLabel.toUpperCase()}`, 115, 275);
  context.font = '900 190px Arial Black, Arial'; context.fillText(String(result.score), 80, 650);
  const scoreWidth = context.measureText(String(result.score)).width;
  context.font = '900 62px Arial'; context.fillText(`/ ${result.total}`, 80 + scoreWidth + 14, 650);
  context.fillStyle = '#171717'; context.font = '900 58px Arial Black, Arial';
  context.fillText(result.band.toUpperCase(), 85, 790);
  context.font = '800 30px Arial';
  const captionLines = wrappedLines(context, result.caption, 440);
  context.save(); context.translate(520, 880); context.rotate(-0.025);
  context.fillStyle = '#171717'; context.fillRect(0, 0, 480, 28 + captionLines.length * 40);
  context.fillStyle = '#fff';
  captionLines.forEach((line, index) => context.fillText(line, 22, 44 + index * 40));
  context.restore();
  return canvasBlob(canvas);
}

function saveBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'skuf-skills-result.png'; link.click();
  URL.revokeObjectURL(url);
}

export async function downloadResultCard(result: QuizResultArt) { saveBlob(await renderResultCard(result)); }

export async function shareResult(result: QuizResultArt): Promise<'shared' | 'downloaded'> {
  const blob = await renderResultCard(result);
  const file = new File([blob], 'skuf-skills-result.png', { type: 'image/png' });
  const text = `Мой результат в Skuf Skills: ${result.score}/${result.total} — ${result.band}. ${result.caption}`;
  if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share({ title: 'Skuf Skills — результат теста', text, files: [file] });
    return 'shared';
  }
  saveBlob(blob);
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text).catch(() => undefined);
  return 'downloaded';
}
