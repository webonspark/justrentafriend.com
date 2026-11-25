import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Alert, Badge, Button, Card, Field, PasswordField } from "../../components/ui";

/**
 * Settings: notifications, emergency contact, password, blocked people,
 * and deleting the account (required by the app stores and the DPDP Act).
 */
export default function Settings() {
  return (
    <div className="k-wrap py-8 lg:py-12">
      <h1 className="mb-6 text-[2rem]">Settings</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Notifications />
        <SupportAccess />
        <EmergencyContact />
        <Password />
        <Devices />
        <Blocked />
        <DeleteAccount />
      </div>
    </div>
  );
}

function useMessage() {
  const [msg, setMsg] = useState({ tone: "good", text: "" });
  return [msg, (tone, text) => setMsg({ tone, text })];
}

function Notifications() {
  const [p, setP] = useState(null);
  const [msg, say] = useMessage();
  useEffect(() => { api.preferences().then(setP).catch(() => {}); }, []);
  if (!p) return <Card><h2 className="text-lg">Notifications</h2></Card>;
  const toggle = async (k) => {
    const next = await api.savePreferences({ [k]: !p[k] });
    setP(next);
    say("good", "Saved.");
  };
  return (
    <Card>
      <h2 className="mb-3 text-lg">Notifications</h2>
      <p className="mb-3 text-sm text-muted">In-app notifications are always on. You get a reminder 24 hours and 1 hour before every meet.</p>
      <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={p.emailNotifications} onChange={() => toggle("emailNotifications")} /> Email me as well</label>
      <label className="mb-2 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={p.whatsappReminders} onChange={() => toggle("whatsappReminders")} />
        <span>Send my meet reminders on WhatsApp too<span className="block text-xs text-muted">To your verified mobile number. You can switch this off at any time.</span></span>
      </label>
      <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={p.showOnlineStatus} onChange={() => toggle("showOnlineStatus")} /> Show when I was last active</label>
      <Alert tone={msg.tone}>{msg.text}</Alert>
    </Card>
  );
}

/**
 * Lets our support team open a read-only view of this account for 24 hours —
 * useful when someone needs help and it is easier to see what they see.
 */
