import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setAccessToken, onUnauthorized, setReadOnlyView } from "../services/api";
import { connectSocket, disconnectSocket, onSessionEnded } from "../lib/socket";

/**
 * Who is signed in, for the whole app.
 *
 * `ready` is false until the first attempt to restore a session has
 * finished. Routes wait for it, so a logged-in person reloading a page is
 * never bounced to the sign-in screen for a moment first.
 */

const AuthContext = createContext(null);

/* Staff "view as member" sessions live in this tab only (sessionStorage).
   The admin panel opens /support-view#t=…&exp=…&by=… in a new tab; the hash
   never reaches a server and is wiped from the address bar straight away. */
const VIEW_KEY = "supportView";

function takeSupportView() {
  try {
    if (window.location.pathname === "/support-view" && window.location.hash.length > 1) {
      const h = new URLSearchParams(window.location.hash.slice(1));
      const view = { token: h.get("t"), expiresAt: h.get("exp"), viewer: h.get("by") || "Support" };
      window.history.replaceState(null, "", "/");
      if (view.token) sessionStorage.setItem(VIEW_KEY, JSON.stringify(view));
    }
    const saved = JSON.parse(sessionStorage.getItem(VIEW_KEY) || "null");
    if (saved && new Date(saved.expiresAt).getTime() > Date.now()) return saved;
    sessionStorage.removeItem(VIEW_KEY);
  } catch {
    /* storage blocked: no support view */
  }
  return null;
}

export function endSupportView() {
  try {
    sessionStorage.removeItem(VIEW_KEY);
  } catch {
    /* ignore */
  }
  setReadOnlyView(false);
  setAccessToken(null);
  window.close();
  // If the browser refuses to close a tab it did not open, go home signed out.
  window.location.replace("/");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [supportView, setSupportView] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const view = takeSupportView();
      if (view) {
        // Read-only staff view: the given token only, no cookie, no live socket.
        setReadOnlyView(true);
        setAccessToken(view.token);
        try {
          const { user: viewed } = await api.me();
          if (alive) {
            setSupportView(view);
            setUser(viewed);
          }
        } catch {
          endSupportView();
        } finally {
          if (alive) setReady(true);
        }
        return;
      }
      try {
        const restored = await api.restore();
        connectSocket();
        if (alive) setUser(restored);
      } catch {
        // No cookie, or it has expired. A visitor, then.
        if (alive) setUser(null);
      } finally {
        if (alive) setReady(true);
      }
    })();

    // Staff signed this member out (or suspended them): leave at once.
    onSessionEnded((reason) => {
      disconnectSocket();
      setAccessToken(null);
      if (alive) setUser(null);
      window.location.assign(`/login?ended=${encodeURIComponent(reason || "signed_out")}`);
    });

    // If a refresh ever fails mid-session, drop straight to signed out.
    onUnauthorized(() => {
      disconnectSocket();
      if (alive) setUser(null);
    });

    return () => { alive = false; };
  }, []);

  const signIn = useCallback(async (credentials) => {
    const { user: signedIn, accessToken } = await api.login(credentials);
    setAccessToken(accessToken);
    connectSocket();
    setUser(signedIn);
    return signedIn;
  }, []);

  /** Login with a code sent to the mobile. */
  const signInWithOtp = useCallback(async (body) => {
    const { user: signedIn, accessToken } = await api.loginWithOtp(body);
    setAccessToken(accessToken);
    connectSocket();
    setUser(signedIn);
    return signedIn;
  }, []);

  /** Google sign-in. A new person gets { needsSignup, email, name } back. */
  const signInWithGoogle = useCallback(async (token) => {
    const result = await api.googleLogin(token);
    if (result.needsSignup) return result;
    setAccessToken(result.accessToken);
    connectSocket();
    setUser(result.user);
    return result.user;
  }, []);

  /** Confirming an email signs you in at the same time. */
  const confirmEmail = useCallback(async (payload) => {
    const { user: confirmed, accessToken } = await api.verifyOtp(payload);
    setAccessToken(accessToken);
    connectSocket();
    setUser(confirmed);
    return confirmed;
  }, []);

  const signOut = useCallback(async () => {
    if (supportView) {
      endSupportView();
      return;
    }
    try {
      await api.logout();
    } finally {
      setAccessToken(null);
      disconnectSocket();
      setUser(null);
    }
  }, [supportView]);

  const refreshUser = useCallback(async () => {
    const { user: latest } = await api.me();
    setUser(latest);
    return latest;
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      signedIn: Boolean(user),
      isCompanion: user?.role === "companion",
      isCustomer: user?.role === "customer",
      /* Membership is compulsory, so the whole app asks this one question
         before showing anything that costs money. */
      memberActive: Boolean(user?.memberActive),
      signIn,
      signInWithGoogle,
      signInWithOtp,
      signOut,
      confirmEmail,
      refreshUser,
      setUser,
      supportView,
    }),
    [user, ready, signIn, signInWithGoogle, signInWithOtp, signOut, confirmEmail, refreshUser, supportView]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
