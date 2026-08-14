export default function Header({ title, onMenuClick }) {
  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="topbar__menu-btn" onClick={onMenuClick} aria-label="Open menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <span className="topbar__title">{title}</span>
      </div>

      <div className="topbar__right">
        <div className="admin-chip">
          <div className="admin-chip__avatar">AD</div>
          <div className="admin-chip__text">
            <div className="admin-chip__name">Admin User</div>
            <div className="admin-chip__role">Administrator</div>
          </div>
        </div>
      </div>
    </header>
  );
}
