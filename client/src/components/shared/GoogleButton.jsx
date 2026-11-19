import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Alert } from "../ui";

/**
 * "Continue with Google" — single sign-on for members.
 *
 * Our own button (so it matches the brand), opening Google's sign-in popup
 * through Google Identity Services. The server checks the token with Google
 * and that it was issued to our client ID. Someone new is sent to sign-up
 * with their email and name filled in, because a role, date of birth (18+)
 * and mobile number are still needed.
 *
 * Needs GOOGLE_CLIENT_ID in server/.env. Without it the button still shows
 * and explains that Google sign-in is not switched on yet.
 */
function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve(window.google);
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error("Could not reach Google. Check your connection."));
    document.head.appendChild(s);
  });
}

export default function GoogleButton({ goingTo = "/discover", label = "Continue with Google" }) {
  const [clientId, setClientId] = useState(undefined); // undefined = still loading
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const client = useRef(null);
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.config().then((c) => setClientId(c.googleClientId || null)).catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!clientId) return;
    loadGis()
      .then((google) => {
        client.current = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "openid email profile",
          callback: async (resp) => {
            if (resp.error) {
              setBusy(false);
              setProblem("Google sign-in was cancelled.");
              return;
            }
            try {
              const r = await signInWithGoogle({ accessToken: resp.access_token });
              if (r.needsSignup) navigate("/signup", { state: { email: r.email, fullName: r.name, fromGoogle: true } });
              else navigate(goingTo, { replace: true });
            } catch (e) {
              setProblem(e instanceof ApiError ? e.message : "Google sign-in failed. Try again.");
            } finally {
              setBusy(false);
            }
          },
        });
      })
      .catch((e) => setProblem(e.message));
  }, [clientId, goingTo, navigate, signInWithGoogle]);

  const start = () => {
    setProblem("");
    if (clientId === null) {
      setProblem("Google sign-in isn't switched on yet. Use your email and password for now.");
      return;
    }
    if (!client.current) return;
    setBusy(true);
    client.current.requestAccessToken({ prompt: "select_account" });
  };

  return (
    <div className="mt-6">
      <div className="mb-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-ink-line" /> or <span className="h-px flex-1 bg-ink-line" />
      </div>
      <button
        type="button"
        onClick={start}
        disabled={busy || clientId === undefined}
        className="k-btn k-btn-block k-btn-lg"
        style={{ border: "1px solid var(--pink-line)", background: "var(--ink)", color: "var(--paper)" }}
      >
        <GoogleG /> {busy ? "Waiting for Google…" : label}
      </button>
      <Alert tone="info" className="mt-3">{problem}</Alert>
    </div>
  );
}

/** Google's "G" mark, in its own colours as Google's branding rules require. */
function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
