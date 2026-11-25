import { useCallback, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  FiActivity, FiAlertTriangle, FiBookOpen, FiCheckSquare, FiCreditCard, FiDollarSign, FiFlag, FiGrid,
  FiImage, FiLayers, FiList, FiLogOut, FiMenu, FiSettings, FiShield, FiStar, FiTag, FiUsers, FiX, FiUserCheck, FiGift, FiMapPin,
} from "react-icons/fi";
import { adminApi } from "../../services/api";
import { BRAND } from "../../config/brand";
import { Alert, Button, Field, Skeleton, PasswordField } from "../../components/ui";
import { AdminContext, can, errText, useAdmin } from "./shared";
import Dashboard from "./Dashboard";
import { MemberDetail, Members } from "./Members";
import { Approvals, Kyc, Photos, Reviews } from "./Moderation";
import { BookingAdminDetail, BookingsAdmin } from "./BookingsAdmin";
import { Payments, Payouts } from "./Money";
import { Reports, Sos } from "./SafetyAdmin";
import { Audit, Categories, Plans, SettingsAdmin, Staff } from "./Config";
import { Coupons, Places } from "./Growth";

/**
 * The admin area: its own sign-in, its own session (separate cookie from
 * members), and a sidebar of the sections this staff role may open. The
 * server enforces every role check again — hiding a link is a courtesy.
 */

const NAV = [
  ["dashboard", "", "Dashboard", FiGrid],
  ["members", "members", "Members", FiUsers],
  ["approvals", "approvals", "Approvals", FiUserCheck],
  ["kyc", "kyc", "KYC & selfies", FiShield],
  ["photos", "photos", "Photos", FiImage],
  ["bookings", "bookings", "Bookings", FiBookOpen],
  ["payments", "payments", "Payments", FiCreditCard],
  ["payouts", "payouts", "Payouts", FiDollarSign],
  ["reports", "reports", "Reports & chat", FiFlag],
  ["sos", "sos", "SOS alerts", FiAlertTriangle],
  ["reviews", "reviews", "Reviews", FiStar],
  ["coupons", "coupons", "Coupons", FiGift],
  ["places", "places", "Public places", FiMapPin],
  ["settings", "settings", "Settings", FiSettings],
  ["categories", "categories", "Categories", FiTag],
  ["plans", "plans", "Plans", FiLayers],
  ["audit", "audit", "Audit log", FiList],
  ["staff", "staff", "Staff", FiCheckSquare],
];

export default function AdminApp() {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    adminApi
      .restore()
      .then(setAdmin)
      .catch(() => setAdmin(null))
      .finally(() => setReady(true));
  }, []);

  const signOut = useCallback(async () => {
    await adminApi.logout();
    setAdmin(null);
  }, []);

  if (!ready) {
    return (
      <div className="k-wrap py-24">
        <Skeleton className="mx-auto h-8 w-64" />
      </div>
    );
  }

  return (
    <AdminContext.Provider value={{ admin, setAdmin, signOut }}>
      <Routes>
        <Route path="login" element={admin ? <Navigate to="/admin" replace /> : <AdminLogin onIn={setAdmin} />} />
        <Route path="*" element={admin ? <Shell /> : <Navigate to="/admin/login" replace />} />
      </Routes>
    </AdminContext.Provider>
  );
}

function AdminLogin({ onIn }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setProblem("");
    try {
      onIn(await adminApi.login(form));
      navigate("/admin", { replace: true });
    } catch (err) {
      setProblem(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="k-wrap grid min-h-screen place-items-center py-12">
      <div className="k-card k-card-pad w-full max-w-sm">
        <p className="mb-1 text-sm font-bold text-rose">{BRAND}</p>
        <h1 className="mb-6 text-2xl">Staff sign-in</h1>
        <Alert>{problem}</Alert>
        <form onSubmit={submit} noValidate>
          <Field id="admin-email" label="Email" type="email" autoComplete="username" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} autoFocus />
          <PasswordField id="admin-password" label="Password" autoComplete="current-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          <Button type="submit" block loading={busy}>
            Sign in
          </Button>
        </form>
        <p className="mb-0 mt-5 text-xs text-muted">Every action in the admin area is written to the audit log.</p>
      </div>
    </div>
  );
}

