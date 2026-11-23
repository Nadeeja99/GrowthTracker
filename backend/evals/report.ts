import { recallAtK, type JournalReport } from './journal';
import type { ScenarioReport } from './weekPlan';

export interface EvalReport {
  provider: 'fake' | 'openai';
  ranAt: string;
  journal: JournalReport | null;
  weekPlan: ScenarioReport[] | null;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** A readable summary; the JSON has every question and plan. */
export function formatReport(report: EvalReport): string {
  const lines = [`# GrowthTracker evaluation (${report.provider}, ${report.ranAt.slice(0, 16).replace('T', ' ')} UTC)`];
  if (report.provider === 'fake') {
    lines.push('', '> Fake provider: only **keyword** retrieval is a real measurement. Everything else checks the harness, not quality.');
  }

  const j = report.journal;
  if (j) {
    lines.push('', '## Journal search', '', `Embeddings ${j.embeddings ? 'available' : 'unavailable (keywords only)'}. Recall@8: share of the right notes among the 8 sent to the model. MRR: how high the first right note ranks (1 = top).`, '');
    lines.push('| Method | Recall@8 (all) | words | meaning | period | MRR |', '|---|---|---|---|---|---|');
    for (const [method, s] of Object.entries(j.retrieval)) {
      lines.push(`| ${method} | ${pct(s.all.recallAt8)} | ${pct(s.words.recallAt8)} | ${pct(s.meaning.recallAt8)} | ${pct(s.period.recallAt8)} | ${s.all.mrr.toFixed(2)} |`);
    }
    if (j.answers) {
      const a = j.answers;
      lines.push('', `**Answers:** ${a.withCitations} of ${a.asked} cited notes; ${pct(a.citationPrecision)} of citations were right ones; ${a.citedARightNote} of ${a.asked} cited at least one right note.`);
    }
    const missed = j.perQuestion.filter(q => recallAtK(q.ranks.hybrid, q.relevant) < 1);
    if (missed.length) {
      lines.push('', 'Hybrid search left out right notes for:', ...missed.map(q => `- ${q.id} (${q.kind}) "${q.question}": missing ${q.relevant.filter(id => !q.ranks.hybrid.includes(id)).join(', ')}`));
    }
  }

  const w = report.weekPlan;
  if (w) {
    lines.push('', '## Plan my week', '', '| Scenario | Blocks kept | Goal hours (planned / needed) | Goal score | Skip risk (plan / random) | Task sizing (block / usual) |', '|---|---|---|---|---|---|');
    for (const s of w) {
      if (s.error) {
        lines.push(`| ${s.id} | failed: ${s.error} | | | | |`);
        continue;
      }
      const goals = s.goals.map(g => `${g.goal}: ${g.plannedHours} / ${g.neededHours} h`).join('; ');
      const risk = s.risk ? `${pct(s.risk.plan)} / ${pct(s.risk.randomPlacement)}` : 'no record yet';
      const sizing = s.sizing.length ? s.sizing.map(t => `${t.blockMinutes} / ${t.usuallyTakesMinutes} min`).join('; ') : '-';
      lines.push(`| ${s.id} | ${s.kept} of ${s.proposed} | ${goals}${s.overshoot ? ' (overshoots)' : ''} | ${s.goalScore.toFixed(2)} | ${risk} | ${sizing} |`);
    }
  }
  return lines.join('\n');
}
