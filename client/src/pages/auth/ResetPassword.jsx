import { useMemo, useState } from "react";
import AuthShell from "../../components/layout/AuthShell";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../services/api";
import { Alert, Button, Field, PasswordField } from "../../components/ui";

/**
 * Finishing a password reset: the emailed code, then the new password.
 *
 * Every other session ends when this succeeds, which the page says plainly
 * — somebody who knew the old password should not stay signed in on their
 * own device.
 */
export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: location.state?.email || "",
    code: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const devCode = location.state?.devCode;

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const mismatch = useMemo(
    () => form.confirm.length > 0 && form.confirm !== form.password,
    [form.confirm, form.password]
  );

  const submit = async (e) => {
    e.preventDefault();
    if (mismatch) {
      setErrors({ confirm: "The two passwords do not match." });
      return;
    }

    setBusy(true);
    setProblem("");
    try {
      await api.resetPassword({ email: form.email, code: form.code, password: form.password });
      navigate("/login", {
        replace: true,
        state: { note: "Your password is set. Log in with it now." },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setProblem(Object.keys(err.fieldErrors).length ? "" : err.message);
      } else {
        setProblem("Something went wrong. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="k-narrow">
        <h1 className="mb-3 text-[2rem] sm:text-[2.5rem]">Set a new password</h1>
        <p className="mb-9 text-muted">
          Enter the code we emailed you, then choose something new.
        </p>

        <Alert>{problem}</Alert>

        {devCode && (
          <Alert tone="info">
            Development only: your code is <strong className="text-rose">{devCode}</strong>.
          </Alert>
        )}

        <form onSubmit={submit} noValidate>
          <Field
            label="Email"
            id="email"
            type="email"
            value={form.email}
            onChange={set("email")}
            error={errors.email}
            autoComplete="email"
            required
          />

          <Field
            label="Code from your email"
            id="code"
            value={form.code}
            onChange={set("code")}
            error={errors.code}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            required
          />

          <PasswordField
            label="New password"
            id="password"
            value={form.password}
            onChange={set("password")}
            error={errors.password}
            hint="At least 8 characters, with a capital, a lower-case letter and a number."
            autoComplete="new-password"
            required
          />

          <PasswordField
            label="New password again"
            id="confirm"
            value={form.confirm}
            onChange={set("confirm")}
            error={errors.confirm || (mismatch ? "The two passwords do not match." : "")}
            autoComplete="new-password"
            required
          />

          <p className="mb-6 text-xs leading-relaxed text-muted">
            Setting a new password logs you out everywhere else.
          </p>

          <Button type="submit" size="lg" block loading={busy}>
            {busy ? "Saving" : "Save my new password"}
          </Button>
        </form>

        <p className="mt-7 text-center text-sm text-muted">
          <Link to="/login" className="font-semibold text-rose">
            Back to log in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
