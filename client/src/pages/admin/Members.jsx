import { useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import { api } from "../../services/api";
import { Link, useParams } from "react-router-dom";
import { adminApi } from "../../services/api";
import { dateOnly, dateTime, inr } from "../../lib/format";
import { Alert, Badge, Button, Card, Field } from "../../components/ui";
import { AdminTable, Facts, Loader, PageHead, Pager, Select, StatusBadge, errText, readOnly, useAdmin, useConfirm, useLoad } from "./shared";

/** Every member, searchable, and one member in full. */

export function Members() {
  const [filters, setFilters] = useState({ role: "", status: "", q: "", page: 1 });
  const [q, setQ] = useState("");
  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v, page: 1 }));
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== "")).toString();
  const state = useLoad(() => adminApi.get(`/users?${qs}`), [qs]);

  return (
    <>
      <PageHead title="Members" sub="Customers and Companions." />
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          set("q")(q.trim());
        }}
      >
        <input className="k-input" style={{ maxWidth: 280 }} placeholder="Name, email or mobile" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <Button type="submit" variant="outline">Search</Button>
        <Select label="Role" value={filters.role} onChange={set("role")} options={[["", "All roles"], ["customer", "Customers"], ["companion", "Companions"]]} />
        <Select
          label="Status"
          value={filters.status}
          onChange={set("status")}
          options={[["", "Any status"], ["active", "Active"], ["pending", "Unverified"], ["warned", "Warned"], ["suspended", "Suspended"], ["banned", "Banned"], ["deleted", "Deleted"]]}
        />
      </form>
      <Loader state={state} empty={state.data?.users.length === 0} emptyTitle="No members match">
        {state.data && (
          <>
            <AdminTable>
              <thead>
                <tr><th>Name</th><th>Role</th><th>Status</th><th>Membership</th><th>KYC</th><th>Area</th><th>Joined</th></tr>
              </thead>
              <tbody>
                {state.data.users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link to={`/admin/members/${u.id}`}>{u.name}</Link>
                      <div className="text-xs text-muted">{u.email}</div>
                    </td>
                    <td className="capitalize">{u.role}{u.verified && " ✓"}</td>
                    <td><StatusBadge value={u.status} /></td>
                    <td><StatusBadge value={u.membershipStatus} /></td>
                    <td><StatusBadge value={u.role === "companion" ? u.kycStatus : null} /></td>
                    <td>{u.area || "—"}</td>
                    <td>{dateOnly(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
            <Pager page={filters.page} total={state.data.total} onPage={(p) => setFilters((f) => ({ ...f, page: p }))} />
          </>
        )}
      </Loader>
    </>
  );
}

const ACTIONS = [
  ["active", "Reactivate", "outline"],
  ["warned", "Warn", "outline"],
  ["suspended", "Suspend", "outline"],
  ["banned", "Ban", "primary"],
];

export function MemberDetail() {
  const { id } = useParams();
  const { admin } = useAdmin();
  const state = useLoad(() => adminApi.get(`/users/${id}`), [id]);
  const { ask, modal } = useConfirm();
  const [done, setDone] = useState("");

  const changeStatus = (status, label) =>
    ask({
      title: `${label} ${state.data.member.name}?`,
      body:
        status === "banned"
          ? "A ban closes the account and signs them out everywhere."
          : status === "suspended"
            ? "They are signed out and cannot sign in until reactivated."
            : status === "warned"
              ? "They receive a warning notification with your note."
              : "The account becomes usable again.",
      confirmLabel: label,
      requireNote: status !== "active",
      onConfirm: async ({ note }) => {
        await adminApi.post(`/users/${id}/status`, { status, note });
        setDone(`Status set to ${status}.`);
        state.reload();
      },
    });

  return (
    <>
      {modal}
      <Link to="/admin/members" className="mb-3 inline-block text-sm">← All members</Link>
      <Loader state={state}>
        {state.data && (
          <MemberBody data={state.data} admin={admin} done={done} setDone={setDone} onStatus={changeStatus} ask={ask} reload={state.reload} />
        )}
      </Loader>
    </>
  );
}

function MemberBody({ data, admin, done, setDone, onStatus, ask, reload }) {
  const { member: m, profile: p } = data;
  const [editing, setEditing] = useState(false);
  const canEdit = !readOnly(admin) && ["super_admin", "moderator"].includes(admin?.role);
  const isSuper = admin?.role === "super_admin";

  const removePhoto = (ph) =>
    ask({
      title: "Remove this photo?",
      body: "It is deleted for good and the member is told why. They can upload a new one.",
      confirmLabel: "Remove photo",
      noteLabel: "Reason (shown to the member)",
      requireNote: true,
      onConfirm: async ({ note }) => {
        await adminApi.del(`/photos/${ph.id}`, { reason: note });
        setDone("Photo removed and the member was told.");
        reload();
      },
    });

  const changeContact = (kind) =>
    ask({
      title: `Change ${m.name}'s ${kind}`,
      body: `They are signed out everywhere and must confirm the new ${kind} with a code before using the account. The old ${kind} is told about the change. Only do this when you are sure the request came from them.`,
      confirmLabel: `Change ${kind}`,
      fields: [{ name: "value", label: kind === "email" ? "New email address" : "New mobile number", initial: "" }],
      noteLabel: "Why, and how you confirmed it was them (audit log)",
      requireNote: true,
      onConfirm: async ({ value, note }) => {
        await adminApi.post(`/users/${m.id}/contact`, { kind, value, reason: note });
        setDone(`${kind === "email" ? "Email" : "Mobile"} changed. They must verify it with a code at their next sign-in.`);
        reload();
      },
    });

  const sendReset = () =>
    ask({
      title: "Send a password reset code?",
      body: `A reset code goes to ${m.email}. Staff can never see or set a password.`,
      confirmLabel: "Send code",
      noteLabel: null,
      onConfirm: async () => {
        const r = await adminApi.post(`/users/${m.id}/password-reset`);
        setDone(`Reset code sent to ${r.sentTo}.`);
      },
    });

  return (
    <>
      <PageHead title={m.name} sub={`${m.role} · #${m.id} · joined ${dateOnly(m.createdAt)}`}>
        {!readOnly(admin) &&
          ACTIONS.filter(([s]) => s !== m.status).map(([s, label, variant]) => (
            <Button key={s} size="sm" variant={variant} onClick={() => onStatus(s, label)}>
              {label}
            </Button>
          ))}
      </PageHead>
      <Alert tone="good">{done}</Alert>
      {canEdit && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit profile</Button>
          <Button size="sm" variant="ghost" onClick={sendReset}>Send password reset</Button>
        </div>
      )}

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base">Account</h2>
          <Facts
            rows={[
              ["Status", <StatusBadge key="s" value={m.status} />],
              ["Email", <span key="e">{m.email} <Badge tone={m.emailVerified ? "good" : "warn"}>{m.emailVerified ? "verified" : "unverified"}</Badge>{isSuper && <button type="button" className="ml-2 text-xs underline" onClick={() => changeContact("email")}>change</button>}</span>],
              ["Mobile", <span key="mo">{m.mobile} <Badge tone={m.mobileVerified ? "good" : "warn"}>{m.mobileVerified ? "verified" : "unverified"}</Badge>{isSuper && <button type="button" className="ml-2 text-xs underline" onClick={() => changeContact("mobile")}>change</button>}</span>],
              ["Age", m.age],
              ["Membership", <span key="m"><StatusBadge value={m.membershipStatus} /> {m.membershipExpiresAt && `until ${dateOnly(m.membershipExpiresAt)}`}</span>],
              ["Last sign-in", dateTime(m.lastLoginAt)],
              ["City / area", `${m.city || "—"} / ${m.area || "—"}`],
              ["Reports filed", data.reportsFiled],
            ]}
          />
        </Card>
        {p && (
          <Card>
            <h2 className="mb-3 text-base">Profile</h2>
            <Facts
              rows={[
                ["Gender", p.gender],
                ["Languages", p.languages],
                ["Rating", `${p.rating.toFixed(1)} (${p.ratingCount})`],
                ["Completed meets", p.completedMeets],
                m.role === "companion" && ["Approval", <StatusBadge key="a" value={m.approvalStatus} />],
                m.role === "companion" && ["KYC", <StatusBadge key="k" value={m.kycStatus} />],
                m.role === "companion" && ["Selfie", <span key="sf"><StatusBadge value={p.selfieStatus} /> {p.selfieMatchScore !== null && `${p.selfieMatchScore}% match`}</span>],
                ["Emergency contact", p.emergencyContactName],
                data.payoutAccount && ["Payout to", data.payoutAccount.method === "upi" ? data.payoutAccount.upiId : `A/C ••••${data.payoutAccount.accountLast4} · ${data.payoutAccount.ifsc}`],
              ]}
            />
            {p.bio && <p className="mb-0 mt-3 text-sm text-muted">{p.bio}</p>}
          </Card>
        )}
      </div>

      {data.photos.length > 0 && (
        <>
          <h2 className="mb-3 text-base">Photos</h2>
          <div className="mb-6 flex flex-wrap gap-3">
            {data.photos.map((ph) => (
              <figure key={ph.id} className="mb-0 text-center">
                <a href={ph.url} target="_blank" rel="noreferrer"><img src={ph.thumbUrl} alt="" className="h-28 w-28 rounded-xl object-cover" /></a>
                <figcaption className="mt-1"><StatusBadge value={ph.status} />{ph.isPrimary && " ★"}</figcaption>
                {canEdit && <button type="button" className="mt-1 text-xs text-muted underline" onClick={() => removePhoto(ph)}>Remove</button>}
              </figure>
            ))}
          </div>
        </>
      )}

      <InternalCard member={m} canEdit={canEdit} onSaved={(msg) => { setDone(msg); reload(); }} />

      <p className="mb-6 text-xs text-muted">
        Not editable by staff, by design: ID documents (approve or reject only), bank / UPI details (only the member changes them), passwords (send a reset code), review text (hide only), and payment amounts (use refunds or dispute decisions).
      </p>

      {editing && (
        <EditProfile
          member={m}
          initial={data.editable}
          onClose={() => setEditing(false)}
          onSaved={(changed) => {
            setEditing(false);
            setDone(changed.length ? `Saved: ${changed.join(", ")}. The member was notified.` : "Nothing changed.");
            reload();
          }}
        />
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Bookings" rows={data.bookings} head={["#", "Side", "Status", "When", "Amount"]} row={(b) => [<Link key="l" to={`/admin/bookings/${b.id}`}>{b.id}</Link>, b.side, <StatusBadge key="s" value={b.status} />, dateTime(b.startAt), inr(b.amountPaise)]} />
        <Section title="Reports against" rows={data.reportsAgainst} head={["#", "Reason", "Status", "Filed"]} row={(r) => [r.id, r.reason.replace(/_/g, " "), <StatusBadge key="s" value={r.status} />, dateOnly(r.createdAt)]} />
        <Section title="Payments" rows={data.payments} head={["#", "For", "Status", "Total", "Paid"]} row={(p2) => [p2.id, p2.purpose, <StatusBadge key="s" value={p2.status} />, inr(p2.totalPaise), dateOnly(p2.paidAt)]} />
        <Section title="Memberships" rows={data.subscriptions} head={["#", "Status", "From", "To", "Total"]} row={(s) => [s.id, <StatusBadge key="s" value={s.status} />, dateOnly(s.startsAt), dateOnly(s.endsAt), inr(s.totalPaise)]} />
        <Section title="KYC documents" rows={data.kyc} head={["Type", "Number", "Status", "Submitted"]} row={(k) => [k.docType, k.numberMasked, <StatusBadge key="s" value={k.status} />, dateOnly(k.createdAt)]} />
      </div>
    </>
  );
}

/** Strikes and private notes. Staff only; the member never sees these. */
function InternalCard({ member: m, canEdit, onSaved }) {
  const [strikes, setStrikes] = useState(String(m.strikeCount ?? 0));
  const [notes, setNotes] = useState(m.adminNotes || "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    setStrikes(String(m.strikeCount ?? 0));
    setNotes(m.adminNotes || "");
  }, [m.strikeCount, m.adminNotes]);

  const save = async () => {
    setBusy(true);
    setProblem("");
    try {
      await adminApi.put(`/users/${m.id}/internal`, { strikeCount: Number(strikes), adminNotes: notes });
      onSaved("Strikes and notes saved.");
    } catch (e) {
      setProblem(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="m-0 text-base">Internal (staff only)</h2>
        {m.role === "companion" && <Badge tone={m.strikeCount >= 3 ? "accent" : m.strikeCount ? "warn" : "plain"}>{m.strikeCount} / 3 strikes</Badge>}
      </div>
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <Field id="strikes" label="Strikes" type="number" min="0" max="20" value={strikes} onChange={(e) => setStrikes(e.target.value)} disabled={!canEdit} hint="A Companion gets one for cancelling an accepted booking; 3 = suspended." />
        <Field id="notes" label="Notes" as="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} />
      </div>
      <Alert>{problem}</Alert>
      {canEdit && <Button size="sm" loading={busy} onClick={save}>Save</Button>}
    </Card>
  );
}

/** The fields staff may correct: name, bio, place, languages, services, rate. */
function EditProfile({ member: m, initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    fullName: initial.fullName || "",
    bio: initial.bio || "",
    city: initial.city || "",
    area: initial.area || "",
    languages: initial.languages || "",
    serviceIds: initial.serviceIds || [],
    rate: initial.pricePerHourPaise ? String(initial.pricePerHourPaise / 100) : "",
  });
  const [note, setNote] = useState("");
  const [services, setServices] = useState([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const isCompanion = m.role === "companion";

  useEffect(() => {
    if (isCompanion) api.catalog().then((c) => setServices(c.services || [])).catch(() => {});
  }, [isCompanion]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (id) => setForm((f) => ({ ...f, serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((x) => x !== id) : [...f.serviceIds, id] }));

  const save = async () => {
    setBusy(true);
    setProblem("");
    const body = { note: note.trim() || undefined };
    if (form.fullName !== initial.fullName) body.fullName = form.fullName;
    for (const k of ["bio", "city", "area", "languages"]) if (form[k] !== (initial[k] || "")) body[k] = form[k];
    if (isCompanion) {
      const was = [...(initial.serviceIds || [])].sort().join(",");
      if ([...form.serviceIds].sort().join(",") !== was) body.serviceIds = form.serviceIds;
      const paise = Math.round(Number(form.rate) * 100);
      if (form.rate !== "" && paise !== initial.pricePerHourPaise) body.pricePerHourPaise = paise;
    }
    try {
      const r = await adminApi.put(`/users/${m.id}/profile`, body);
      onSaved(r.changed || []);
    } catch (e) {
      setProblem(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show onHide={busy ? undefined : onClose} size="lg" centered scrollable>
      <Modal.Header closeButton={!busy}><Modal.Title>Edit {m.name}</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className="text-sm text-muted">Fix mistakes or remove inappropriate text. The member is told what changed.</p>
        <Field id="ed-name" label="Full name" value={form.fullName} onChange={set("fullName")} />
        <Field id="ed-bio" label="Bio" as="textarea" rows={4} value={form.bio} onChange={set("bio")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ed-city" label="City" value={form.city} onChange={set("city")} />
          <Field id="ed-area" label="Area" value={form.area} onChange={set("area")} />
        </div>
        <Field id="ed-lang" label="Languages" hint="Comma separated, e.g. English, Hindi, Kannada" value={form.languages} onChange={set("languages")} />
        {isCompanion && (
          <>
            <p className="mb-2 mt-2 text-sm font-semibold">Services</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {services.map((sv) => (
                <label key={sv.id} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={form.serviceIds.includes(sv.id)} onChange={() => toggle(sv.id)} /> {sv.name}
                </label>
              ))}
            </div>
            <Field id="ed-rate" label="Hourly rate (₹)" type="number" min="0" value={form.rate} onChange={set("rate")} hint="Must be within the min / max set in Settings." />
          </>
        )}
        <Field id="ed-note" label="Message to the member (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Alert>{problem}</Alert>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button loading={busy} onClick={save}>Save changes</Button>
      </Modal.Footer>
    </Modal>
  );
}

function Section({ title, rows, head, row }) {
  return (
    <div>
      <h2 className="mb-2 text-base">{title}</h2>
      <AdminTable>
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={head.length} className="text-muted">None.</td></tr>}
          {rows.map((r, i) => (
            <tr key={i}>{row(r).map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </AdminTable>
    </div>
  );
}
