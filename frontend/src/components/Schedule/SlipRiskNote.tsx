import { AlertTriangle } from 'lucide-react';
import type { BlockRisk } from '@/lib/api';
import { cn } from '@/lib/utils';

/** "Likely to slip", with the reasons, for a block the skip-risk model flags. */
export function SlipRiskNote({ risk, className }: { risk?: Pick<BlockRisk, 'likelyToSlip' | 'reasons'> | null; className?: string }) {
  if (!risk?.likelyToSlip) return null;
  return (
    <p className={cn('flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-200', className)}>
      <AlertTriangle className="w-3.5 h-3.5 mt-px flex-shrink-0" aria-hidden="true" />
      <span>
        <span className="font-semibold">Likely to slip</span>
        {risk.reasons.length > 0 && <>: {risk.reasons.join('; ')}</>}
      </span>
    </p>
  );
}
