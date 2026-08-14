import Modal from "./Modal.jsx";

export default function DeleteConfirmation({ user, onConfirm, onCancel, deleting }) {
  return (
    <Modal title="Delete user?" onClose={onCancel} size="sm">
      <div className="confirm-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7h14Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="confirm-text">
        Are you sure you want to delete <strong>{user?.name}</strong>? This action can't be undone
        and their record will be permanently removed.
      </p>

      <div className="modal__footer" style={{ padding: "20px 0 0", borderTop: "none" }}>
        <button className="btn btn-secondary" onClick={onCancel} disabled={deleting}>
          Cancel
        </button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={deleting}>
          {deleting && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
          Delete
        </button>
      </div>
    </Modal>
  );
}
