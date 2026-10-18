import { useState } from 'react';
import { LEVELS, resultCaption, scoreBand, selectQuestions, type QuizLevel, type QuizQuestion } from './quiz.js';
import { downloadResultCard, shareResult, type QuizResultArt } from './resultCard.js';

type Answer = { question: QuizQuestion; selectedIndex: number };

export function QuizPage({ random = Math.random }: { random?: () => number }) {
  const [level, setLevel] = useState<QuizLevel>();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [review, setReview] = useState(false);
  const [actionStatus, setActionStatus] = useState('');
  const [captionRandom, setCaptionRandom] = useState(0);

  const start = (nextLevel: QuizLevel) => {
    setLevel(nextLevel); setQuestions(selectQuestions(nextLevel, 10, random)); setAnswers([]); setReview(false); setActionStatus('');
    setCaptionRandom(random());
  };
  const finished = questions.length === 10 && answers.length === questions.length;
  const current = questions[answers.length];
  const score = answers.filter(({ question, selectedIndex }) => question.correctIndex === selectedIndex).length;
  const band = scoreBand(score);
  const caption = resultCaption(score, () => captionRandom);
  const art: QuizResultArt = { score, total: 10, band: band.label, caption, levelLabel: level ? LEVELS[level].label : '' };
  const mistakes = answers.filter(({ question, selectedIndex }) => question.correctIndex !== selectedIndex);

  if (!level) return (
    <section className="quiz-page quiz-start">
      <p className="eyebrow"><span /> Тест Skuf Skills</p>
      <h1>Насколько ты<br />не скуф?</h1>
      <p className="quiz-lead">Выбери уровень. В каждом — 10 вопросов, а результат и разбор увидишь только в конце.</p>
      <div className="quiz-levels">
        {(Object.keys(LEVELS) as QuizLevel[]).map((key, index) => <button key={key} type="button" onClick={() => start(key)}><small>0{index + 1} / {LEVELS[key].label}</small><strong>{LEVELS[key].title}</strong><span>{LEVELS[key].description}</span></button>)}
      </div>
    </section>
  );

  if (!finished && current) return (
    <section className="quiz-page quiz-question" aria-live="polite">
      <p className="eyebrow"><span /> {LEVELS[level].label} уровень</p>
      <div className="quiz-progress"><strong>Вопрос {answers.length + 1} из 10</strong><span>{Array.from({ length: 10 }, (_, index) => <i key={index} className={index < answers.length ? 'is-done' : ''} />)}</span></div>
      <article className="quiz-question__card">
        <small>{current.eyebrow}</small><h1>{current.prompt}</h1>
        <div className="quiz-options">{current.options.map((option, index) => <button data-testid="quiz-option" key={option} type="button" onClick={() => setAnswers((value) => [...value, { question: current, selectedIndex: index }])}><b>{String.fromCharCode(65 + index)}</b><span>{option}</span></button>)}</div>
      </article>
    </section>
  );

  return (
    <section className="quiz-page quiz-finish">
      <p className="eyebrow"><span /> Финал теста · {LEVELS[level].label} уровень</p>
      <h1>Поздравляем!<br />Тест пройден</h1>
      <p className="quiz-lead">Сохрани результат квадратной карточкой или сразу поделись им. Подробности и кнопки находятся рядом с карточкой, а на телефоне — под ней.</p>
      <div className="quiz-result">
        <div className="quiz-result-card quiz-result-card--dark-type" aria-label={`Результат ${score} из 10 — ${band.label}`}><div className="quiz-result-card__brand"><b>SKUF</b><b>СКИЛС</b><small className="quiz-result-card__label">ТЕСТ · {LEVELS[level].label}</small></div><p className="quiz-result__score">{score}<span>/ 10</span></p><h2 className="quiz-result-card__band">{band.label}</h2><p className="quiz-result-card__caption">{caption}</p></div>
        <article className="quiz-result-panel"><p className="eyebrow"><span /> Результат</p><h2>{score} из 10.<br />{band.label}</h2><p>{band.description}</p><div className="quiz-result-panel__meter">{Array.from({ length: 10 }, (_, index) => <i key={index} className={index < score ? 'is-filled' : ''} />)}</div>
          <button className="button quiz-action quiz-action--download" type="button" onClick={() => void downloadResultCard(art).then(() => setActionStatus('Карточка скачана.'))}>Скачать карточку</button>
          <button className="button quiz-action quiz-action--share" type="button" onClick={() => void shareResult(art).then((mode) => setActionStatus(mode === 'shared' ? 'Открыто системное меню публикации.' : 'Карточка скачана, а текст результата скопирован.')).catch(() => setActionStatus('Не получилось поделиться. Можно скачать карточку отдельно.'))}>Поделиться результатом</button>
          <button className="button button--dark quiz-action" type="button" onClick={() => setReview(true)}>Разобрать ошибки</button>
          <button className="text-link quiz-retry" type="button" onClick={() => setLevel(undefined)}>Пройти ещё раз</button>
          {actionStatus && <p className="quiz-action-status" role="status">{actionStatus}</p>}
        </article>
      </div>
      {review && <section className="quiz-review"><h2>Разбор ошибок</h2>{mistakes.length === 0 ? <p className="quiz-review__perfect">Ни одной ошибки — это чистые 10 из 10.</p> : mistakes.map(({ question, selectedIndex }, index) => <article key={question.id}><small>Ошибка {index + 1}</small><h3>{question.prompt}</h3><p><b>Твой ответ:</b> {question.options[selectedIndex]}</p><p><b>Правильный ответ:</b> {question.options[question.correctIndex]}</p><p>{question.explanation}</p></article>)}</section>}
    </section>
  );
}
