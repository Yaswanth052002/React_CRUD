function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function RecentUsersTable({ users, onViewAll }) {
  return (
    <section className="panel" aria-labelledby="recent-users-heading">
      <div className="panel__header">
        <div className="panel__eyebrow">Latest activity</div>
        <h2 className="panel__title" id="recent-users-heading">
          Recent Users
        </h2>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td className="cell-mono">{user.email}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel__body" style={{ paddingTop: 0 }}>
        <button className="btn btn-secondary" onClick={onViewAll}>
          View All Users →
        </button>
      </div>
    </section>
  );
}
