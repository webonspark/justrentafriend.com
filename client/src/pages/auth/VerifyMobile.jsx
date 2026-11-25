import { useEffect, useState } from "react";
import AuthShell from "../../components/layout/AuthShell";
import { useLocation, useNavigate } from "react-router-dom";
import { FiSmartphone } from "react-icons/fi";
import { api, ApiError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Alert, Button, Field } from "../../components/ui";

/**
 * Confirms the mobile number with a code by SMS. Needed once, before
 * search, booking and chat open. In development the code also shows here
 * (and in the server console), because SMS is not sent.
 */
export default function VerifyMobile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const goingTo = useLocation().state?.from?.pathname || "/dashboard";
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [sent, setSent] = useState(false);

  const send = async () => {
    setProblem("");
    try {
      const r = await api.sendMobileOtp();
      if (r.alreadyVerified) return navigate(goingTo, { replace: true });
      setSent(true);
      setDevCode(r.devCode || "");
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Could not send the code.");
    }
    return null;
  };

  useEffect(() => {
    if (user?.mobileVerified) navigate(goingTo, { replace: true });
    else send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setProblem("");
    try {
      const r = await api.verifyMobile(code.trim());
      setUser(r.user);
      navigate(goingTo, { replace: true });
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <form className="k-narrow" onSubmit={submit}>
        <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-ink-high"><FiSmartphone size={22} /></span>
        <h1 className="mb-3 text-[2rem]">Verify your mobile</h1>
        <p className="mb-7 text-muted">We sent a code by SMS to <strong>{user?.mobile}</strong>. It keeps your account and your bookings safe.</p>
        {devCode && <Alert tone="info">Development mode — your code is <strong>{devCode}</strong>.</Alert>}
        <Alert>{problem}</Alert>
        <Field label="Code" id="mobile-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        <Button type="submit" size="lg" block loading={busy} disabled={!code}>Verify</Button>
        <Button type="button" variant="ghost" block className="mt-3" onClick={send}>{sent ? "Send a new code" : "Send the code"}</Button>
      </form>
    </AuthShell>
  );
}
