import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Modal } from "react-bootstrap";
import { adminApi } from "../../services/api";
import { dateTime, inr } from "../../lib/format";
import { Alert, Button, Card } from "../../components/ui";
import { AdminTable, Facts, Loader, PageHead, Pager, Select, StatusBadge, errText, openHtml, readOnly, useAdmin, useConfirm, useLoad } from "./shared";

/** Every booking, and one booking with its money, disputes and chat. */

const STATUSES = ["", "pending", "accepted", "confirmed", "in_progress", "completed", "disputed", "cancelled", "rejected", "expired"];

export function BookingsAdmin() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const state = useLoad(() => adminApi.get(`/bookings?page=${page}${status ? `&status=${status}` : ""}`), [status, page]);

  return (
    <>
      <PageHead title="Bookings">
        <Select label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUSES.map((s) => [s, s ? s : "All statuses"])} />
      </PageHead>
      <Loader state={state} empty={state.data?.bookings.length === 0} emptyTitle="No bookings">
        {state.data && (
          <>
            <AdminTable>
              <thead>
                <tr><th>#</th><th>Customer → Companion</th><th>When</th><th>Place</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {state.data.bookings.map((b) => (
                  <tr key={b.id}>
                    <td><Link to={`/admin/bookings/${b.id}`}>#{b.id}</Link></td>
                    <td>{b.customer?.name} → {b.companion?.name}</td>
                    <td>{dateTime(b.startAt)} · {b.hours} h</td>
                    <td className="max-w-[12rem] truncate">{b.meetingPlaceName}</td>
                    <td>{inr(b.amountPaise)}</td>
                    <td><StatusBadge value={b.status} />{b.disputeReason && <div className="max-w-[14rem] truncate text-xs text-muted">{b.disputeReason}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
            <Pager page={page} total={state.data.total} onPage={setPage} />
          </>
        )}
      </Loader>
    </>
  );
}

