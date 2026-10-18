import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuizPage } from './QuizPage.js';

describe('QuizPage', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('offers three independent difficulty levels', () => {
    render(<QuizPage />);
    expect(screen.getByRole('button', { name: /лёгкий/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /средний/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /сложный/i })).toBeInTheDocument();
  });

  it('keeps correctness and score hidden until all ten answers are submitted', () => {
    const { container } = render(<QuizPage random={() => 0} />);
    fireEvent.click(screen.getByRole('button', { name: /лёгкий/i }));
    expect(screen.getByText(/вопрос 1 из 10/i)).toBeInTheDocument();
    for (let index = 0; index < 9; index += 1) {
      fireEvent.click(screen.getAllByTestId('quiz-option')[0]!);
      expect(screen.queryByText(/правильно|неверно/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/из 10/i, { selector: '.quiz-result__score' })).not.toBeInTheDocument();
    }
    fireEvent.click(screen.getAllByTestId('quiz-option')[0]!);
    expect(screen.getByRole('heading', { name: /поздравляем! тест пройден/i })).toBeInTheDocument();
    expect(container.querySelector('.quiz-result__score')).toHaveTextContent('3/ 10');
  });

  it('reveals mistakes only after the result action is pressed', () => {
    render(<QuizPage random={() => 0} />);
    fireEvent.click(screen.getByRole('button', { name: /лёгкий/i }));
    for (let index = 0; index < 10; index += 1) fireEvent.click(screen.getAllByTestId('quiz-option').at(-1)!);
    expect(screen.queryByRole('heading', { name: /разбор ошибок/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /разобрать ошибки/i }));
    expect(screen.getByRole('heading', { name: /разбор ошибок/i })).toBeInTheDocument();
  });

  it('places the test label below the result-card logo', () => {
    const { container } = render(<QuizPage random={() => 0} />);
    fireEvent.click(screen.getByRole('button', { name: /лёгкий/i }));
    for (let index = 0; index < 10; index += 1) fireEvent.click(screen.getAllByTestId('quiz-option')[0]!);
    const brand = container.querySelector('.quiz-result-card__brand');
    expect(brand).toContainElement(container.querySelector('.quiz-result-card__label'));
    expect(container.querySelector('.quiz-result-card')).toHaveClass('quiz-result-card--dark-type');
  });

  it('renders the rotating caption as a separate result-card sticker', () => {
    const { container } = render(<QuizPage random={() => 0} />);
    fireEvent.click(screen.getByRole('button', { name: /лёгкий/i }));
    for (let index = 0; index < 10; index += 1) fireEvent.click(screen.getAllByTestId('quiz-option')[0]!);
    expect(container.querySelector('.quiz-result-card__caption')).toHaveTextContent('Уже не офлайн, но ещё в буфере');
    expect(container.querySelector('.quiz-result-card__band')).toHaveTextContent('Скуф detected');
  });
});
