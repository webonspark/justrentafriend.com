import { useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../services/api";
import { dateOnly, dateTime, inr } from "../../lib/format";
import { Alert, Button } from "../../components/ui";
import { AdminTable, Loader, PageHead, Pager, Select, StatusBadge, errText, openHtml, useConfirm, useLoad } from "./shared";

/** Money in (payments, refunds, invoices) and money out (payouts). */

export function Payments() {
  const [filters, setFilters] = useState({ status: "", purpose: "", page: 1 });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== "")).toString();
  const state = useLoad(() => adminApi.get(`/payments?${qs}`), [qs]);
  const { ask, modal } = useConfirm();
  const [problem, setProblem] = useState("");
  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v, page: 1 }));

  const refund = (p) => {
    const left = p.totalPaise - (p.refundedPaise || 0);
    ask({
      title: `Refund payment #${p.id}`,
      body: `Up to ${inr(left)} can still be refunded. The money goes back through ${p.gateway}.`,
      confirmLabel: "Refund",
      requireNote: true,
      noteLabel: "Reason (shown to the member)",
      fields: [{ name: "rupees", label: "Amount (₹)", type: "number", initial: String(left / 100) }],
      onConfirm: async ({ note, rupees }) => {
        const amountPaise = Math.round(Number(rupees) * 100);
        if (!amountPaise || amountPaise > left) throw new Error("Enter an amount up to what is left.");
        await adminApi.post(`/payments/${p.id}/refund`, { amountPaise, reason: note });
        state.reload();
      },
    });
  };

  const invoice = async (id) => {
    setProblem("");
    try {
      openHtml(await adminApi.html(`/payments/${id}/invoice`));
    } catch (e) {
      setProblem(errText(e));
    }
  };

  return (
    <>
      {modal}
      <PageHead title="Payments & refunds">
        <Select label="Purpose" value={filters.purpose} onChange={set("purpose")} options={[["", "All purposes"], ["booking", "Bookings"], ["membership", "Memberships"]]} />
        <Select label="Status" value={filters.status} onChange={set("status")} options={[["", "Any status"], ["paid", "Paid"], ["refunded", "Refunded"], ["created", "Started"], ["failed", "Failed"]]} />
      </PageHead>
      <Alert>{problem}</Alert>
      <Loader state={state} empty={state.data?.payments.length === 0} emptyTitle="No payments">
        {state.data && (
          <>
            <AdminTable>
              <thead>
                <tr><th>#</th><th>Payer</th><th>For</th><th>Total</th><th>GST</th><th>Refunded</th><th>Status</th><th>Paid</th><th /></tr>
              </thead>
              <tbody>
                {state.data.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.payer ? <Link to={`/admin/members/${p.payer.id}`}>{p.payer.name}</Link> : "—"}</td>
                    <td>{p.purpose === "booking" ? <Link to={`/admin/bookings/${p.bookingId}`}>Booking #{p.bookingId}</Link> : "Membership"}</td>
                    <td>{inr(p.totalPaise)}</td>
                    <td>{inr(p.gstPaise)}</td>
                    <td>{p.refundedPaise ? inr(p.refundedPaise) : "—"}</td>
                    <td><StatusBadge value={p.status} /></td>
                    <td>{dateTime(p.paidAt)}</td>
                    <td className="whitespace-nowrap">
                      {p.invoiceNo && <Button size="sm" variant="ghost" onClick={() => invoice(p.id)}>Invoice</Button>}
                      {["paid", "refunded"].includes(p.status) && p.totalPaise > (p.refundedPaise || 0) && (
                        <Button size="sm" variant="outline" onClick={() => refund(p)}>Refund</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
            <Pager page={filters.page} total={state.data.total} onPage={(pg) => setFilters((f) => ({ ...f, page: pg }))} />
          </>
        )}
      </Loader>
    </>
  );
}

export function Payouts() {
  const [status, setStatus] = useState("");
  const state = useLoad(() => adminApi.get(`/payouts${status ? `?status=${status}` : ""}`), [status]);
  const { ask, modal } = useConfirm();
  const [msg, setMsg] = useState({ tone: "good", text: "" });

  const release = async (p) => {
    setMsg({ tone: "good", text: "" });
    try {
      const r = await adminApi.post(`/payouts/${p.id}/release`);
      setMsg(r.status === "paid" ? { tone: "good", text: `Payout #${p.id} sent.` } : { tone: "bad", text: `Payout #${p.id} is still ${r.status}: ${r.note || ""}` });
      state.reload();
    } catch (e) {
      setMsg({ tone: "bad", text: errText(e) });
    }
  };

  const markPaid = (p) =>
    ask({
      title: `Mark payout #${p.id} as paid`,
      body: "Use only when you paid it outside the payout provider (manual bank transfer).",
      confirmLabel: "Mark paid",
      noteLabel: null,
      fields: [{ name: "reference", label: "Bank / UTR reference" }],
      onConfirm: async ({ reference }) => {
        await adminApi.post(`/payouts/${p.id}/mark-paid`, { reference });
        state.reload();
      },
    });

  return (
    <>
      {modal}
      <PageHead title="Payouts" sub="Pending = still inside the 24-hour complaint window. Approved = window passed, ready to release. On hold = disputed, or the Companion has no payout account / KYC yet.">
        <Select label="Status" value={status} onChange={setStatus} options={[["", "All"], ["approved", "Ready to release"], ["pending", "In complaint window"], ["on_hold", "On hold"], ["failed", "Failed"], ["paid", "Paid"]]} />
      </PageHead>
      <Alert tone={msg.tone}>{msg.text}</Alert>
      <Loader state={state} empty={state.data?.payouts.length === 0} emptyTitle="No payouts">
        <AdminTable>
          <thead>
            <tr><th>#</th><th>Companion</th><th>Booking</th><th>Amount</th><th>Status</th><th>Reference / note</th><th>Created</th><th /></tr>
          </thead>
          <tbody>
            {state.data?.payouts.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.companion ? <Link to={`/admin/members/${p.companion.id}`}>{p.companion.name}</Link> : "—"} <span className="text-xs text-muted">KYC {p.companion?.kycStatus}</span></td>
                <td><Link to={`/admin/bookings/${p.bookingId}`}>#{p.bookingId}</Link></td>
                <td>{inr(p.amountPaise)}</td>
                <td><StatusBadge value={p.status} /></td>
                <td className="max-w-[14rem] text-xs">{p.reference || p.note || "—"}</td>
                <td>{dateOnly(p.createdAt)}</td>
                <td className="whitespace-nowrap">
                  {p.status !== "paid" && p.note !== "Disputed" && (
                    <>
                      <Button size="sm" onClick={() => release(p)}>Release</Button>{" "}
                      <Button size="sm" variant="ghost" onClick={() => markPaid(p)}>Mark paid</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      </Loader>
    </>
  );
}