function Shell() {
  const { admin, signOut } = useAdmin();
  const [open, setOpen] = useState(false);
  const [sosCount, setSosCount] = useState(0);
  const location = useLocation();

  // The SOS badge: checked on every page change and every 30 seconds.
  useEffect(() => {
    if (!can(admin, "dashboard")) return undefined;
    const check = () => adminApi.get("/dashboard").then((d) => setSosCount(d.counts.activeSos)).catch(() => {});
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [admin, location.pathname]);

  useEffect(() => setOpen(false), [location.pathname]);

  const links = NAV.filter(([section]) => can(admin, section));

  const nav = (
    <nav className="flex flex-col gap-1">
      {links.map(([section, to, label, Icon]) => (
        <NavLink
          key={section}
          to={to === "" ? "/admin" : `/admin/${to}`}
          end={to === ""}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2 text-sm no-underline ${isActive ? "bg-rose-soft text-rose" : "text-paper hover:bg-ink-high"}`
          }
        >
          <Icon size={16} />
          <span className="flex-1">{label}</span>
          {section === "sos" && sosCount > 0 && <span className="k-badge k-badge-accent">{sosCount}</span>}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-ink">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-line bg-ink-raised px-4 py-3 lg:hidden">
        <span className="font-bold">{BRAND} · Admin</span>
        <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <FiX /> : <FiMenu />}
          {sosCount > 0 && <span className="k-badge k-badge-accent">SOS {sosCount}</span>}
        </button>
      </header>
      {open && <div className="border-b border-ink-line bg-ink-raised p-3 lg:hidden">{nav}</div>}

      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-ink-line bg-ink-raised p-4 lg:flex">
          <p className="mb-1 font-bold">{BRAND}</p>
          <p className="mb-5 flex items-center gap-2 text-xs text-muted">
            <FiActivity /> Admin · {admin.role.replace("_", " ")}
          </p>
          {nav}
          <div className="mt-auto border-t border-ink-line pt-4 text-sm">
            <p className="mb-2 truncate text-muted">{admin.email}</p>
            <Button size="sm" variant="ghost" onClick={signOut}>
              <FiLogOut /> Sign out
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Routes>
            {guard("dashboard", "", <Dashboard />)}
            {guard("members", "members", <Members />)}
            {guard("members", "members/:id", <MemberDetail />)}
            {guard("approvals", "approvals", <Approvals />)}
            {guard("kyc", "kyc", <Kyc />)}
            {guard("photos", "photos", <Photos />)}
            {guard("bookings", "bookings", <BookingsAdmin />)}
            {guard("bookings", "bookings/:id", <BookingAdminDetail />)}
            {guard("payments", "payments", <Payments />)}
            {guard("payouts", "payouts", <Payouts />)}
            {guard("reports", "reports", <Reports />)}
            {guard("sos", "sos", <Sos />)}
            {guard("reviews", "reviews", <Reviews />)}
            {guard("coupons", "coupons", <Coupons />)}
            {guard("places", "places", <Places />)}
            {guard("settings", "settings", <SettingsAdmin />)}
            {guard("categories", "categories", <Categories />)}
            {guard("plans", "plans", <Plans />)}
            {guard("audit", "audit", <Audit />)}
            {guard("staff", "staff", <Staff />)}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
          <div className="mt-10 lg:hidden">
            <Button size="sm" variant="ghost" onClick={signOut}>
              <FiLogOut /> Sign out
            </Button>
          </div>
        </main>
      </div>
    </div>
  );

  function guard(section, path, element) {
    return <Route key={path || "index"} path={path || undefined} index={path === "" ? true : undefined} element={can(admin, section) ? element : <NoAccess />} />;
  }
}

function NoAccess() {
  return <Alert tone="info">Your staff role does not cover this section.</Alert>;
}

