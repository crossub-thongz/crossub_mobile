'use client';

import { Wallet } from 'lucide-react';

import { EmptyState } from '@/components/inspector/empty-state';
import { JobTypeBadge } from '@/components/inspector/status-badge';
import { InspectorShell } from '@/components/layout/inspector-shell';
import { ROUTINE_OPEN_INSPECTOR_FEE_INC_GST_AUD } from '@/constants/inspection-rates';
import { useInspectorData } from '@/components/providers/inspector-data-provider';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function EarningsPage() {
  const { earnings, summary } = useInspectorData();

  const totalClaimed = earnings
    .filter((e) => e.accountingSynced)
    .reduce((s, e) => s + e.laborAmount, 0);
  const totalUnclaimed = earnings
    .filter((e) => !e.accountingSynced)
    .reduce((s, e) => s + e.laborAmount, 0);

  return (
    <InspectorShell title="Earnings">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-center">
            <p className="text-muted-foreground text-[9px] font-medium uppercase">
              This week
            </p>
            <p className="text-primary mt-0.5 text-lg font-bold tabular-nums">
              {formatCurrency(summary.weeklyEarnings)}
            </p>
          </div>
          <div className="rounded-lg border border-border/80 bg-card p-2.5 text-center">
            <p className="text-muted-foreground text-[9px] font-medium uppercase">
              Claimed
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-400">
              {formatCurrency(totalClaimed)}
            </p>
          </div>
          <div className="rounded-lg border border-border/80 bg-card p-2.5 text-center">
            <p className="text-muted-foreground text-[9px] font-medium uppercase">
              Unclaimed
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-400">
              {formatCurrency(totalUnclaimed)}
            </p>
          </div>
        </div>

        <p className="text-muted-foreground text-center text-[10px]">
          Routine &amp; open: ${ROUTINE_OPEN_INSPECTOR_FEE_INC_GST_AUD} inc GST · Entry/Final: agent price list
        </p>

        <section className="space-y-1">
          <h2 className="text-xs font-semibold">Payment history</h2>
          {earnings.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No earnings yet"
              description="Complete inspections to see payments here."
            />
          ) : (
            earnings.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 rounded-lg border border-border/70 bg-card px-2.5 py-2"
              >
                <JobTypeBadge type={e.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{e.propertyAddress}</p>
                  <p className="text-muted-foreground text-[10px]">
                    {formatDate(e.completedAt)} · {e.hoursWorked}h
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-primary text-xs font-semibold tabular-nums">
                    {formatCurrency(e.laborAmount)}
                  </p>
                  <p
                    className={`text-[9px] font-medium ${
                      e.accountingSynced ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {e.accountingSynced ? 'Paid' : 'Not paid'}
                  </p>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </InspectorShell>
  );
}
