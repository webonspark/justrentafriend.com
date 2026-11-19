import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setAccessToken, onUnauthorized } from "../services/api";
import { connectSocket, disconnectSocket } from "../lib/socket";

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
        connectSocket();
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
    try {
      await api.logout();
    } finally {
      setAccessToken(null);
      disconnectSocket();
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
    }),
    [user, ready, signIn, signInWithGoogle, signInWithOtp, signOut, confirmEmail, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
