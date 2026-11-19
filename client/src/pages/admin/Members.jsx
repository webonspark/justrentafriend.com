import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminApi } from "../../services/api";
import { dateOnly, dateTime, inr } from "../../lib/format";
import { Alert, Button, Card } from "../../components/ui";
import { AdminTable, Facts, Loader, PageHead, Pager, Select, StatusBadge, readOnly, useAdmin, useConfirm, useLoad } from "./shared";

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
          <MemberBody data={state.data} admin={admin} done={done} onStatus={changeStatus} />
        )}
      </Loader>
    </>
  );
}

function MemberBody({ data, admin, done, onStatus }) {
  const { member: m, profile: p } = data;
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

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base">Account</h2>
          <Facts
            rows={[
              ["Status", <StatusBadge key="s" value={m.status} />],
              ["Email", m.email],
              ["Mobile", m.mobile],
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
                <img src={ph.thumbUrl} alt="" className="h-28 w-28 rounded-xl object-cover" />
                <figcaption className="mt-1"><StatusBadge value={ph.status} /></figcaption>
              </figure>
            ))}
          </div>
        </>
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
