export function SimShell({ scan = true, stressed = false, children }) {
  return <div className={`sim${scan ? ' scan' : ''}${stressed ? ' stressed' : ''}`}><div className="sim-main">{children}</div></div>;
}

export function TopBar({ items }) {
  return (
    <div className="sim-top">
      {items.map((it, i) => <span key={i} className={it.tone || ''}>{it.text}</span>)}
    </div>
  );
}

export function Meter({ label, value, color }) {
  return (
    <div>
      <span className="s-h" style={{ marginBottom: 2 }}>{label} {Math.round(value)}</span>
      <div className="s-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
        <i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      </div>
    </div>
  );
}
