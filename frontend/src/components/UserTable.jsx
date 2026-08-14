function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function SkeletonRows({ count = 5 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="skeleton-row">
          <td><div className="skeleton-bar" style={{ width: 30 }} /></td>
          <td><div className="skeleton-bar" style={{ width: 160 }} /></td>
          <td><div className="skeleton-bar" style={{ width: 130 }} /></td>
          <td><div className="skeleton-bar" style={{ width: 90 }} /></td>
          <td><div className="skeleton-bar" style={{ width: 60 }} /></td>
          <td><div className="skeleton-bar" style={{ width: 60 }} /></td>
          <td><div className="skeleton-bar" style={{ width: 90 }} /></td>
          <td><div className="skeleton-bar" style={{ width: 60 }} /></td>
        </tr>
      ))}
    </>
  );
}

export default function UserTable({ users, loading, onView, onEdit, onDelete, onAddUser, hasActiveFilters }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && <SkeletonRows />}

          {!loading && users.length === 0 && (
            <tr>
              <td colSpan={8}>
                <div className="state-block">
                  <div className="state-block__icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M3.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <path d="M17 9l3 3m0 0-3 3m3-3h-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="state-block__title">
                    {hasActiveFilters ? "No users match your search" : "No users yet"}
                  </div>
                  <div className="state-block__desc">
                    {hasActiveFilters
                      ? "Try a different search term, or clear the role/status filters."
                      : "Get started by adding your first user to the system."}
                  </div>
                  {!hasActiveFilters && (
                    <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onAddUser}>
                      + Add User
                    </button>
                  )}
                </div>
              </td>
            </tr>
          )}

          {!loading &&
            users.map((user) => (
              <tr key={user.id}>
                <td className="cell-id">#{String(user.id).padStart(4, "0")}</td>
                <td>
                  <div className="cell-user">
                    <div
                      className="avatar"
                      style={{ background: user.role === "Admin" ? "var(--violet)" : "var(--accent)" }}
                    >
                      {initials(user.name)}
                    </div>
                    <span className="cell-user__name">{user.name}</span>
                  </div>
                </td>
                <td className="cell-mono">{user.email}</td>
                <td className="cell-mono">{user.phone}</td>
                <td>
                  <span className={`badge ${user.role === "Admin" ? "badge-admin" : "badge-user"}`}>
                    {user.role}
                  </span>
                </td>
                <td>
                  <span className={`badge ${user.status === "Active" ? "badge-active" : "badge-inactive"}`}>
                    {user.status}
                  </span>
                </td>
                <td className="cell-mono">{formatDate(user.created_at)}</td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn view" onClick={() => onView(user)} aria-label={`View ${user.name}`} title="View">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.6" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </button>
                    <button className="icon-btn" onClick={() => onEdit(user)} aria-label={`Edit ${user.name}`} title="Edit">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      className="icon-btn danger"
                      onClick={() => onDelete(user)}
                      aria-label={`Delete ${user.name}`}
                      title="Delete"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7h14Z"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