function SupportAccess() {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, say] = useMessage();
  const until = user?.supportAccessUntil ? new Date(user.supportAccessUntil) : null;
  const on = Boolean(until && until.getTime() > Date.now());

  const toggle = async () => {
    setBusy(true);
    try {
      const r = await api.setSupportAccess(!on);
      setUser((u) => ({ ...u, supportAccessUntil: r.supportAccessUntil }));
      say("good", !on ? "Support access is on for 24 hours." : "Support access is off.");
    } catch (e) {
      say("bad", e instanceof ApiError ? e.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="mb-3 text-lg">Help from our support team</h2>
      <label className="mb-2 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={on} disabled={busy} onChange={toggle} />
        <span>
          <strong>Allow support to view my account</strong>
          <br />
          <span className="text-muted">
            For 24 hours, our team can see your account exactly as you do, to help with a problem. They cannot change anything, send messages,
            book or pay as you, and they never see your password. You are told each time they look, and you can switch this off at any time.
          </span>
        </span>
      </label>
      {on && <p className="mb-0 text-xs text-muted">On until {until.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.</p>}
      <Alert tone={msg.tone}>{msg.text}</Alert>
    </Card>
  );
}

function EmergencyContact() {
  const [f, setF] = useState({ name: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [msg, say] = useMessage();
  useEffect(() => { api.emergencyContact().then((d) => setF({ name: d.name || "", phone: d.phone || "" })).catch(() => {}); }, []);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.saveEmergencyContact(f);
      say("good", "Saved. They will get your live location if you press SOS.");
    } catch (err) {
      say("bad", err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card as="form" onSubmit={submit}>
      <h2 className="mb-3 text-lg">Emergency contact</h2>
      <p className="mb-3 text-sm text-muted">Someone you trust. If you press SOS during a meet, they get an SMS / WhatsApp with your live location.</p>
      <Field label="Name" id="ec-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Field label="Mobile number" id="ec-phone" type="tel" placeholder="+91 98xxxxxxxx" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <Alert tone={msg.tone}>{msg.text}</Alert>
      <Button type="submit" loading={busy}>Save</Button>
    </Card>
  );
}

function Password() {
  const [f, setF] = useState({ currentPassword: "", newPassword: "" });
  const [busy, setBusy] = useState(false);
  const [msg, say] = useMessage();
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.changePassword(f);
      setF({ currentPassword: "", newPassword: "" });
      say("good", "Password changed.");
    } catch (err) {
      say("bad", err instanceof ApiError ? err.message : "Could not change it.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card as="form" onSubmit={submit}>
      <h2 className="mb-3 text-lg">Password</h2>
      <PasswordField label="Current password" id="pw-cur" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} />
      <PasswordField label="New password" id="pw-new" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} hint="At least 8 characters." />
      <Alert tone={msg.tone}>{msg.text}</Alert>
      <Button type="submit" loading={busy}>Change password</Button>
    </Card>
  );
}

/** Where I am signed in, with a way to sign any other device out. */
function Devices() {
  const [rows, setRows] = useState(null);
  const [msg, say] = useMessage();
  const [busy, setBusy] = useState("");
  useEffect(() => { api.sessions().then((d) => setRows(d.sessions)).catch(() => setRows([])); }, []);
  const run = async (key, fn, done) => {
    setBusy(key);
    try {
      const d = await fn();
      setRows(d.sessions);
      say("good", done(d));
    } catch (e) {
      say("bad", e instanceof ApiError ? e.message : "That did not work. Try again.");
    } finally {
      setBusy("");
    }
  };
  const others = (rows || []).filter((r) => !r.current);
  const when = (d) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return (
    <Card>
      <h2 className="mb-1 text-lg">My devices</h2>
      <p className="mb-3 text-sm text-muted">Where your account is signed in. If you see a device you do not know, sign it out and change your password.</p>
      {(rows || []).map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-3 border-b border-ink-line py-2 text-sm">
          <div>
            <div className="font-semibold">
              {r.mobile ? "📱" : "💻"} {r.browser} on {r.os}
              {r.current && <Badge tone="good" className="ml-2">This device</Badge>}
            </div>
            <div className="text-xs text-muted">Signed in {when(r.signedInAt)} · last active {when(r.lastActiveAt)}{r.ip ? ` · IP ${r.ip}` : ""}</div>
          </div>
          {!r.current && (
            <Button size="sm" variant="ghost" loading={busy === r.id} onClick={() => run(r.id, () => api.endSession(r.id), () => "That device is signed out.")}>Sign out</Button>
          )}
        </div>
      ))}
      {rows && others.length > 0 && (
        <Button className="mt-3" variant="outline" loading={busy === "all"} onClick={() => run("all", api.endOtherSessions, (d) => `${d.ended} other device${d.ended === 1 ? "" : "s"} signed out.`)}>
          Sign out all other devices
        </Button>
      )}
      {rows && others.length === 0 && <p className="mt-2 mb-0 text-sm text-muted">You are not signed in anywhere else.</p>}
      <Alert tone={msg.tone}>{msg.text}</Alert>
    </Card>
  );
}

function Blocked() {
  const [rows, setRows] = useState(null);
  const load = () => api.blocks().then((d) => setRows(d.blocks)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  return (
    <Card>
      <h2 className="mb-3 text-lg">Blocked people</h2>
      {rows && rows.length === 0 && <p className="m-0 text-sm text-muted">You have not blocked anyone.</p>}
      {(rows || []).map((b) => (
        <div key={b.userId} className="flex items-center justify-between border-b border-ink-line py-2 text-sm">
          <span>{b.name}</span>
          <Button size="sm" variant="ghost" onClick={async () => { await api.unblock(b.userId); load(); }}>Unblock</Button>
        </div>
      ))}
    </Card>
  );
}

function DeleteAccount() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, say] = useMessage();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    if (!window.confirm("Delete your account? You can undo this by signing in within 30 days.")) return;
    setBusy(true);
    try {
      const r = await api.deleteAccount(password);
      setUser(null);
      navigate("/", { state: { message: r.message } });
    } catch (err) {
      say("bad", err instanceof ApiError ? err.message : "Could not delete the account.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card as="form" onSubmit={submit}>
      <h2 className="mb-3 text-lg">Delete account</h2>
      <p className="mb-3 text-sm text-muted">
        Your profile disappears at once and you are signed out everywhere. Sign in within 30 days to restore it; after that your personal data is erased. Invoices and payment records are kept as the law requires.
      </p>
      <PasswordField label="Confirm with your password" id="del-pw" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Alert tone={msg.tone}>{msg.text}</Alert>
      <Button type="submit" variant="outline" loading={busy} disabled={!password}>Delete my account</Button>
    </Card>
  );
}
