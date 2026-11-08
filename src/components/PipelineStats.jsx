import { useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { computePipelineStats, formatDuration } from '../lib/pipelineStats';

// Stats panel at the top of the Sales Pipeline (SalesPipelineBoard). All
// numbers come from computePipelineStats(); see lib/pipelineStats.js for what
// counts. Collapsible, and the chosen period is just for this visit.

const PERIODS = [
  { id: 30, label: 'Last 30 days' },
  { id: 90, label: 'Last 90 days' },
  { id: null, label: 'All time' },
];

function Tile({ value, label, hint }) {
  return (
    <div style={{ background: 'rgba(var(--overlay-rgb), 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '12px 14px', minWidth: 0 }}>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{label}</div>
      {hint && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{hint}</div>}
    </div>
  );
}

function Ranking({ title, rows, total }) {
  const max = Math.max(1, ...rows.map((r) => r.leads));
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px' }}>{title}</div>
      {rows.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>No leads in this period.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {rows.map((r) => (
            <div key={r.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 2fr) auto', gap: '10px', alignItems: 'center', fontSize: '0.78rem' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.label === 'Not tagged' || r.label === 'Added by hand' ? 'var(--text-muted)' : 'var(--text-primary)' }} title={r.label}>{r.label}</span>
              <span style={{ height: '8px', borderRadius: '999px', background: 'rgba(var(--overlay-rgb), 0.06)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${(r.leads / max) * 100}%`, background: 'var(--accent-cyan)', borderRadius: '999px' }} />
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {r.leads} lead{r.leads === 1 ? '' : 's'} · {r.joined} joined{total ? ` · ${Math.round((r.leads / total) * 100)}%` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PipelineStats({ prospects, changes }) {
  const [open, setOpen] = useState(true);
  const [period, setPeriod] = useState(30);
  const s = computePipelineStats(prospects, changes, period);
  const topChannel = s.channels.find((c) => c.label !== 'Not tagged');

  return (
    <div className="glass-card" style={{ padding: '16px 18px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-primary)', font: 'inherit', fontWeight: 700 }}>
          <BarChart3 size={17} color="var(--accent-cyan)" /> Sales stats {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {open && (
          <div role="group" aria-label="Period" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {PERIODS.map((p) => (
              <button
                key={String(p.id)}
                type="button"
                aria-pressed={period === p.id}
                onClick={() => setPeriod(p.id)}
                style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: '999px', cursor: 'pointer', border: `1px solid ${period === p.id ? 'var(--accent-cyan)' : 'var(--border-color)'}`, background: period === p.id ? 'rgba(var(--accent-rgb), 0.15)' : 'transparent', color: period === p.id ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '14px' }}>
            <Tile value={s.newLeads} label="new leads" />
            <Tile value={s.joined} label="joined" hint={s.conversionRate == null ? null : `${s.conversionRate}% of new leads`} />
            <Tile value={formatDuration(s.daysToContact)} label="lead to first contact" hint={s.daysToContactCount ? `median of ${s.daysToContactCount}` : 'not enough data yet'} />
            <Tile value={formatDuration(s.daysToJoin)} label="lead to joined" hint={s.daysToJoinCount ? `median of ${s.daysToJoinCount}` : 'not enough data yet'} />
            <Tile value={topChannel ? topChannel.label : '–'} label="top channel" hint={topChannel ? `${topChannel.leads} lead${topChannel.leads === 1 ? '' : 's'}` : 'tag cards to see this'} />
            <Tile value={s.open} label="still open" hint={s.reachOutsDue ? `${s.reachOutsDue} reach-out${s.reachOutsDue === 1 ? '' : 's'} due` : 'Lead, Contacted, Ready to Join'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '18px' }}>
            <Ranking title="Where they heard about us" rows={s.channels} total={s.newLeads} />
            <Ranking title="How they came in" rows={s.sources} total={s.newLeads} />
          </div>

          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '14px 0 0' }}>
            Counts include cards taken off the board. Timings use cards created from 8 November 2026, when column moves started being recorded.
            {s.newLeads > 0 && ` ${s.notInterested} not interested and ${s.notQualified} not qualified in this period.`}
          </p>
        </>
      )}
    </div>
  );
}
