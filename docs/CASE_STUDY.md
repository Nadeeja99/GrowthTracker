# GrowthTracker: case study

A personal planning app taken from a working prototype to a deployable, tested product, with AI features built to be safe around real user data.

**Stack:** Next.js 16 · React 19 · TanStack Query · Tailwind · Express · Prisma · PostgreSQL (Supabase) · OpenAI Responses API · Python (statsmodels, pandas, scikit-learn) · Jest · Vitest · pytest · Playwright · GitHub Actions · Vercel · Render

---

## The problem

Most planners are good at *listing* work and bad at showing whether time went where it should. GrowthTracker is built around one loop:

1. **Plan** the week with goals that carry weekly hour targets.
2. **Do** the day from time blocks, using a focus timer.
3. **Review** each day (performance, energy, mood, notes).
4. **Learn** what actually moves each goal.

The starting point was a feature-rich prototype that wasn't usable in practice:

- Several sections overlapped (goals, schedule and tasks each had their own view of the same work).
- Some data lived only in the browser.
- There were no tests or migrations, and secrets were handled loosely.

The work was to make it something you'd trust with your week, and that an employer could run, read and test.

## Scope of the work

| Area | What changed |
|---|---|
| Product | Merged overlapping sections into five tabs (Today, Plan, Goals, Habits, Insights). Moved browser-only data (reviews, subtasks, focus sessions) to the server. |
| Backend | Validated config, rate limiting, request IDs, structured logs, ownership checks on every relation, versioned migrations, a demo seed. |
| Auth | 15-minute in-memory access tokens, rotating httpOnly refresh cookie, "sign out everywhere" via a token version. |
| Frontend | A server-state cache with targeted invalidation, a design system with light and dark themes, skeletons, error boundaries, toasts that say what failed and why. |
| Quality | 294 API integration tests, 178 unit tests, 25 Python tests, 59 end-to-end journeys with accessibility checks, CI, and deploys gated on CI. |
| Phone | Works offline with check-ins that sync later, opens instantly from saved data, and sends morning and evening push digests. |
| Capture | Plain-English quick add with a live preview, parsed on the device, and a private calendar feed for other calendar apps. |
| AI | A streaming coach, weekly review, week planner and goal breakdown, all on one guarded request pipeline. |
| Journal | Free keyword search over daily notes, and answers with hybrid retrieval (full-text search plus pgvector) whose citations are checked by the server. |
| Machine learning | A Python pipeline and notebook that train and evaluate a model of how long each person's tasks really take, served in the API as estimate suggestions with honest ranges. |

## Key decisions and trade-offs

### 1. A same-origin proxy instead of cross-site cookies
The app and the API are separate services on different sites: the app on `vercel.app`, the API on `onrender.com`. (Both are on the Public Suffix List, so even two subdomains of either would be *different sites*.) A refresh cookie set by the API would be third-party, and browsers increasingly block those.

**Decision:** the browser only talks to the Next.js app, which rewrites `/api/*` to the API. The cookie stays first-party with `SameSite=Strict`.

**Consequences, handled in code:**
- The API must not be reachable around the proxy. It rejects requests without a shared secret header, which the Next.js proxy injects.
- Rate limiting needs the real client IP through the proxy chain (`trust proxy = 3`). It can't be spoofed, because direct calls are rejected. Moving the app to Vercel added a hop, which showed up as one client's requests landing in several rate-limit buckets.

### 2. Tokens: short-lived, in memory, rotated
The access token never touches `localStorage`. On page load the app restores the session from the httpOnly refresh cookie.

Concurrent requests that hit an expired token share a single refresh. Only a 401 from the refresh itself signs the user out, so a rate limit or a blip never logs anyone out by accident.

### 3. AI that can't damage data
The model is treated as an untrusted input source:

- **Server-side only.** The OpenAI key never reaches the browser. Without a key, the AI features say so and everything else works.
- **Opt-in.** Nothing is sent until the user turns the coach on, and the panel lists exactly what is shared. Email and password are never sent, and requests use `store: false`.
- **Structured output, then validated again.** The one-shot features ask for strict JSON-schema output and validate it again with zod. A test keeps each schema and its validator in sync.
- **Rules a model can't be trusted with live in code:**
  - suggested blocks must fall in the chosen window, start in the future, and not overlap existing blocks or each other
  - milestone dates must sit between today and the goal's deadline
  - goal links must point to the user's own goals
  - local times are converted with the offset in force *at that moment*, so plans are right on daylight-saving changeover days (a bug found and fixed along the way)
- **Prompt injection.** User data is wrapped as data, separate from the instructions, and the model can only *propose* changes. Applying one is an explicit click, handled by ordinary authorised endpoints. Double-applying is prevented with a row lock.
- **Cost control.**
  - One request at a time per user, a daily budget per user, a separate budget for the shared demo account, and a global daily cap.
  - Every call is logged with its feature and token counts, and failed calls don't count against the user.
  - The default model costs roughly $0.0002 per coach message.

**Streaming:** coach replies stream over Server-Sent Events through the Next.js proxy. `Cache-Control: no-transform` stops the compression middleware from buffering them. Closing the panel or pressing Stop aborts the upstream request, so unread tokens aren't paid for.

### 4. Testing AI without paying for it
CI has no API key. There are two layers:

- **A fake model** behind the provider interface, for route logic: quotas, opt-in, validation and errors.
- **A local HTTP server that speaks the Responses API's streaming protocol** (`backend/tests/fake-openai.ts`). The *real* OpenAI SDK is pointed at it, so request shape, stream parsing, tool calls and error mapping are tested end to end.

The same fake server powers the Playwright suite, which drives the coach, weekly review and planner in a real browser.

