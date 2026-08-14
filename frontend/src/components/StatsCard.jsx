const COLOR_MAP = {
  accent: { fg: "var(--accent)", bg: "var(--accent-soft)" },
  success: { fg: "#0a8a52", bg: "var(--success-soft)" },
  violet: { fg: "#6425d1", bg: "var(--violet-soft)" },
  warning: { fg: "#b3650a", bg: "var(--warning-soft)" },
};

export default function StatsCard({ label, value, total, icon, color = "accent", loading }) {
  const c = COLOR_MAP[color] || COLOR_MAP.accent;
  const pct = total && total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="stat-card">
      <div className="stat-card__top">
        <span className="stat-card__label">{label}</span>
        <span className="stat-card__icon" style={{ background: c.bg, color: c.fg }}>
          {icon}
        </span>
      </div>

      {loading ? (
        <div className="skeleton-bar" style={{ width: "50%", height: 26 }} />
      ) : (
        <div className="stat-card__value">{value}</div>
      )}

      <div className="stat-card__bar">
        <div
          className="stat-card__bar-fill"
          style={{ width: loading ? "0%" : `${pct}%`, background: c.fg }}
        />
      </div>
    </div>
  );
}
