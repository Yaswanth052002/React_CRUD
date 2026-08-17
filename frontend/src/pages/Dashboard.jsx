import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "../components/Header.jsx";
import StatsCard from "../components/StatsCard.jsx";
import StatBreakdownPanel from "../components/StatBreakdownPanel.jsx";
import RecentUsersTable from "../components/RecentUsersTable.jsx";
import Notification from "../components/Notification.jsx";
import { getDashboardStats, getUsers } from "../services/userApi.js";

const RECENT_USERS_LIMIT = 5;

let toastId = 0;

export default function Dashboard({ onMenuClick, onUserCountChange, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((type, message) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await getDashboardStats();
      setStats(data);
      onUserCountChange?.(data.total_users);
    } catch (err) {
      // Stats are supplementary — surface via toast rather than blocking the page.
      pushToast("error", "Could not load dashboard stats: " + err.message);
    } finally {
      setLoadingStats(false);
    }
  }, [pushToast, onUserCountChange]);

  const loadRecentUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const data = await getUsers({ page: 1, pageSize: 50 });
      setUsers(data.items);
    } catch (err) {
      // Recent Users is supplementary — surface via toast rather than blocking the page.
      pushToast("error", "Could not load recent users: " + err.message);
    } finally {
      setLoadingUsers(false);
    }
  }, [pushToast]);

  // Initial load
  useEffect(() => {
    loadStats();
    loadRecentUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Recent Users" is derived client-side from the existing getUsers() page (no separate
  // "latest" endpoint/param) by sorting on created_at descending and taking the top N. This
  // holds for any dataset size since it re-derives from the already-fetched page each time,
  // rather than depending on a fixed insertion order.
  const recentUsers = useMemo(
    () =>
      [...users]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, RECENT_USERS_LIMIT),
    [users]
  );

  return (
    <>
      <Header title="Dashboard" onMenuClick={onMenuClick} />
      <div className="page">
        <div className="page__header">
          <div className="page__eyebrow">Overview</div>
          <h1 className="page__title">User Management</h1>
          <p className="page__desc">Manage user accounts, roles, and access status.</p>
        </div>

        <section className="panel" aria-labelledby="user-overview-heading">
          <div className="panel__header">
            <div className="panel__eyebrow">Summary</div>
            <h2 className="panel__title" id="user-overview-heading">
              User Overview
            </h2>
          </div>
          <div className="panel__body">
            <div className="stats-grid" style={{ marginBottom: 0 }}>
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
                // Client-side derivation, per REQUIREMENTS.md SRF-01-FR-2: holds only while
                // Active/Inactive remain the sole two status values.
                value={
                  stats ? Math.max(0, (stats.total_users ?? 0) - (stats.active_users ?? 0)) : 0
                }
                total={stats?.total_users}
                loading={loadingStats}
                color="neutral"
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M8.5 12h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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
              <StatsCard
                label="Regular Users"
                value={stats?.regular_users ?? 0}
                total={stats?.total_users}
                loading={loadingStats}
                color="warning"
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                }
              />
            </div>
          </div>
        </section>

        <div className="dashboard-breakdown-row">
          <StatBreakdownPanel
            title="User Status"
            total={stats?.total_users ?? 0}
            rows={[
              { label: "Active", value: stats?.active_users ?? 0, color: "#0a8a52" },
              {
                label: "Inactive",
                value: stats ? Math.max(0, (stats.total_users ?? 0) - (stats.active_users ?? 0)) : 0,
                color: "var(--ink-muted)",
              },
            ]}
          />
          <StatBreakdownPanel
            title="Users by Role"
            total={stats?.total_users ?? 0}
            rows={[
              { label: "Admins", value: stats?.admin_users ?? 0, color: "#6425d1" },
              { label: "Regular Users", value: stats?.regular_users ?? 0, color: "#b3650a" },
            ]}
          />
        </div>

        {!loadingUsers && (
          <RecentUsersTable users={recentUsers} onViewAll={() => onNavigate?.("users")} />
        )}
      </div>

      <Notification toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
