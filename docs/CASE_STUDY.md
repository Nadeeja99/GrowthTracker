# GrowthTracker: case study

A personal planning app taken from a working prototype to a deployable, tested product, with AI features built to be safe around real user data.

**Stack:** Next.js 16 · React 19 · TanStack Query · Tailwind · Express · Prisma · PostgreSQL (Supabase) · OpenAI Responses API · Jest · Vitest · Playwright · GitHub Actions · Render

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
| Quality | 86 API integration tests, 34 unit tests, 26 end-to-end journeys with accessibility checks, CI, and deploys gated on CI. |
| AI | A streaming coach, weekly review, week planner and goal breakdown, all on one guarded request pipeline. |

## Key decisions and trade-offs

### 1. A same-origin proxy instead of cross-site cookies
The app and the API are separate services. On Render both live on `onrender.com`, which is on the Public Suffix List, so `app.onrender.com` and `api.onrender.com` are *different sites*. A refresh cookie set by the API would be third-party, and browsers increasingly block those.

**Decision:** the browser only talks to the Next.js app, which rewrites `/api/*` to the API. The cookie stays first-party with `SameSite=Strict`.

**Consequences, handled in code:**
- The API must not be reachable around the proxy. It rejects requests without a shared secret header, which the Next.js proxy injects.
- Rate limiting needs the real client IP through two hops (`trust proxy = 2`). It can't be spoofed, because direct calls are rejected.

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
Everything runs on free tiers: Render for both services and Supabase for Postgres (Render's free database expires after 30 days).

| Constraint | How it's handled |
|---|---|
| No pre-deploy step on the free tier | Migrations run at the start of the API's start command. |
| Free services sleep after 15 idle minutes | The first visit takes about a minute. Sign-in says "waking up the server" after 4 seconds instead of looking broken, and the session check on page load starts waking the API immediately. |
| A shared demo account | **Try the demo** signs in without a password. The demo is re-seeded on each cold start, so its dates stay current and visitors' changes are undone. "Sign out everywhere" is disabled there, so one visitor can't sign out the rest. |

### 6. Accessibility as a test, not a checklist
Accessibility is checked automatically and treated as a test failure:

- axe-core runs in the end-to-end suite on every page in both themes and on every dialog.
- The dialog checks also cover focus trapping, Escape to close and focus return.
- A sweep fails on any React console warning.

Lighthouse scores 100 for accessibility on every page. Getting there surfaced a real bug that axe at desktop size had missed: icon buttons whose labels were hidden on phones.

## Results

- **Lighthouse (mobile):**
  - accessibility 100 and best practices 100 on every page
  - performance 92–96
  - layout shift close to 0 after making AI cards wait for their status instead of popping in
- **Tests:** 86 backend, 34 frontend unit and 26 end-to-end. CI runs them all, and Render deploys only after CI passes.
- **Security:** the API answers only through the proxy, every relation is ownership-checked, configuration is validated at boot, and failed logins are rate-limited.

## Next steps

- **Faster first paint on app pages.** Largest Contentful Paint is about 3 s on throttled mobile because the session restore and the first data fetch happen client-side, one after the other. Server-rendering the first view, with the session read on the server, would remove that wait.
- **Evaluation for the AI features.** A small set of fixed user snapshots with graded expectations (grounded in the data? sensible plan?), run whenever the prompt or model changes.
- **Error reporting** from the browser, and a usage dashboard over `ai_usage`.
- **Notifications** (a morning plan and an evening review prompt) as a PWA push.
