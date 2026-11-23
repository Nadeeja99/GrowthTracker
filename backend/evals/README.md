# Evaluation set for the AI features

Fixed, labelled scenarios that grade the AI features the same way every time, so a change of prompt or model can be compared with the last run instead of judged by eye.

| Suite | What it measures |
|---|---|
| **Journal search** ([`journal/`](journal)) | 40 invented daily notes and 20 questions, each labelled with the notes that answer it. For keywords only, meaning only, and the app's hybrid search: **recall@8**, the share of right notes among the 8 sent to the model, and **MRR**, how high the first right note ranks. Results are split by question type: *words* (share words with the answer), *meaning* (worded differently) and *period* ("last 10 days"). |
| **Journal answers** | Whether each answer cites notes, and whether the notes it cites are right ones. |
| **Plan my week** ([`weekPlan.ts`](weekPlan.ts)) | Four scenarios, each scored on: the share of the model's blocks that survive the server's rules; how close each goal's planned hours come to what it still needs; the plan's average **skip risk** against blocks placed at random in the same free time; and whether task blocks are sized from how long the person's tasks really take. |

## Running it

It needs a disposable Postgres database with pgvector, whose name ends in `_test`, because it wipes it. Use the same database as the backend tests.

```bash
cd backend

# Harness check with the fake provider: free, no key needed
TEST_DATABASE_URL=postgresql://…/growthtracker_test npm run eval

# The real thing, with your own key
TEST_DATABASE_URL=postgresql://…/growthtracker_test OPENAI_API_KEY=sk-… \
  npm run eval -- --provider openai --out eval-report.json
```

`--suite journal` or `--suite week-plan` runs one part. The key is only ever read from the command line: `.env` isn't loaded.

**Cost with OpenAI:** about 24 model requests (20 answers and 4 plans) plus a few thousand embedding tokens: roughly one or two cents at the default model's prices.

## Reading the results

- **With the fake provider, only keyword retrieval is a real measurement**, because it needs no AI. On this set, keywords find every note for *words* and *period* questions, but only about 1 in 5 for *meaning* questions. That's the gap the embeddings are there to close, and the OpenAI run measures how much of it they close. CI runs the fake suite on every push (`tests/evals.test.ts`) and checks the keyword numbers.
- **Plan my week has no single right answer**, so the scores describe a plan rather than pass or fail it. Watch for blocks dropped by the server rules, overshooting a goal, a skip risk no better than random placement, and task blocks sized from the raw estimate.
- **Keep reports from real runs** (`--out`) to compare before and after changing a prompt or model.

## Adding cases

- **A journal question:** add it to [`journal/questions.json`](journal/questions.json) with the ids of every note that answers it. Add notes to [`journal/notes.json`](journal/notes.json) if needed, each on its own day.
- **A planning scenario:** add it to `SCENARIOS` in [`weekPlan.ts`](weekPlan.ts).
- All data here is invented. Never copy real notes into this folder: it's public.
