import { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import Sidebar from "./components/Sidebar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Users from "./pages/Users.jsx";
import Settings from "./pages/Settings.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
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

  // LoginScreen itself calls userApi.setAuthToken before invoking this.
  // Signature matches the locked onLoginSuccess={(token) => void} contract
  // (docs/features/AUTH-01/REQUIREMENTS.md); token is unused here since
  // setAuthToken already persisted it, kept for contract parity. Also resets
  // activeView to "dashboard" unconditionally (AUTH-05-FR-2 / condition C-5)
  // so a stale view from a prior session never survives a fresh login.
  function handleLoginSuccess(_token) {
    setIsAuthenticated(true);
    setSessionExpiredMessage(null);
    setActiveView("dashboard");
  }

  // Threaded to Settings.jsx as the onLogout prop (AUTH-06); Settings calls
  // userApi.logout() first, then this handler, which flips isAuthenticated
  // so AUTH-05's guard renders the Login screen.
  function handleLogout() {
    userApi.clearAuthToken();
    setIsAuthenticated(false);
    setSessionExpiredMessage(null);
  }

  // Locked contracts (AUTH-05-FR-1..3): `isAuthenticated` is always a plain
  // boolean (never null/loading — AUTH-04's contract, condition C-1), and
  // `LoginScreen` receives exactly `onLoginSuccess`/`sessionExpiredMessage` —
  // no `authError` prop, no local transformation of `sessionExpiredMessage`
  // (AUTH-01's contract, condition C-2/C-4). Do not reintroduce either.
  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        sessionExpiredMessage={sessionExpiredMessage}
      />
    );
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
          <Settings onMenuClick={() => setSidebarOpen(true)} onLogout={handleLogout} />
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
