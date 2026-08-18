import { useState, useEffect } from "react";
import Header from "../components/Header.jsx";
import * as userApi from "../services/userApi.js";

export default function Settings({ onMenuClick, onLogout }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    userApi
      .getCurrentUser()
      .then((data) => {
        setCurrentUser(data);
        setLoadingUser(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoadingUser(false);
      });
  }, []);

  function handleLogout() {
    userApi.logout();
    onLogout();
  }

  return (
    <>
      <Header title="Settings" onMenuClick={onMenuClick} />
      <div className="page">
        <div className="page__header">
          <div className="page__eyebrow">Workspace</div>
          <h1 className="page__title">Settings</h1>
          <p className="page__desc">Your account details and session controls.</p>
        </div>
        <div className="panel">
          {loadingUser && !error && (
            <div className="details-header">
              <div className="details-item">
                <span className="details-item__label">Name</span>
                <span className="details-item__value">
                  <span className="spinner" />
                </span>
              </div>
              <div className="details-item">
                <span className="details-item__label">Email</span>
                <span className="details-item__value">
                  <span className="spinner" />
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="banner banner-error" role="alert">
              {error}
            </div>
          )}
          {!loadingUser && !error && currentUser && (
            <div className="details-grid">
              <div className="details-item">
                <span className="details-item__label">Name</span>
                <span className="details-item__value">{currentUser.name}</span>
              </div>
              <div className="details-item">
                <span className="details-item__label">Email</span>
                <span className="details-item__value">{currentUser.email}</span>
              </div>
            </div>
          )}
          <button className="btn btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </>
  );
}
