import { useState } from "react";
import AuthShell from "../../components/layout/AuthShell";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BRAND } from "../../config/brand";
import { api, ApiError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Alert, Button, Field, PasswordField } from "../../components/ui";
import GoogleButton from "../../components/shared/GoogleButton";

/**
 * Signing in, with either an email address or a mobile number.
 *
 * An account that has never confirmed its email is sent to the code screen
 * rather than refused, because that is the one thing standing between them
 * and getting in.
 */
const ENDED = {
  signed_out: "You were signed out by our support team. Please log in again.",
  device_signed_out: "This device was signed out from your account settings. Please log in again.",
  contact_changed: "Your email or mobile was changed by our support team. Please log in again.",
  suspended: "Your account has been suspended. Contact support for help.",
  banned: "This account has been closed.",
};

export default function Login() {
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const { signIn, signInWithOtp } = useAuth();
  const ended = new URLSearchParams(useLocation().search).get("ended") || "";
  // "password" or "otp": an SMS code to the mobile instead of a password.
  const [mode, setMode] = useState("password");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // Where they were headed before being asked to sign in.
  const goingTo = location.state?.from?.pathname || "/dashboard";

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setProblem("");
    setBusy(true);

    try {
      if (mode === "otp") {
        if (!otpSent) {
          const r = await api.sendLoginOtp(form.identifier);
          setOtpSent(true);
          setDevCode(r.devCode || "");
          return;
        }
        await signInWithOtp({ mobile: form.identifier, code: form.password });
        navigate(goingTo, { replace: true });
        return;
      }
      await signIn(form);
      navigate(goingTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "email_unverified") {
        navigate("/verify", {
          state: { email: err.details?.email, devCode: err.details?.devCode },
        });
        return;
      }
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
        <h1 className="mb-3 text-[2rem] sm:text-[2.5rem]">Welcome back</h1>
        <p className="mb-9 text-muted">Log in to {BRAND}.</p>

        {!problem && ended && <Alert tone="info">{ENDED[ended] || ENDED.signed_out}</Alert>}
        <Alert>{problem}</Alert>

        <div className="mb-6 flex gap-2">
          {[["password", "Password"], ["otp", "OTP to my mobile"]].map(([id, label]) => (
            <Button key={id} type="button" size="sm" variant={mode === id ? "primary" : "outline"}
              onClick={() => { setMode(id); setOtpSent(false); setDevCode(""); setProblem(""); setForm((f) => ({ ...f, password: "" })); }}>
              {label}
            </Button>
          ))}
        </div>

        <form onSubmit={submit} noValidate>
          <Field
            label={mode === "otp" ? "Mobile number" : "Email or mobile"}
            id="identifier"
            type={mode === "otp" ? "tel" : "text"}
            value={form.identifier}
            onChange={set("identifier")}
            error={errors.identifier}
            autoComplete={mode === "otp" ? "tel" : "username"}
            autoFocus
            required
          />

          {mode === "password" && (
            <PasswordField
              label="Password"
              id="password"
              value={form.password}
              onChange={set("password")}
              error={errors.password}
              autoComplete="current-password"
              required
            />
          )}

          {mode === "otp" && otpSent && (
            <>
              {devCode && <Alert tone="info">Development mode — your code is <strong>{devCode}</strong>.</Alert>}
              <Field
                label="Code sent by SMS"
                id="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={form.password}
                onChange={set("password")}
                required
              />
            </>
          )}

          <div className="mb-7 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input type="checkbox" className="h-4 w-4 accent-rose" defaultChecked />
              Keep me logged in
            </label>

            <Link to="/forgot-password" className="text-sm font-semibold text-rose">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" size="lg" block loading={busy}>
            {mode === "otp" && !otpSent ? "Send code" : busy ? "Logging in" : "Log in"}
          </Button>
        </form>

        <GoogleButton goingTo={goingTo} />

        <p className="mt-7 text-center text-sm text-muted">
          New here?{" "}
          <Link to="/signup" className="font-semibold text-rose">
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
