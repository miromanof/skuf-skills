import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadResultCard, renderResultCard, shareResult, type QuizResultArt } from './resultCard.js';

const result: QuizResultArt = { score: 8, total: 10, band: 'Почти сигма', caption: 'Я понимаю интернет лучше, чем делаю вид', levelLabel: 'Сложный' };

function canvasContext(overrides: Record<string, unknown> = {}) {
  return {
    fillRect: vi.fn(), fillText: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(),
    measureText: () => ({ width: 200 }), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
    ...overrides
  } as unknown as CanvasRenderingContext2D;
}

describe('result card actions', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

  it('renders a square PNG canvas', async () => {
    const context = canvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })));
    const blob = await renderResultCard(result);
    expect(blob.type).toBe('image/png');
  });

  it('draws black typography and positions the test label below the logo', async () => {
    const drawn: Array<{ text: string; color: string }> = [];
    const fillText = vi.fn(function (this: { fillStyle: string }, text: string) { drawn.push({ text, color: this.fillStyle }); });
    const context = canvasContext({ fillText, fillStyle: '' });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })));
    await renderResultCard(result);
    expect(drawn).toContainEqual({ text: 'SKUF', color: '#fff' });
    expect(drawn).toContainEqual({ text: 'СКИЛС', color: '#ff5dad' });
    expect(drawn).toContainEqual({ text: '8', color: '#171717' });
    expect(fillText).toHaveBeenCalledWith('ТЕСТ · СЛОЖНЫЙ', 115, 275);
    expect(fillText).toHaveBeenCalledWith('/ 10', 294, 650);
  });

  it('draws the rotating caption in white on a tilted dark sticker', async () => {
    const drawn: Array<{ text: string; color: string }> = [];
    const fillText = vi.fn(function (this: { fillStyle: string }, text: string) { drawn.push({ text, color: this.fillStyle }); });
    const context = {
      fillRect: vi.fn(), fillText, beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(),
      measureText: (text: string) => ({ width: text.length * 18 }), save: vi.fn(), restore: vi.fn(),
      translate: vi.fn(), rotate: vi.fn(), fillStyle: ''
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })));
    await renderResultCard(result);
    expect(drawn).toContainEqual({ text: 'Я понимаю интернет', color: '#fff' });
    expect(drawn).toContainEqual({ text: 'лучше, чем делаю вид', color: '#fff' });
    expect(drawn).toContainEqual({ text: 'ПОЧТИ СИГМА', color: '#171717' });
    expect(fillText).toHaveBeenCalledWith('ПОЧТИ СИГМА', 85, 790);
    expect(context.translate).toHaveBeenCalledWith(520, 880);
    expect(context.rotate).toHaveBeenCalledWith(-0.025);
  });

  it('downloads the rendered PNG', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext());
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })));
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:result', revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await downloadResultCard(result);
    expect(click).toHaveBeenCalledOnce();
  });

  it('uses native file sharing when available', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext());
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })));
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { canShare: () => true, share });
    await shareResult(result);
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: expect.any(Array) }));
  });

  it('downloads and copies the result when native sharing is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext());
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })));
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:result', revokeObjectURL: vi.fn() });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await expect(shareResult(result)).resolves.toBe('downloaded');
    expect(click).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('8/10'));
  });
});
