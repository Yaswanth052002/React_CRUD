import { useCallback, useEffect, useRef, useState } from "react";
import Header from "../components/Header.jsx";
import StatsCard from "../components/StatsCard.jsx";
import UserTable from "../components/UserTable.jsx";
import Modal from "../components/Modal.jsx";
import UserForm from "../components/UserForm.jsx";
import UserDetails from "../components/UserDetails.jsx";
import DeleteConfirmation from "../components/DeleteConfirmation.jsx";
import Notification from "../components/Notification.jsx";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getDashboardStats,
} from "../services/userApi.js";

let toastId = 0;

export default function Users({ onMenuClick, onUserCountChange }) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const PAGE_SIZE = 50;

  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [toasts, setToasts] = useState([]);

  const debounceRef = useRef(null);

  const pushToast = useCallback((type, message) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setLoadError(null);
    try {
      const data = await getUsers({
        search,
        role: roleFilter,
        status: statusFilter,
        page,
        pageSize: PAGE_SIZE,
      });
      setUsers(data.items);
      setTotalUsers(data.total);
      onUserCountChange?.(data.total);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoadingUsers(false);
    }
  }, [search, roleFilter, statusFilter, page, onUserCountChange]);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      // Stats are supplementary — surface via toast rather than blocking the page.
      pushToast("error", "Could not load dashboard stats: " + err.message);
    } finally {
      setLoadingStats(false);
    }
  }, [pushToast]);

  // Initial load
  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search/filter changes reset to page 1 (their effect on `page` triggers the load below).
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, statusFilter]);

  // Debounced search + immediate filter/page changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadUsers();
    }, search ? 300 : 0);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, statusFilter, page]);

  const refreshAll = async () => {
    await Promise.all([loadUsers(), loadStats()]);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormError(null);
    setModalMode("create");
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormError(null);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingUser(null);
    setFormError(null);
  };

  const handleFormSubmit = async (values) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (modalMode === "edit" && editingUser) {
        await updateUser(editingUser.id, values);
        pushToast("success", "User updated successfully!");
      } else {
        await createUser(values);
        pushToast("success", "User created successfully!");
      }
      closeModal();
      await refreshAll();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      await deleteUser(deletingUser.id);
      pushToast("success", "User deleted successfully!");
      setDeletingUser(null);
      await refreshAll();
    } catch (err) {
      pushToast("error", err.message);
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilters = Boolean(search) || roleFilter !== "All" || statusFilter !== "All";

  // Inactive is derived client-side as total_users - active_users because
  // GET /api/dashboard/stats does not (and per ADR-3 will not, for this story)
  // return an inactive_users field. This holds only while Active/Inactive are
  // the sole two status values — a third status value would require revisiting
  // this formula.
  const inactiveUsers = (stats?.total_users ?? 0) - (stats?.active_users ?? 0);

  return (
    <>
      <Header title="Users" onMenuClick={onMenuClick} />
      <div className="page">
        <div className="page__header">
          <div className="page__eyebrow">Management</div>
          <h1 className="page__title">User Management</h1>
          <p className="page__desc">Manage user accounts, roles, and access status.</p>
        </div>

        {loadError && (
          <div className="alert alert-danger">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            </svg>
            <div>
              <strong>Couldn't load users.</strong> {loadError}
            </div>
          </div>
        )}

        <div className="stats-grid">
          <StatsCard
            label="Total Users"
            value={stats?.total_users ?? 0}
            total={stats?.total_users}
            loading={loadingStats}
            color="accent"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
                <path d="M3.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <circle cx="17" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.7" />
                <path d="M15.5 14.2c2.7.2 4.9 2.5 4.9 5.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            }
          />
          <StatsCard
            label="Active Users"
            value={stats?.active_users ?? 0}
            total={stats?.total_users}
            loading={loadingStats}
            color="success"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
          <StatsCard
            label="Inactive Users"
            value={inactiveUsers}
            total={stats?.total_users}
            loading={loadingStats}
            color="warning"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
                <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            }
          />
          <StatsCard
            label="Admins"
            value={stats?.admin_users ?? 0}
            total={stats?.total_users}
            loading={loadingStats}
            color="violet"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3l2.6 2.7 3.7-.6.9 3.6 3.4 1.5-1.5 3.4.6 3.7-3.7.6L15.3 21 12 18.7 8.7 21l-2.7-3.1-3.7-.6.6-3.7L1.4 10 4.8 8.5l.9-3.6 3.7.6L12 3Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
        </div>

        <div className="panel">
          <div className="toolbar">
            <div className="search-input">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search users"
              />
            </div>

            <div className="toolbar__filters">
              <select
                className="select-field"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filter by role"
              >
                <option value="All">All Roles</option>
                <option value="Admin">Admin</option>
                <option value="User">User</option>
              </select>

              <select
                className="select-field"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <button className="btn btn-primary" onClick={openCreateModal}>
                + Add User
              </button>
            </div>
          </div>

          <UserTable
            users={users}
            loading={loadingUsers}
            onView={setViewingUser}
            onEdit={openEditModal}
            onDelete={setDeletingUser}
            onAddUser={openCreateModal}
            hasActiveFilters={hasActiveFilters}
          />

          {!loadingUsers && totalUsers > 0 && (
            <div className="pagination" aria-label="Pagination">
              <span aria-live="polite">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalUsers)} of{" "}
                {totalUsers}
              </span>
              <div className="pagination__controls">
                <button
                  className="btn btn-secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * PAGE_SIZE >= totalUsers}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modalMode && (
        <Modal title={modalMode === "edit" ? "Edit User" : "Add New User"} onClose={closeModal}>
          <UserForm
            mode={modalMode}
            initialValues={
              modalMode === "edit" && editingUser
                ? {
                    name: editingUser.name,
                    email: editingUser.email,
                    phone: editingUser.phone,
                    role: editingUser.role,
                    status: editingUser.status,
                  }
                : undefined
            }
            onSubmit={handleFormSubmit}
            onCancel={closeModal}
            submitting={submitting}
            serverError={formError}
          />
        </Modal>
      )}

      {viewingUser && <UserDetails user={viewingUser} onClose={() => setViewingUser(null)} />}

      {deletingUser && (
        <DeleteConfirmation
          user={deletingUser}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingUser(null)}
          deleting={deleting}
        />
      )}

      <Notification toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
