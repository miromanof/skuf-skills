export type QuizResultArt = { score: number; total: number; band: string; caption: string; levelLabel: string; ownerName?: string };

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
  context.fillStyle = '#fff8e7'; context.fillRect(0, 0, 1080, 1080);
  context.fillStyle = '#ff5f57'; context.fillRect(0, 0, 32, 1080);
  context.save(); context.translate(865, 78); context.rotate(-0.32);
  context.fillStyle = '#ffd84d';
  for (let stripe = -180; stripe < 360; stripe += 46) context.fillRect(stripe, 0, 22, 300);
  context.restore();
  context.save(); context.translate(84, 66); context.rotate(-0.035);
  context.fillStyle = '#171717'; context.font = '900 126px Arial Black, Arial'; context.fillText('SKUF', 0, 94);
  context.fillStyle = '#ff5f57'; context.fillText('СКИЛС', 0, 176);
  context.restore();
  context.fillStyle = '#171717'; context.font = '900 32px Arial'; context.fillText(`ТЕСТ · ${result.levelLabel.toUpperCase()}`, 84, 238);
  const ownerName = result.ownerName?.trim();
  if (ownerName) {
    context.font = '900 26px Arial';
    context.fillText(`КАРТОЧКА · ${ownerName.toUpperCase()}`, 84, 335);
  }
  context.fillStyle = '#2868ff'; context.font = '900 190px Arial Black, Arial'; context.fillText(String(result.score), 84, 650);
  const scoreWidth = context.measureText(String(result.score)).width;
  context.fillStyle = '#171717'; context.font = '900 62px Arial'; context.fillText(`/ ${result.total}`, 84 + scoreWidth + 14, 650);
  context.fillStyle = '#171717'; context.font = '900 58px Arial Black, Arial';
  context.fillText(result.band.toUpperCase(), 84, 790);
  context.font = '800 30px Arial';
  const captionLines = wrappedLines(context, result.caption, 760);
  context.save(); context.translate(84, 866); context.rotate(-0.012);
  context.fillStyle = '#2868ff'; context.fillRect(8, 8, 820, 34 + captionLines.length * 44);
  context.fillStyle = '#ffd84d'; context.fillRect(0, 0, 820, 34 + captionLines.length * 44);
  context.strokeStyle = '#171717'; context.lineWidth = 6; context.strokeRect(0, 0, 820, 34 + captionLines.length * 44);
  context.fillStyle = '#171717';
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
  const owner = result.ownerName?.trim() ? `${result.ownerName.trim()}: ` : '';
  const text = `${owner}мой результат в Skuf Skills: ${result.score}/${result.total} — ${result.band}. ${result.caption}`;
  if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share({ title: 'Skuf Skills — результат теста', text, files: [file] });
    return 'shared';
  }
  saveBlob(blob);
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text).catch(() => undefined);
  return 'downloaded';
}

