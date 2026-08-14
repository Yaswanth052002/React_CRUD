import { useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";
import Dashboard from "./pages/Dashboard.jsx";

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

  return (
    <div className="app-shell">
      <Sidebar
        activeView={activeView === "users" ? "dashboard" : activeView}
        onNavigate={setActiveView}
        userCount={userCount}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main-col">
        {activeView === "settings" ? (
          <SettingsPlaceholder onMenuClick={() => setSidebarOpen(true)} />
        ) : (
          <Dashboard onMenuClick={() => setSidebarOpen(true)} onUserCountChange={setUserCount} />
        )}
      </div>
    </div>
  );
}
