import { useState } from "react";
import LoginForm from "./LoginForm";
import { login, setAuthToken } from "../services/userApi";

const GENERIC_AUTH_ERROR = "Invalid email or password. Please try again.";

export default function LoginScreen({ onLoginSuccess, sessionExpiredMessage = null }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState(null);

  const handleSubmit = async ({ email, password }) => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      const { token } = await login(email, password);
      setAuthToken(token);
      onLoginSuccess(token);
    } catch {
      setAuthError(GENERIC_AUTH_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {sessionExpiredMessage && (
          <div className="form-server-error" role="alert" aria-live="assertive">
            {sessionExpiredMessage}
          </div>
        )}
        <div className="panel">
          <div className="panel__header">
            <div className="panel__eyebrow">Welcome back</div>
            <h1 className="panel__title">Sign in</h1>
          </div>
          <div className="panel__body">
            <LoginForm onSubmit={handleSubmit} isSubmitting={isSubmitting} serverError={authError} />
          </div>
        </div>
      </div>
    </div>
  );
}
