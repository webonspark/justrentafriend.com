import { useState } from "react";
import AuthShell from "../../components/layout/AuthShell";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { Alert, Button, Field } from "../../components/ui";

/**
 * Starting a password reset.
 *
 * The answer is the same whether or not the address is registered. Saying
 * "no such account" would turn this form into a way of finding out who is
 * a member, which on a platform like this one matters a great deal.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setProblem("");

    try {
      const result = await api.forgotPassword(email);
      navigate("/reset-password", { state: { email, devCode: result.devCode } });
    } catch (err) {
      setProblem(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="k-narrow">
        <h1 className="mb-3 text-[2rem] sm:text-[2.5rem]">Reset your password</h1>
        <p className="mb-9 text-muted">
          Give us the email on your account and we will send a code to set a new password.
        </p>

        <Alert>{problem}</Alert>

        <form onSubmit={submit} noValidate>
          <Field
            label="Email"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            required
          />

          <Button type="submit" size="lg" block loading={busy}>
            {busy ? "Sending" : "Send the code"}
          </Button>
        </form>

        <p className="mt-7 text-center text-sm text-muted">
          Remembered it?{" "}
          <Link to="/login" className="font-semibold text-rose">
            Log in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
