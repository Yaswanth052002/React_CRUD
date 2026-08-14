import { useState } from "react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\-() ]{7,20}$/;

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  role: "User",
  status: "Active",
};

function validate(values) {
  const errors = {};

  if (!values.name.trim()) {
    errors.name = "Name is required";
  } else if (values.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters";
  }

  if (!values.email.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_REGEX.test(values.email.trim())) {
    errors.email = "Enter a valid email address";
  }

  if (!values.phone.trim()) {
    errors.phone = "Phone is required";
  } else if (!PHONE_REGEX.test(values.phone.trim())) {
    errors.phone = "Enter a valid phone number";
  }

  if (!values.role) errors.role = "Role is required";
  if (!values.status) errors.status = "Status is required";

  return errors;
}

export default function UserForm({ initialValues, mode, onSubmit, onCancel, submitting, serverError }) {
  const [values, setValues] = useState(initialValues || EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

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
    setTouched({ name: true, email: true, phone: true, role: true, status: true });
    if (Object.keys(nextErrors).length === 0) {
      onSubmit(values);
    }
  };

  const err = (field) => (touched[field] && errors[field] ? errors[field] : null);

  return (
    <form onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className="form-server-error">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          </svg>
          {serverError}
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="name">
          Name <span className="required">*</span>
        </label>
        <input
          id="name"
          className={`form-input ${err("name") ? "has-error" : ""}`}
          type="text"
          placeholder="e.g. John Smith"
          value={values.name}
          onChange={handleChange("name")}
          onBlur={handleBlur("name")}
        />
        {err("name") && <div className="form-error">{err("name")}</div>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="email">
          Email <span className="required">*</span>
        </label>
        <input
          id="email"
          className={`form-input ${err("email") ? "has-error" : ""}`}
          type="email"
          placeholder="e.g. john@company.com"
          value={values.email}
          onChange={handleChange("email")}
          onBlur={handleBlur("email")}
        />
        {err("email") && <div className="form-error">{err("email")}</div>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="phone">
          Phone <span className="required">*</span>
        </label>
        <input
          id="phone"
          className={`form-input ${err("phone") ? "has-error" : ""}`}
          type="text"
          placeholder="e.g. 9876543210"
          value={values.phone}
          onChange={handleChange("phone")}
          onBlur={handleBlur("phone")}
        />
        {err("phone") && <div className="form-error">{err("phone")}</div>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="role">
            Role <span className="required">*</span>
          </label>
          <select
            id="role"
            className="form-select"
            value={values.role}
            onChange={handleChange("role")}
            onBlur={handleBlur("role")}
          >
            <option value="User">User</option>
            <option value="Admin">Admin</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="status">
            Status <span className="required">*</span>
          </label>
          <select
            id="status"
            className="form-select"
            value={values.status}
            onChange={handleChange("status")}
            onBlur={handleBlur("status")}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="modal__footer" style={{ padding: "20px 0 0", borderTop: "none" }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
          {mode === "edit" ? "Update User" : "Create User"}
        </button>
      </div>
    </form>
  );
}