### 5. Free hosting, honestly
Everything runs on free tiers: Vercel for the app, Render for the API and Supabase for Postgres (Render's free database expires after 30 days). The app moved from Render to Vercel so that it no longer sleeps; only the API does.

| Constraint | How it's handled |
|---|---|
| No pre-deploy step on the free tier | Migrations run at the start of the API's start command. |
| The free API sleeps after 15 idle minutes | The first visit takes about a minute. Sign-in says "waking up the server" after 4 seconds instead of looking broken, and the session check on page load starts waking the API immediately. |
| A shared demo account | **Try the demo** signs in without a password. The demo is re-seeded on each cold start, so its dates stay current and visitors' changes are undone. "Sign out everywhere" is disabled there, so one visitor can't sign out the rest. |

### 6. Accessibility as a test, not a checklist
Accessibility is checked automatically and treated as a test failure:

- axe-core runs in the end-to-end suite on every page in both themes and on every dialog.
- The dialog checks also cover focus trapping, Escape to close and focus return.
- A sweep fails on any React console warning.

Lighthouse scores 100 for accessibility on every page. Getting there surfaced a real bug that axe at desktop size had missed: icon buttons whose labels were hidden on phones.

### 7. Two imperfect searches instead of one
Daily notes are short and personal. Keyword search misses "exhausted" when you ask about being tired, while embeddings blur the exact words a journal is full of, like a physio's name. Whichever one is chosen fails on a common question. A vector database was also more than this needed: each search covers one person's few hundred notes.

**Decision:** run both inside Postgres and merge their rankings by position (reciprocal rank fusion), since their scores can't be compared. There's no vector index, because an exact scan of one user's notes took about 20 ms on three years of data and is more accurate.

**Consequences, handled in code:**
- Notes are embedded the first time someone asks, not when they're saved. Nothing leaves the app until the feature is used, and the free tier needs no background job.
- Neither search understands time, so a question naming a period is parsed with rules and limited to that period.
- The model can invent a plausible date, so citations are checked on the server against the notes it was given.
- A restricted API key may not allow embeddings, so retrieval falls back to keywords and the answer says so.

### 8. A small model, evaluated the way it's used
The app records an estimate and, through the focus timer, the time a task really took. That's enough to tell someone *"tasks like this usually take you about 1h 25m"*. Two problems shaped the design: there's no real dataset (one person's tasks are far too few), and a bad suggestion is worse than none.

**Decision:** a linear mixed model on log(actual ÷ estimate), fitted in Python on **simulated users**, and served from a 1 KB JSON file inside the API.

- **Why this model.** People differ far more than tasks do, so most of the signal is personal. A mixed model shares strength between people (partial pooling): with three timed tasks the answer stays close to the population, with fifty it's mostly the person's own record, and the variances decide how fast. Gradient boosting given the same information did no better (error 0.290 against 0.287), and would have been a larger, harder-to-explain artefact.
- **Why simulated data, and how to keep that honest.** The simulator's assumptions are written down, and three things are deliberately left out of the model: noise that varies by person, interrupted tasks, and improving estimates. Because the truth is known, the notebook shows the fit recovers the effects it was given, and how much error no model could remove.
- **Evaluated as it's used.** Users are split into train, validation and test groups. Each test user's tasks are replayed in order, predicting every task only from earlier ones. Two settings (how much history to use, and when to start showing suggestions) were chosen on validation users only.
- **Ranges that mean what they say.** The "8 in 10" range comes from split conformal prediction, sized separately for people with more or less history. It contained 81% of test tasks, and ranges for 50–95% all landed within 2.5 points of target.

**Consequences, handled in code:**
- The personal offsets have a closed form, so the API needs no ML runtime: one query for the person's latest 50 timed tasks, then arithmetic. The closed form matches statsmodels' estimates to 10⁻¹⁴.
- Two implementations can drift apart, so the pipeline writes 29 test cases that the TypeScript must reproduce to 9 decimal places. CI retrains from scratch and fails if the committed model is stale, and the API refuses to start with a model file whose features don't match its code. Writing those checks caught a real mismatch: a clamp stored rounded to 6 decimals made the API differ from Python by about 10⁻⁸.
- Population effects learned from simulated people are assumptions for real ones, so suggestions wait until a person's own record outweighs them: 3 timed tasks, derived from the fitted variances.

## Results

- **Lighthouse (mobile):**
  - accessibility 100 and best practices 100 on every page
  - performance 92–96
  - layout shift close to 0 after making AI cards wait for their status instead of popping in
- **Tests:** 294 backend, 178 frontend unit, 25 Python and 59 end-to-end. CI runs them all, and Vercel and Render deploy only after CI passes.
- **Estimate suggestions (80 unseen simulated users):** the average miss fell from 36.8 minutes with the raw estimate to 26.2, against a noise floor of 24.7. That's 88% of the removable error, and better than each person's own median overrun (28.6).
- **Security:** the API answers only through the proxy, every relation is ownership-checked, configuration is validated at boot, and failed logins are rate-limited.

## Next steps

- **Faster first paint on app pages.** Largest Contentful Paint is about 3 s on throttled mobile because the session restore and the first data fetch happen client-side, one after the other. Server-rendering the first view, with the session read on the server, would remove that wait.
- **Evaluation for the AI features.** A small set of fixed user snapshots with graded expectations (grounded in the data? sensible plan?), run whenever the prompt or model changes.
- **A usage dashboard** over `ai_usage`.
- **Retrain on real data.** The pipeline can already read the app's data export, and scores the shipped model on one person's file. Retraining needs many people's data, which doesn't exist yet.
