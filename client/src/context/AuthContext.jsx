import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setAccessToken, onUnauthorized } from "../services/api";

/**
 * Who is signed in, for the whole app.
 *
 * `ready` is false until the first attempt to restore a session has
 * finished. Routes wait for it, so a logged-in person reloading a page is
 * never bounced to the sign-in screen for a moment first.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const restored = await api.restore();
        if (alive) setUser(restored);
      } catch {
        // No cookie, or it has expired. A visitor, then.
        if (alive) setUser(null);
      } finally {
        if (alive) setReady(true);
      }
    })();

    // If a refresh ever fails mid-session, drop straight to signed out.
    onUnauthorized(() => {
      if (alive) setUser(null);
    });

    return () => { alive = false; };
  }, []);

  const signIn = useCallback(async (credentials) => {
    const { user: signedIn, accessToken } = await api.login(credentials);
    setAccessToken(accessToken);
    setUser(signedIn);
    return signedIn;
  }, []);

  /** Confirming an email signs you in at the same time. */
  const confirmEmail = useCallback(async (payload) => {
    const { user: confirmed, accessToken } = await api.verifyOtp(payload);
    setAccessToken(accessToken);
    setUser(confirmed);
    return confirmed;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

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
      isCustomer: user?.role === "customer",
      /* Membership is compulsory, so the whole app asks this one question
         before showing anything that costs money. */
      memberActive: Boolean(user?.memberActive),
      signIn,
      signOut,
      confirmEmail,
      refreshUser,
      setUser,
    }),
    [user, ready, signIn, signOut, confirmEmail, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
