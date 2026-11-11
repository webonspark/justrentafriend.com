import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BRAND } from "../../config/brand";
import { ApiError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Alert, Button, Field } from "../../components/ui";

/**
 * Signing in, with either an email address or a mobile number.
 *
 * An account that has never confirmed its email is sent to the code screen
 * rather than refused, because that is the one thing standing between them
 * and getting in.
 */
export default function Login() {
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Where they were headed before being asked to sign in.
  const goingTo = location.state?.from?.pathname || "/discover";

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setProblem("");
    setBusy(true);

    try {
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
    <div className="k-wrap py-12 lg:py-24">
      <div className="k-narrow">
        <h1 className="mb-3 text-[2rem] sm:text-[2.5rem]">Welcome back</h1>
        <p className="mb-9 text-muted">Log in to {BRAND}.</p>

        <Alert>{problem}</Alert>

        <form onSubmit={submit} noValidate>
          <Field
            label="Email or mobile"
            id="identifier"
            value={form.identifier}
            onChange={set("identifier")}
            error={errors.identifier}
            autoComplete="username"
            autoFocus
            required
          />

          <Field
            label="Password"
            id="password"
            type="password"
            value={form.password}
            onChange={set("password")}
            error={errors.password}
            autoComplete="current-password"
            required
          />

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
            {busy ? "Logging in" : "Log in"}
          </Button>
        </form>

        <p className="mt-7 text-center text-sm text-muted">
          New here?{" "}
          <Link to="/signup" className="font-semibold text-rose">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
