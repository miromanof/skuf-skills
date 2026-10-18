# Skuf Skills Quiz — Design Specification

## Goal

Add a free, client-side ten-question quiz that lets a visitor choose easy, medium, or hard difficulty, keeps the score hidden until the end, explains mistakes, and produces a square result card that can be downloaded or shared.

## Experience

- Entry points: a `Тест` item in the main navigation and a prominent home-page call to action.
- The start screen offers three independent levels:
  - Easy — choose the meaning of a term.
  - Medium — choose the phrase where a term is used correctly.
  - Hard — infer the term from conversational context.
- Every run contains 10 non-repeating questions from the chosen level.
- During the run the visitor sees progress, but not correctness or score.
- The final screen uses the approved neo-brutalist layout: large congratulatory heading, square purple result card, score, score band, eight-segment progress strip, and actions.
- The result card contains exactly one of eight approved rotating captions. The caption catalogue is not shown in the interface.
- Result bands: 0–3 `Скуф detected`, 4–6 `Уже не скуф`, 7–8 `Почти сигма`, 9–10 `Сигма словаря`.

## Result actions

- `Скачать карточку` renders a 1080×1080 PNG and downloads it.
- `Поделиться результатом` uses Web Share with the PNG when file sharing is supported.
- If system sharing is unavailable, the site downloads the PNG and copies a short result text when clipboard access is available.
- `Разобрать ошибки` reveals all incorrect answers, the correct answers, and short explanations. If there are no mistakes it shows a perfect-result message.
- `Пройти ещё раз` returns to the level picker.

## Content and privacy

- Questions and answers live in the web bundle; no backend or paid service is required.
- Quiz progress remains in component memory and is not sent to a server.
- The first release uses an editorial static bank with at least 10 questions for each level.

## Responsive and accessibility requirements

- At mobile widths, the result card and result controls stack vertically, with no directional copy such as “left” or “right”.
- The page must not create horizontal scrolling at about 390 px.
- Answers use native buttons, focus states, `aria-live` for changing question/result status, and meaningful action labels.
- The generated PNG contains the same score, band, brand, difficulty, and rotating caption as the visible result card.

## Test coverage

- Unit tests cover unique question selection, scoring bands, and the eight-caption catalogue.
- UI tests cover route/entry points, level selection, ten unanswered-without-feedback steps, final result, mistake review, download, share, and fallback behavior.
- Existing project tests, typecheck, mobile CSS check, and production build must remain green.