export function BookingAdminDetail() {
  const { id } = useParams();
  const { admin } = useAdmin();
  const state = useLoad(() => adminApi.get(`/bookings/${id}`), [id]);
  const { ask, modal } = useConfirm();
  const [chat, setChat] = useState(null);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const finance = admin.role === "super_admin" || admin.role === "finance";

  const resolve = (outcome) => {
    const labels = {
      release: ["Pay the Companion?", "The meet counts as done: the Companion is paid their share now (amount less commission). No refund.", "Pay Companion"],
      refund_full: ["Refund the Customer in full?", "The booking is cancelled and the Companion is not paid.", "Refund in full"],
      refund_partial: ["Split the money", "The Customer gets this share back; the Companion is paid the rest, less commission.", "Split"],
    }[outcome];
    ask({
      title: labels[0],
      body: labels[1],
      confirmLabel: labels[2],
      requireNote: true,
      noteLabel: "Decision (shown to both members)",
      fields: outcome === "refund_partial" ? [{ name: "refundPct", label: "Refund to Customer (%)", type: "number", initial: "50" }] : [],
      onConfirm: async ({ note, refundPct }) => {
        await adminApi.post(`/bookings/${id}/resolve`, { outcome, note, refundPct: Number(refundPct) });
        setDone("Decision saved and both members notified.");
        state.reload();
      },
    });
  };

  const cancel = () =>
    ask({
      title: "Cancel this booking with a full refund?",
      body: "Use for safety issues or no-shows by the Companion. Both members are notified.",
      confirmLabel: "Cancel booking",
      requireNote: true,
      noteLabel: "Reason",
      onConfirm: async ({ note }) => {
        await adminApi.post(`/bookings/${id}/cancel`, { reason: note });
        setDone("Booking cancelled and refunded.");
        state.reload();
      },
    });

  const readChat = async (conversationId) => {
    setProblem("");
    try {
      setChat(await adminApi.get(`/conversations/${conversationId}`));
    } catch (e) {
      setProblem(errText(e));
    }
  };

  const invoice = async (paymentId) => {
    try {
      openHtml(await adminApi.html(`/payments/${paymentId}/invoice`));
    } catch (e) {
      setProblem(errText(e));
    }
  };

  return (
    <>
      {modal}
      <Link to="/admin/bookings" className="mb-3 inline-block text-sm">← All bookings</Link>
      <Loader state={state}>
        {state.data && (() => {
          const { booking: b, payments, payout, reports } = state.data;
          const open = ["confirmed", "in_progress", "disputed"].includes(b.status) || (b.status === "completed" && !b.payoutReleasedAt);
          return (
            <>
              <PageHead title={`Booking #${b.id}`} sub={`${b.service?.name || "Service"} · ${dateTime(b.startAt)} · ${b.hours} h`}>
                <StatusBadge value={b.status} />
              </PageHead>
              <Alert tone="good">{done}</Alert>
              <Alert>{problem}</Alert>

              {b.status === "disputed" && (
                <Alert tone="info">
                  <strong>Dispute:</strong> {b.disputeReason}
                </Alert>
              )}

              {finance && !readOnly(admin) && (open || ["pending", "accepted"].includes(b.status)) && (
                <Card className="mb-6">
                  <p className="mb-3 text-sm font-semibold">Settle</p>
                  <div className="flex flex-wrap gap-2">
                    {open && <Button size="sm" onClick={() => resolve("release")}>Pay Companion</Button>}
                    {open && <Button size="sm" variant="outline" onClick={() => resolve("refund_partial")}>Split</Button>}
                    {open && <Button size="sm" variant="outline" onClick={() => resolve("refund_full")}>Refund Customer</Button>}
                    {b.status !== "completed" && <Button size="sm" variant="ghost" onClick={cancel}>Cancel booking</Button>}
                  </div>
                </Card>
              )}

              <div className="mb-6 grid gap-4 xl:grid-cols-2">
                <Card>
                  <h2 className="mb-3 text-base">People and place</h2>
                  <Facts
                    rows={[
                      ["Customer", <Link key="c" to={`/admin/members/${b.customer.id}`}>{b.customer.name}</Link>],
                      ["Customer contact", `${b.customerContact.mobile} · ${b.customerContact.email}`],
                      ["Companion", <Link key="p" to={`/admin/members/${b.companion.id}`}>{b.companion.name}</Link>],
                      ["Companion contact", `${b.companionContact.mobile} · ${b.companionContact.email}`],
                      ["Place", `${b.meetingPlace.name} (${b.meetingPlace.type})`],
                      ["Address", b.meetingPlace.address],
                      ["Note", b.note],
                      ["Start code", b.startCode || "—"],
                      ["Meet started (code entered)", dateTime(b.startedAt)],
                      ["Customer check-in", dateTime(b.customerCheckInAt)],
                      ["Companion check-in", dateTime(b.companionCheckInAt)],
                      ["Meet ended", dateTime(b.completedAt)],
                      b.complaintWindowEndsAt && ["Complaint window ends", dateTime(b.complaintWindowEndsAt)],
                      b.cancelledAt && ["Cancelled", `${dateTime(b.cancelledAt)} by ${b.cancelledBy} — ${b.cancelReason || ""}`],
                      b.disputeResolution && ["Resolution", b.disputeResolution],
                    ]}
                  />
                </Card>
                <Card>
                  <h2 className="mb-3 text-base">Money</h2>
                  <Facts
                    rows={[
                      ["Rate", `${inr(b.pricePerHourPaise)} / h`],
                      ["Customer pays", inr(b.amountPaise)],
                      [`Commission (${b.commissionPct}%)`, inr(b.commissionPaise)],
                      ["Companion payout", inr(b.payoutPaise)],
                      ["Refunded", b.refundPaise !== null ? inr(b.refundPaise) : "—"],
                      ["Payout", payout ? <span key="po"><StatusBadge value={payout.status} /> {inr(payout.amountPaise)} {payout.reference && `· ${payout.reference}`}</span> : "—"],
                      payout?.note && ["Payout note", payout.note],
                    ]}
                  />
                  {payments.length > 0 && (
                    <div className="mt-4">
                      {payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                          <span>Payment #{p.id} · <StatusBadge value={p.status} /> {inr(p.totalPaise)}</span>
                          {p.invoiceNo && <Button size="sm" variant="ghost" onClick={() => invoice(p.id)}>{p.invoiceNo}</Button>}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <h2 className="mb-3 text-base">Reports on this booking</h2>
                  {reports.length === 0 ? <p className="mb-0 text-sm text-muted">None.</p> : reports.map((r) => (
                    <p key={r.id} className="mb-1 text-sm">#{r.id} · {r.reason.replace(/_/g, " ")} · <StatusBadge value={r.status} /></p>
                  ))}
                </Card>
                <Card>
                  <h2 className="mb-3 text-base">Chat</h2>
                  {!state.data.conversationId ? (
                    <p className="mb-0 text-sm text-muted">No chat — the booking was never paid.</p>
                  ) : state.data.canReadChat ? (
                    <>
                      <p className="mb-3 text-sm text-muted">Reading a private chat is recorded in the audit log with your name.</p>
                      <Button size="sm" variant="outline" onClick={() => readChat(state.data.conversationId)}>Read chat</Button>
                    </>
                  ) : (
                    <p className="mb-0 text-sm text-muted">Chats can be read only when reported, flagged or disputed.</p>
                  )}
                </Card>
              </div>
              {(b.myReview || b.theirReview) && (
                <Card className="mt-4">
                  <h2 className="mb-3 text-base">Reviews</h2>
                  {b.myReview && <p className="mb-1 text-sm">Customer → Companion: {"★".repeat(b.myReview.rating)} {b.myReview.comment}</p>}
                  {b.theirReview && <p className="mb-0 text-sm">Companion → Customer: {"★".repeat(b.theirReview.rating)} {b.theirReview.comment}</p>}
                </Card>
              )}
            </>
          );
        })()}
      </Loader>
      <ChatModal chat={chat} onClose={() => setChat(null)} />
    </>
  );
}

/** A private conversation, read-only, with the unfiltered text. */
export function ChatModal({ chat, onClose }) {
  return (
    <Modal show={Boolean(chat)} onHide={onClose} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>Chat · booking #{chat?.bookingId}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert tone="info">This view has been written to the audit log. Shown unfiltered; masked text is what the other side saw.</Alert>
        {chat?.messages.length === 0 && <p className="text-sm text-muted">No messages.</p>}
        {chat?.messages.map((m) => (
          <div key={m.id} className={`mb-3 rounded-xl border p-3 text-sm ${m.flagged ? "border-rose" : "border-ink-line"}`} style={m.flagged ? { borderColor: "var(--rose)" } : undefined}>
            <p className="mb-1 text-xs text-muted">
              {m.sender} · {dateTime(m.createdAt)} {m.flagged && <StatusBadge value="flagged" />} {m.flagReason && `(${m.flagReason})`}
            </p>
            <p className="mb-0">{m.body}</p>
            {m.filtered && <p className="mb-0 mt-1 text-xs text-muted">Delivered as: {m.filtered}</p>}
          </div>
        ))}
      </Modal.Body>
    </Modal>
  );
}
