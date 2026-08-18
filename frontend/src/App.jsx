import { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Users from "./pages/Users.jsx";
import * as userApi from "./services/userApi.js";

const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please log in again.";

/**
 * Returns true when a stored token is present and not yet expired per its
 * `exp` claim. Any decode failure (malformed token) is treated identically
 * to "no token" — never throws.
 */
function isTokenValid(token) {
  if (!token) return false;
  try {
    const { exp } = jwtDecode(token);
    return typeof exp === "number" && exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function SettingsPlaceholder({ onMenuClick }) {
  return (
    <>
      <Header title="Settings" onMenuClick={onMenuClick} />
      <div className="page">
        <div className="page__header">
          <div className="page__eyebrow">Workspace</div>
          <h1 className="page__title">Settings</h1>
          <p className="page__desc">Configuration options for this console.</p>
        </div>
        <div className="panel">
          <div className="state-block">
            <div className="state-block__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </div>
            <div className="state-block__title">Nothing here yet</div>
            <div className="state-block__desc">
              Settings for this dashboard (API endpoint, theme, etc.) can be added here as the
              project grows.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userCount, setUserCount] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    isTokenValid(userApi.getStoredToken())
  );
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState(null);

  // Mount-time expiry check: a token may be present but expired (or
  // malformed) since the initializer above already ran. If so, clear it and
  // surface the session-expired message before any protected view renders.
  useEffect(() => {
    const token = userApi.getStoredToken();
    if (token && !isTokenValid(token)) {
      userApi.clearAuthToken();
      setIsAuthenticated(false);
      setSessionExpiredMessage(SESSION_EXPIRED_MESSAGE);
      console.log("auth_session_expired");
    }
  }, []);

  // Wire the shared 401 handler once on mount so any subsequent unauthorized
  // response redirects to Login with the same session-expired message.
  useEffect(() => {
    userApi.registerUnauthorizedHandler(() => {
      setIsAuthenticated(false);
      setSessionExpiredMessage(SESSION_EXPIRED_MESSAGE);
    });
  }, []);

  // Forward-reference: consumed by AUTH-05 when it wires LoginScreen into
  // the render tree; LoginScreen itself calls userApi.setAuthToken before
  // invoking this. Signature matches the locked onLoginSuccess={(token) =>
  // void} contract (docs/features/AUTH-01/REQUIREMENTS.md); token is unused
  // here since setAuthToken already persisted it, kept for contract parity.
  function handleLoginSuccess(_token) {
    setIsAuthenticated(true);
    setSessionExpiredMessage(null);
  }

  // Forward-reference: exists so AUTH-07's logout action has a ready-made
  // handler to call; this story adds no logout-triggering UI element.
  function handleLogout() {
    userApi.clearAuthToken();
    setIsAuthenticated(false);
    setSessionExpiredMessage(null);
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        userCount={userCount}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main-col">
        {activeView === "settings" ? (
          <SettingsPlaceholder onMenuClick={() => setSidebarOpen(true)} />
        ) : activeView === "users" ? (
          <Users onMenuClick={() => setSidebarOpen(true)} onUserCountChange={setUserCount} />
        ) : (
          <Dashboard
            onMenuClick={() => setSidebarOpen(true)}
            onUserCountChange={setUserCount}
            onNavigate={setActiveView}
          />
        )}
      </div>
    </div>
  );
}
