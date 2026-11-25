import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertCircle, FiArrowDownLeft, FiArrowUpRight, FiCalendar, FiCheckCircle, FiChevronRight,
  FiDownload, FiInfo, FiMessageCircle, FiBell, FiStar,
} from "react-icons/fi";
import { api, ApiError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { dateOnly, dateTime, inr, STATUS } from "../../lib/format";
import { Alert, Avatar, Badge, Button, Card, EmptyState, Skeleton } from "../../components/ui";

/**
 * The member's home after signing in: what to do next, the next meet, the
 * money in and out, and every transaction in one list.
 */

const KIND = {
  payment: { label: "Payment", icon: <FiArrowUpRight />, tone: "plain" },
  refund: { label: "Refund", icon: <FiArrowDownLeft />, tone: "good" },
  payout: { label: "Payout", icon: <FiArrowDownLeft />, tone: "good" },
};
const PAYOUT_STATUS = {
  pending: { label: "In 24 h complaint window", tone: "plain" },
  approved: { label: "Ready to release", tone: "accent" },
  on_hold: { label: "On hold", tone: "warn" },
  failed: { label: "Failed", tone: "warn" },
  paid: { label: "Paid", tone: "good" },
};
const FILTERS = [
  ["all", "All"],
  ["payment", "Payments"],
  ["refund", "Refunds"],
  ["payout", "Payouts"],
];
const PAGE = 15;

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    api.dashboard().then(setD).catch((e) => setProblem(e instanceof ApiError ? e.message : "Could not load your dashboard."));
  }, []);

  if (problem) return <div className="k-wrap py-10"><Alert>{problem}</Alert></div>;
  if (!d) {
    return (
      <div className="k-wrap py-10">
        <Skeleton className="mb-6 h-10 w-64" />
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const isCompanion = d.me.role === "companion";
  const first = (d.me.name || user?.fullName || "").split(" ")[0];

  return (
    <div className="k-wrap py-8 lg:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[2rem]">Hi {first}</h1>
          <p className="m-0 text-sm text-muted">
            {isCompanion ? "Companion" : "Member"} since {dateOnly(d.me.memberSince)}
            {d.me.membershipStatus === "active" && d.me.membershipExpiresAt && <> · Membership active until {dateOnly(d.me.membershipExpiresAt)}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button to="/messages" variant="outline" size="sm"><FiMessageCircle className="mr-1 inline" /> Messages{d.unread.messages ? ` (${d.unread.messages})` : ""}</Button>
          <Button to="/notifications" variant="outline" size="sm"><FiBell className="mr-1 inline" /> Alerts{d.unread.notifications ? ` (${d.unread.notifications})` : ""}</Button>
        </div>
      </div>

      {d.me.membershipStatus !== "active" && (
        <Alert tone="info" className="mb-4">
          <FiInfo className="mr-1 inline" /> Your membership is not active, so you cannot book or chat. <Link to="/membership" className="underline">See plans</Link>
        </Alert>
      )}
      {d.me.strikeCount > 0 && (
        <Alert tone="info" className="mb-4">
          <FiAlertCircle className="mr-1 inline" /> You have {d.me.strikeCount} strike{d.me.strikeCount === 1 ? "" : "s"} for late cancellations. At 3 the account is suspended.
        </Alert>
      )}

      <Todo items={d.todo} />

      <MoneyTiles d={d} isCompanion={isCompanion} />

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NextMeets meets={d.nextMeets} requests={d.requests} />
        </div>
        <Card>
          <h2 className="mb-3 text-lg">My bookings</h2>
          <dl className="m-0 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted">Requests</dt><dd className="m-0 text-right font-bold">{d.bookings.requests}</dd>
            <dt className="text-muted">Upcoming</dt><dd className="m-0 text-right font-bold">{d.bookings.upcoming}</dd>
            <dt className="text-muted">Completed</dt><dd className="m-0 text-right font-bold">{d.bookings.completed}</dd>
            <dt className="text-muted">Under review</dt><dd className="m-0 text-right font-bold">{d.bookings.disputed}</dd>
            <dt className="text-muted">Cancelled / declined</dt><dd className="m-0 text-right font-bold">{d.bookings.cancelled}</dd>
          </dl>
          {isCompanion && (
            <p className="mb-0 mt-4 flex items-center gap-1 text-sm">
              <FiStar /> {d.me.ratingCount ? `${d.me.rating.toFixed(1)} from ${d.me.ratingCount} review${d.me.ratingCount === 1 ? "" : "s"}` : "No reviews yet"} · {d.me.completedMeets} meet{d.me.completedMeets === 1 ? "" : "s"}
            </p>
          )}
          <Button to="/bookings" variant="outline" size="sm" className="mt-4">All bookings</Button>
        </Card>
      </div>

      <PeopleMet initial={d.peopleMet} isCompanion={isCompanion} />

      <Transactions rows={d.transactions} isCompanion={isCompanion} />
    </div>
  );
}

/* ------------------------------ people I've met ------------------------------ */

function PeopleMet({ initial, isCompanion }) {
  const [people, setPeople] = useState(initial || []);
  const [all, setAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const showAll = async () => {
    setLoading(true);
    try {
      setPeople((await api.peopleMet()).people);
      setAll(true);
    } catch {
      /* keep the short list */
    } finally {
      setLoading(false);
    }
  };
  const toggleFav = async (p) => {
    await api.favorite(p.id, !p.favorite).catch(() => {});
    setPeople((list) => list.map((x) => (x.id === p.id ? { ...x, favorite: !x.favorite } : x)));
  };
  return (
    <Card className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="m-0 text-lg">People I've met</h2>
        {!all && people.length >= 8 && <Button size="sm" variant="ghost" loading={loading} onClick={showAll}>Show all</Button>}
      </div>
      {people.length === 0 ? (
        <p className="m-0 text-sm text-muted">
          {isCompanion ? "Customers you complete a meet with will show here." : "Companions you complete a meet with will show here, so you can book them again."}
          {!isCompanion && <> <Link to="/discover" className="underline">Find a Companion</Link></>}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {people.map((p) => (
            <div key={p.id} className="flex flex-col rounded-xl border border-ink-line p-3">
              <div className="mb-2 flex items-center gap-3">
                {p.photo ? <img src={p.photo} alt="" className="h-12 w-12 rounded-full object-cover" /> : <Avatar name={p.name} size={48} />}
                <div className="min-w-0">
                  <p className="m-0 truncate font-bold">{p.name}{p.verified && " ✓"}</p>
                  <p className="m-0 truncate text-xs text-muted">{p.area || ""}{p.ratingCount ? ` · ★ ${p.rating.toFixed(1)}` : ""}</p>
                </div>
              </div>
              <p className="mb-3 text-xs text-muted">
                {p.meets} meet{p.meets === 1 ? "" : "s"} · last {dateOnly(p.lastMetAt)}
                <br />
                {isCompanion ? "Earned" : "Spent"} {inr(p.totalPaise)}
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                {isCompanion ? (
                  <Button size="sm" variant="outline" to={`/bookings/${p.lastBookingId}`}>Last booking</Button>
                ) : (
                  <>
                    <Button size="sm" to={`/companions/${p.id}`}>Book again</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleFav(p)} aria-pressed={p.favorite}>{p.favorite ? "♥ Saved" : "♡ Save"}</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ to do ------------------------------ */

function Todo({ items }) {
  if (!items.length) {
    return (
      <Card className="mb-6 flex items-center gap-2 text-sm">
        <FiCheckCircle className="text-green-500" /> You are all set. Nothing needs your attention.
      </Card>
    );
  }
  return (
    <Card className="mb-6">
      <h2 className="mb-2 text-lg">To do</h2>
      <ul className="m-0 list-none p-0">
        {items.map((t) => (
          <li key={t.key} className="border-t border-ink-line first:border-0">
            <Link to={t.to} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:underline">
              <span className="flex items-center gap-2">
                {t.info ? <FiInfo className="text-muted" /> : <FiAlertCircle className="text-amber-500" />}
                {t.text}
              </span>
              <FiChevronRight className="shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------ money ------------------------------ */

function Tile({ label, value, hint }) {
  return (
    <Card>
      <p className="mb-1 text-sm text-muted">{label}</p>
      <p className="m-0 text-2xl font-extrabold">{inr(value)}</p>
      {hint && <p className="m-0 mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

function MoneyTiles({ d, isCompanion }) {
  const s = d.spending;
  if (isCompanion) {
    const e = d.earnings;
    return (
      <>
        <h2 className="mb-3 text-lg">Earnings</h2>
        <div className="mb-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Paid to you" value={e.paidPaise} hint={`${inr(e.thisMonthPaise)} this month`} />
          <Tile label="Upcoming meets" value={e.upcomingPaise} hint="Paid by the customer, held by us" />
          <Tile label="Waiting for release" value={e.waitingPaise} hint="Meet done · 24 h complaint window" />
          <Tile label="On hold" value={e.onHoldPaise} hint="Dispute, or payout details missing" />
        </div>
        <p className="mb-8 text-sm text-muted">
          Payouts go to {d.payoutAccount ? (d.payoutAccount.method === "upi" ? d.payoutAccount.upiId : `A/C ••••${d.payoutAccount.accountLast4}`) : <Link to="/profile" className="underline">— add a UPI ID or bank account</Link>}.
          {" "}You have paid {inr(s.totalPaidPaise)} in membership fees. Wallet {inr(d.me.walletPaise || 0)}. <Link to="/earnings" className="underline">Earnings details</Link> · <Link to="/wallet" className="underline">Refer a friend</Link>
        </p>
      </>
    );
  }
  return (
    <>
      <h2 className="mb-3 text-lg">My money</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Total paid" value={s.totalPaidPaise} hint="Including GST" />
        <Tile label="This month" value={s.thisMonthPaise} />
        <Tile label="Held for my meets" value={s.heldPaise} hint="Released to the companion only after the meet" />
        <Tile label="Refunded to me" value={s.refundedPaise} />
      </div>
      <p className="-mt-5 mb-8 text-sm text-muted">
        Wallet: <strong>{inr(d.me.walletPaise || 0)}</strong> · <Link to="/wallet" className="underline">Wallet &amp; refer a friend</Link> · <Link to="/favorites" className="underline">Favourites — book again</Link>
      </p>
    </>
  );
}

/* ------------------------------ meets ------------------------------ */

function MeetRow({ b }) {
  const other = b.side === "customer" ? b.companion : b.customer;
  const st = STATUS[b.status] || { label: b.status, tone: "plain" };
  return (
    <Link to={`/bookings/${b.id}`} className="flex items-center gap-3 border-t border-ink-line py-3 first:border-0 hover:opacity-90">
      {other?.photo ? <img src={other.photo} alt="" className="h-11 w-11 rounded-full object-cover" /> : <Avatar name={other?.name} size={44} />}
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate font-bold">{other?.name || "—"} <span className="text-xs font-normal text-muted">#{b.id}</span></p>
        <p className="m-0 truncate text-sm text-muted">
          <FiCalendar className="mr-1 inline" />{dateTime(b.startAt)} · {b.hours} h · {b.meetingPlace?.name}
        </p>
      </div>
      <div className="text-right">
        <Badge tone={st.tone}>{st.label}</Badge>
        {b.startCode && <p className="m-0 mt-1 text-xs">Start code <strong className="tracking-widest">{b.startCode}</strong></p>}
      </div>
    </Link>
  );
}

function NextMeets({ meets, requests }) {
  return (
    <Card className="h-full">
      <h2 className="mb-1 text-lg">Next meets</h2>
      {meets.length === 0 ? (
        <p className="text-sm text-muted">No confirmed meets coming up.</p>
      ) : (
        <div>{meets.map((b) => <MeetRow key={b.id} b={b} />)}</div>
      )}
      {requests.length > 0 && (
        <>
          <h3 className="mb-1 mt-5 text-base">Open requests</h3>
          <div>{requests.map((b) => <MeetRow key={b.id} b={b} />)}</div>
        </>
      )}
    </Card>
  );
}

/* ------------------------------ transactions ------------------------------ */

function toCsv(rows) {
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["Date", "Type", "Description", "Direction", "Amount (INR)", "Status", "Invoice / reference"];
  const lines = rows.map((t) => [
    dateTime(t.at), KIND[t.kind]?.label, t.title, t.direction === "in" ? "In" : "Out",
    (t.amountPaise / 100).toFixed(2), t.status, t.invoiceNo || t.reference || "",
  ].map(cell).join(","));
  return [head.join(","), ...lines].join("\n");
}

function Transactions({ rows, isCompanion }) {
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const [problem, setProblem] = useState("");
  const list = useMemo(() => (filter === "all" ? rows : rows.filter((t) => t.kind === filter)), [rows, filter]);
  const filters = FILTERS.filter(([k]) => k !== "payout" || isCompanion);

  const openInvoice = async (id) => {
    const tab = window.open("", "_blank");
    try {
      const html = await api.invoice(id);
      tab.document.open();
      tab.document.write(html);
      tab.document.close();
    } catch {
      tab?.close();
      setProblem("Could not open the invoice.");
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(list)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "my-transactions.csv" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-lg">All transactions</h2>
        <div className="flex flex-wrap items-center gap-2">
          {filters.map(([k, label]) => (
            <Button key={k} size="sm" variant={filter === k ? "primary" : "outline"} onClick={() => { setFilter(k); setShown(PAGE); }}>{label}</Button>
          ))}
          {list.length > 0 && <Button size="sm" variant="ghost" onClick={download}><FiDownload className="mr-1 inline" /> CSV</Button>}
        </div>
      </div>
      <Alert>{problem}</Alert>
      {list.length === 0 ? (
        <EmptyState title="No transactions yet" body="Payments, refunds and payouts will show here." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Description</th><th className="text-right">Amount</th><th>Status</th><th>Invoice / ref.</th></tr>
              </thead>
              <tbody>
                {list.slice(0, shown).map((t) => {
                  const k = KIND[t.kind];
                  const st = t.kind === "payout" ? PAYOUT_STATUS[t.status] || { label: t.status, tone: "plain" } : { label: t.kind === "refund" ? "Refunded" : "Paid", tone: t.kind === "refund" ? "good" : "plain" };
                  return (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap">{dateTime(t.at)}</td>
                      <td><span className="inline-flex items-center gap-1">{k.icon} {k.label}</span></td>
                      <td>
                        {t.bookingId ? <Link to={`/bookings/${t.bookingId}`}>{t.title}</Link> : t.title}
                        {t.kind === "payment" && t.gstPaise > 0 && <span className="block text-xs text-muted">{inr(t.basePaise, { decimals: true })} + GST {inr(t.gstPaise, { decimals: true })}</span>}
                        {t.kind === "payout" && t.bookingAmountPaise != null && <span className="block text-xs text-muted">{inr(t.bookingAmountPaise)} − platform fee {inr(t.feePaise)}</span>}
                        {t.note && <span className="block text-xs text-muted">{t.note}</span>}
                      </td>
                      <td className={`whitespace-nowrap text-right font-bold ${t.direction === "in" ? "text-green-500" : ""}`}>
                        {t.direction === "in" ? "+ " : "− "}{inr(t.amountPaise, { decimals: true })}
                      </td>
                      <td><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td className="text-xs">
                        {t.kind === "payment" && t.invoiceNo ? <Button size="sm" variant="ghost" onClick={() => openInvoice(t.paymentId)}>{t.invoiceNo}</Button> : t.reference || t.invoiceNo || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {list.length > shown && (
            <div className="mt-3 text-center">
              <Button variant="outline" size="sm" onClick={() => setShown((s) => s + PAGE)}>Show more ({list.length - shown} left)</Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
