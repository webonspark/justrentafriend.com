import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Alert, Button } from "../../components/ui";

/**
 * The six-digit code from the sign-up email.
 *
 * Six separate boxes rather than one field, because that is what people
 * expect from a code and it makes a wrong digit obvious. Pasting the whole
 * code into any box fills them all, which is what most people actually do.
 */

const LENGTH = 6;
const RESEND_AFTER = 30; // seconds

export default function VerifyOtp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { confirmEmail } = useAuth();

  const email = location.state?.email;
  const devCode = location.state?.devCode;

  const [digits, setDigits] = useState(Array(LENGTH).fill(""));
  const [problem, setProblem] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_AFTER);

  const boxes = useRef([]);

  useEffect(() => {
    if (!wait) return undefined;
    const t = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // Nothing to verify without an address — send them back to sign up.
  if (!email) return <Navigate to="/signup" replace />;

  const code = digits.join("");

  const put = (i, value) => {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((d) => d.map((x, n) => (n === i ? "" : x)));
      return;
    }

    // A pasted code fills every box from here on.
    setDigits((d) => {
      const next = [...d];
      clean.split("").forEach((ch, n) => {
        if (i + n < LENGTH) next[i + n] = ch;
      });
      return next;
    });

    const landed = Math.min(i + clean.length, LENGTH - 1);
    boxes.current[landed]?.focus();
  };

  const onKeyDown = (i) => (e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < LENGTH - 1) boxes.current[i + 1]?.focus();
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (code.length !== LENGTH) {
      setProblem("Enter all six digits.");
      return;
    }

    setBusy(true);
    setProblem("");
    try {
      await confirmEmail({ email, code });
      navigate("/membership", { replace: true });
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setDigits(Array(LENGTH).fill(""));
      boxes.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setProblem("");
    try {
      const result = await api.resendOtp(email);
      setNote(
        result.devCode
          ? `A new code is on its way. In development it is ${result.devCode}.`
          : "A new code is on its way."
      );
      setWait(RESEND_AFTER);
    } catch (err) {
      setProblem(err.message);
    }
  };

  return (
    <div className="k-wrap py-12 lg:py-24">
      <div className="k-narrow text-center">
        <h1 className="mb-3 text-[2rem] sm:text-[2.5rem]">Check your email</h1>
        <p className="mb-9 text-muted">
          We sent a six-digit code to <span className="font-semibold text-paper">{email}</span>.
        </p>

        <Alert>{problem}</Alert>
        <Alert tone="good">{note}</Alert>

        {devCode && (
          <Alert tone="info">
            Development only: your code is <strong className="text-rose">{devCode}</strong>.
          </Alert>
        )}

        <form onSubmit={submit}>
          <div className="mb-7 flex justify-center gap-2" role="group" aria-label="Six-digit code">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                value={digit}
                onChange={(e) => put(i, e.target.value)}
                onKeyDown={onKeyDown(i)}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={LENGTH}
                aria-label={`Digit ${i + 1}`}
                autoFocus={i === 0}
                className="k-input h-14 w-12 p-0 text-center text-xl font-bold"
              />
            ))}
          </div>

          <Button type="submit" size="lg" block loading={busy} disabled={code.length !== LENGTH}>
            {busy ? "Checking" : "Confirm my email"}
          </Button>
        </form>

        <p className="mt-7 text-sm text-muted">
          {wait > 0 ? (
            <>Did not arrive? You can ask again in {wait}s.</>
          ) : (
            <button type="button" onClick={resend} className="font-semibold text-rose">
              Send me another code
            </button>
          )}
        </p>

        <p className="mt-3 text-sm text-muted">
          Wrong address?{" "}
          <Link to="/signup" className="font-semibold text-rose">
            Start again
          </Link>
        </p>
      </div>
    </div>
  );
}
