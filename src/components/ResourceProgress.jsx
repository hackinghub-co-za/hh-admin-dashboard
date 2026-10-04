import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { isSafeUrl } from '../lib/safeUrl';

// The member's own progress controls on a Resources card: a collapsible
// checklist of the resource's steps (each with its own link, if it has one)
// and a "Mark as completed" toggle. Progress is private to the member.
export default function ResourceProgress({ resource, progress, onToggle }) {
  const steps = resource.steps || [];
  const doneIds = new Set(progress?.steps || []);
  const doneCount = steps.filter((s) => doneIds.has(s.id)).length;
  const completed = !!progress?.completed;
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {steps.length > 0 && (
        <details style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '10px', listStylePosition: 'inside' }}>
            <span>Steps {doneCount}/{steps.length}</span>
            <span aria-hidden="true" style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'var(--bg-tertiary)', overflow: 'hidden', maxWidth: '140px' }}>
              <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--success)', transition: 'width 0.2s ease' }} />
            </span>
          </summary>
          <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {steps.map((step) => {
              const done = doneIds.has(step.id);
              return (
                <li key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id={`rstep-${resource.id}-${step.id}`}
                    checked={done}
                    onChange={(e) => onToggle(step.id, e.target.checked)}
                    style={{ marginTop: '3px', flexShrink: 0 }}
                  />
                  <label
                    htmlFor={`rstep-${resource.id}-${step.id}`}
                    style={{ flex: 1, fontSize: '0.82rem', lineHeight: 1.4, cursor: 'pointer', overflowWrap: 'anywhere', color: done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none' }}
                  >
                    {step.title}
                  </label>
                  {isSafeUrl(step.link) && (
                    <a href={step.link} target="_blank" rel="noopener noreferrer" aria-label={`Open: ${step.title}`} title="Open" style={{ color: 'var(--accent-cyan)', flexShrink: 0, marginTop: '2px' }}>
                      <ExternalLink size={14} />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <button
        type="button"
        aria-pressed={completed}
        onClick={() => onToggle(null, !completed)}
        className="btn btn-secondary"
        style={{ justifyContent: 'center', fontSize: '0.82rem', ...(completed ? { color: 'var(--success)', borderColor: 'var(--success)' } : {}) }}
      >
        {completed ? <><CheckCircle2 size={14} /> Completed</> : <><Circle size={14} /> Mark as completed</>}
      </button>
    </div>
  );
}
