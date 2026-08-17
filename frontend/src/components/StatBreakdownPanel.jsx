export default function StatBreakdownPanel({ title, rows, total }) {
  return (
    <section className="panel" aria-labelledby={`breakdown-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <div className="panel__header">
        <div className="panel__eyebrow">Breakdown</div>
        <h2 className="panel__title" id={`breakdown-${title.replace(/\s+/g, "-").toLowerCase()}`}>
          {title}
        </h2>
      </div>
      <div className="panel__body">
        <div className="breakdown-rows">
          {rows.map((row) => {
            const pct = total && total > 0 ? Math.round((row.value / total) * 100) : 0;
            return (
              <div className="breakdown-row" key={row.label}>
                <div className="breakdown-row__top">
                  <span className="breakdown-row__label">{row.label}</span>
                  <span className="breakdown-row__value">{row.value}</span>
                </div>
                <div className="stat-card__bar">
                  <div
                    className="stat-card__bar-fill"
                    style={{ width: `${pct}%`, background: row.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
