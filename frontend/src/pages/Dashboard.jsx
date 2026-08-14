import { useCallback, useEffect, useState } from "react";
import Header from "../components/Header.jsx";
import StatsCard from "../components/StatsCard.jsx";
import Notification from "../components/Notification.jsx";
import { getDashboardStats } from "../services/userApi.js";

let toastId = 0;

export default function Dashboard({ onMenuClick, onUserCountChange }) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

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

  // Initial load
  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Header title="Dashboard" onMenuClick={onMenuClick} />
      <div className="page">
        <div className="page__header">
          <div className="page__eyebrow">Overview</div>
          <h1 className="page__title">User Management</h1>
          <p className="page__desc">Manage user accounts, roles, and access status.</p>
        </div>

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

      <Notification toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
