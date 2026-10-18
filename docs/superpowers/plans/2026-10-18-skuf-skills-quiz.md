# Skuf Skills Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and connect the approved three-level, ten-question quiz with downloadable/shareable result art and end-only mistake review.

**Architecture:** Keep pure quiz data and scoring helpers in a focused feature module, render the interaction in a dedicated React page, and isolate canvas/share browser integrations behind small exported helpers. App routing and the home/header entry points remain in `App.tsx`; quiz styling lives with the existing global design system.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Canvas API, Web Share API

**Spec:** `docs/superpowers/specs/2026-10-18-skuf-skills-quiz-design.md`

## Global Constraints

- Exactly 10 questions per run and no repeated question ids.
- Score and correctness stay hidden until the final answer.
- Exactly eight approved captions; show one only inside the result card.
- No backend, paid dependency, or personal-data storage.
- The 390 px layout has no horizontal page overflow.

## Review Focus

- A level bank with fewer than ten entries fails clearly rather than returning duplicates.
- Repeated answer clicks cannot skip questions or inflate score.
- Perfect scores produce an empty-error state instead of a blank panel.
- Browsers without canvas sharing still receive a useful fallback action.
- Route changes reset an unfinished attempt.

---

### Task 1: Quiz domain model and editorial bank

**Files:**
- Create: `apps/web/src/features/quiz/quiz.ts`
- Test: `apps/web/src/features/quiz/quiz.test.ts`

**Interfaces:**
- Produces: `QuizLevel`, `QuizQuestion`, `selectQuestions(level, count, random)`, `scoreBand(score)`, `RESULT_CAPTIONS`, `questionBank`.

- [ ] Write failing tests for ten unique questions, score bands, insufficient banks, and eight captions.
- [ ] Run the focused test and confirm RED.
- [ ] Implement the types, helpers, and at least ten editorial questions per level.
- [ ] Run the focused test and full suite; confirm GREEN.

### Task 2: Quiz route and interaction

**Files:**
- Create: `apps/web/src/features/quiz/QuizPage.tsx`
- Create: `apps/web/src/features/quiz/QuizPage.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: Task 1 quiz model.
- Produces: `QuizPage` mounted at `#/quiz`, level picker, question flow, result, and mistake review.

- [ ] Write failing UI tests for navigation, level selection, hidden score, ten answers, result bands, and mistake review.
- [ ] Run the focused tests and confirm RED.
- [ ] Implement the route and interaction with single-click answer locking.
- [ ] Run focused tests and full suite; confirm GREEN.

### Task 3: Download and share actions

**Files:**
- Create: `apps/web/src/features/quiz/resultCard.ts`
- Create: `apps/web/src/features/quiz/resultCard.test.ts`
- Modify: `apps/web/src/features/quiz/QuizPage.tsx`

**Interfaces:**
- Produces: `renderResultCard(result)`, `downloadResultCard(result)`, `shareResult(result)`.

- [ ] Write failing tests for canvas output, download, native file share, and download/clipboard fallback.
- [ ] Run focused tests and confirm RED.
- [ ] Implement 1080×1080 rendering and progressive sharing.
- [ ] Run focused tests and full suite; confirm GREEN.

### Task 4: Approved responsive visual design

**Files:**
- Modify: `apps/web/src/styles/global.css`
- Modify: `scripts/check-mobile-css.mjs`

**Interfaces:**
- Consumes: Task 2 markup and Task 3 actions.

- [ ] Extend the mobile CSS check with quiz selectors and no-overflow guards; confirm it fails.
- [ ] Add the approved desktop/mobile styling and visible focus states.
- [ ] Run mobile CSS check, typecheck, tests, and build.

### Task 5: Final verification

**Files:** No production changes expected.

- [ ] Verify easy, medium, and hard flows manually at desktop and ~390 px.
- [ ] Verify download, share fallback, and mistake review.
- [ ] Run `npm test`, `npm run check:mobile-css`, `npm run typecheck`, and `npm run build`.
- [ ] Review the complete diff against the specification and commit the finished feature.
