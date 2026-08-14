import Modal from "./Modal.jsx";

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

export default function UserDetails({ user, onClose }) {
  if (!user) return null;

  return (
    <Modal title="User details" onClose={onClose}>
      <div className="details-header">
        <div
          className="details-avatar"
          style={{
            background: user.role === "Admin" ? "var(--violet)" : "var(--accent)",
          }}
        >
          {initials(user.name)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{user.name}</div>
          <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>{user.email}</div>
        </div>
      </div>

      <div className="details-grid">
        <div className="details-item">
          <span className="details-item__label">User ID</span>
          <span className="details-item__value mono">#{String(user.id).padStart(4, "0")}</span>
        </div>
        <div className="details-item">
          <span className="details-item__label">Phone</span>
          <span className="details-item__value mono">{user.phone}</span>
        </div>
        <div className="details-item">
          <span className="details-item__label">Role</span>
          <span className={`badge ${user.role === "Admin" ? "badge-admin" : "badge-user"}`}>
            {user.role}
          </span>
        </div>
        <div className="details-item">
          <span className="details-item__label">Status</span>
          <span className={`badge ${user.status === "Active" ? "badge-active" : "badge-inactive"}`}>
            {user.status}
          </span>
        </div>
        <div className="details-item">
          <span className="details-item__label">Created</span>
          <span className="details-item__value">{formatDate(user.created_at)}</span>
        </div>
        <div className="details-item">
          <span className="details-item__label">Last updated</span>
          <span className="details-item__value">{formatDate(user.updated_at)}</span>
        </div>
      </div>

      <div className="modal__footer" style={{ padding: "20px 0 0", borderTop: "none" }}>
        <button className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
