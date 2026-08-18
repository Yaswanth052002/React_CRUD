import { useEffect, useRef, useState } from "react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_VALUES = { email: "", password: "" };

function validate(values) {
  const errors = {};

  if (!values.email.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_REGEX.test(values.email.trim())) {
    errors.email = "Enter a valid email address";
  }

  if (!values.password) {
    errors.password = "Password is required";
  }

  return errors;
}

export default function LoginForm({ onSubmit, isSubmitting, serverError }) {
  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const emailInputRef = useRef(null);

  // Moves keyboard focus to the primary field (email) whenever this form
  // mounts — covers both the initial Login view and a fresh mount after a
  // logout-triggered redirect back to Login (AUTH-07-TC-11 / NFR-accessibility).
  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const handleChange = (field) => (e) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors(validate(values));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setTouched({ email: true, password: true });
    if (Object.keys(nextErrors).length === 0) {
      onSubmit(values);
    }
  };

  const err = (field) => (touched[field] && errors[field] ? errors[field] : null);

  return (
    <form onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className="form-server-error" role="alert" aria-live="assertive">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          </svg>
          {serverError}
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="login-email">
          Email <span className="required">*</span>
        </label>
        <input
          id="login-email"
          ref={emailInputRef}
          className={`form-input ${err("email") ? "has-error" : ""}`}
          type="email"
          autoComplete="username"
          aria-required="true"
          aria-describedby={err("email") ? "login-email-error" : undefined}
          placeholder="e.g. john@company.com"
          value={values.email}
          onChange={handleChange("email")}
          onBlur={handleBlur("email")}
        />
        {err("email") && (
          <div className="form-error" id="login-email-error">
            {err("email")}
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="login-password">
          Password <span className="required">*</span>
        </label>
        <input
          id="login-password"
          className={`form-input ${err("password") ? "has-error" : ""}`}
          type="password"
          autoComplete="current-password"
          aria-required="true"
          aria-describedby={err("password") ? "login-password-error" : undefined}
          value={values.password}
          onChange={handleChange("password")}
          onBlur={handleBlur("password")}
        />
        {err("password") && (
          <div className="form-error" id="login-password-error">
            {err("password")}
          </div>
        )}
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={isSubmitting}
        style={{ width: "100%", minHeight: 44, minWidth: 44 }}
      >
        {isSubmitting && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
        Log in
      </button>
    </form>
  );
}
