import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Modal } from "react-bootstrap";
import { FiCheck, FiFlag, FiHeart, FiMapPin, FiMessageCircle, FiPlay, FiRepeat, FiShield, FiX } from "react-icons/fi";
import { api, ApiError } from "../../services/api";
import { STATUS, dateTime, inr, timeOnly } from "../../lib/format";
import { Alert, Avatar, Badge, Button, Card, EmptyState, Field, Skeleton } from "../../components/ui";
import Checkout from "../../components/shared/Checkout";
import ReportModal from "../../components/shared/ReportModal";
import SosButton from "../../components/shared/SosButton";
import PlaceMap from "../../components/shared/PlaceMap";
import { useSiteConfig } from "../info/InfoLayout";

/**
 * One booking, from either side, with the actions that side can take now.
 *
 *   Companion, pending      accept / reject
 *   Customer, accepted      pay (escrow)
 *   either, before the meet cancel (refund by the time rules)
 *   Customer, confirmed     shows the 4-digit start code at the meet
 *   Companion, confirmed    enters that code → meet in progress
 *   either, in progress     end the meet, SOS
 *   completed               review; raise a problem within 24 hours
 */
export default function BookingDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [b, setB] = useState(null);
  const [problem, setProblem] = useState("");
  const [notice, setNotice] = useState(location.state?.justRequested ? "Request sent. You will be notified when the Companion answers." : "");
  const [busy, setBusy] = useState("");
  const [checkout, setCheckout] = useState(null);
  const [dialog, setDialog] = useState(null); // "cancel" | "reject" | "dispute"
  const [reporting, setReporting] = useState(false);

  const load = useCallback(() => {
    api.booking(id).then(setB).catch((e) => setProblem(e instanceof ApiError ? e.message : "Could not load this booking."));
  }, [id]);
  useEffect(load, [load]);

  const act = async (action, body, done) => {
    setBusy(action);
    setProblem("");
    try {
      const next = await api.bookingAction(id, action, body);
      setB(next);
      setDialog(null);
      if (done) setNotice(done(next));
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "That did not work. Try again.");
    } finally {
      setBusy("");
    }
  };

  const pay = async (opts) => {
    setBusy("pay");
    setProblem("");
    try {
      const r = await api.bookingAction(id, "pay", opts);
      if (r.paid) {
        setB(r.booking);
        setNotice("Paid from your wallet — your booking is confirmed and chat is open.");
      } else {
        setCheckout(r);
      }
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Could not start the payment.");
    } finally {
      setBusy("");
    }
  };

  if (!b && problem) return <div className="k-wrap py-16"><EmptyState title="Booking not available" body={problem} action={<Button to="/bookings" variant="outline">All bookings</Button>} /></div>;
  if (!b) return <div className="k-wrap py-10"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

  const isCustomer = b.side === "customer";
  const other = isCustomer ? b.companion : b.customer;
  const st = STATUS[b.status] || { label: b.status, tone: "plain" };
  const now = Date.now();
  const start = new Date(b.startAt).getTime();
  const end = new Date(b.endAt).getTime();
  const canStart = b.status === "confirmed" && now >= start - 30 * 60000 && now <= end;
  const meetLive = b.status === "in_progress" || (b.status === "confirmed" && now >= start - 60 * 60000 && now <= end + 3 * 3600e3);
  const first = other.name.split(" ")[0];

  return (
    <div className="k-wrap py-8 lg:py-12">
      <Link to="/bookings" className="mb-4 inline-block text-sm text-muted">← All bookings</Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-[1.75rem]">Booking #{b.id}</h1>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <Alert tone="good">{notice}</Alert>
      <Alert>{problem}</Alert>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card className="flex items-center gap-4">
            {other.photo ? <img src={other.photo} alt="" className="h-16 w-16 rounded-full object-cover" /> : <Avatar name={other.name} size={64} />}
            <div className="flex-1">
              <p className="m-0 text-xs uppercase tracking-wide text-muted">{isCustomer ? "Your Companion" : "Your Customer"}</p>
              <p className="m-0 text-lg font-bold">
                {other.name} {other.verified && <Badge tone="good">Verified</Badge>}{" "}
                {!isCustomer && (other.idVerified ? <Badge tone="good"><FiShield className="mr-1 inline" />ID verified</Badge> : <Badge>ID not verified</Badge>)}
              </p>
              <p className="m-0 text-sm text-muted">{other.ratingCount ? `★ ${other.rating.toFixed(1)} (${other.ratingCount})` : "No ratings yet"}</p>
            </div>
            {isCustomer && <Button to={`/companions/${other.id}`} variant="ghost" size="sm">Profile</Button>}
          </Card>

          <Card>
            <Row label="Service" value={b.service?.name} />
            <Row label="When" value={`${dateTime(b.startAt)} – ${timeOnly(b.endAt)} (${b.hours} h)`} />
            <Row label="Where" value={<span className="flex items-center gap-1"><FiMapPin size={13} /> {b.meetingPlace.name}{b.meetingPlace.address ? `, ${b.meetingPlace.address}` : ""}</span>} />
            {b.meetingPlace.latitude != null && ["pending", "accepted", "confirmed", "in_progress"].includes(b.status) && (
              <div className="mt-3"><PlaceMap latitude={b.meetingPlace.latitude} longitude={b.meetingPlace.longitude} name={b.meetingPlace.name} /></div>
            )}
            {b.note && <Row label="Note" value={b.note} />}
            {b.rejectReason && <Row label="Reason" value={b.rejectReason} />}
            {b.cancelReason && <Row label="Cancelled" value={`By the ${b.cancelledBy}: ${b.cancelReason}`} />}
            {b.disputeReason && <Row label="Problem raised" value={b.disputeReason} />}
            {b.disputeResolution && <Row label="Our decision" value={b.disputeResolution} />}
          </Card>

          {b.status === "confirmed" && (
            <Card>
              <h2 className="mb-3 text-lg">At the meet</h2>
              {isCustomer ? (
                <>
                  <p className="text-sm text-muted">When you meet {first}, show them this code. They enter it to start the meet — it proves you both turned up. Don't share it before you meet.</p>
                  <p className="my-3 text-center font-mono text-4xl font-bold tracking-[0.4em]" aria-label="Your start code">{b.startCode || "····"}</p>
                </>
              ) : (
                <StartCodeForm
                  name={first}
                  disabled={!canStart}
                  busy={busy === "start"}
                  onSubmit={(code) => act("start", { code }, () => "Meet started. Have a good time — the SOS button is here if you need it.")}
                />
              )}
              <div className="mt-4 flex flex-wrap gap-2">{meetLive && <SosButton bookingId={b.id} />}</div>
              {!canStart && <p className="mb-0 mt-3 text-xs text-muted">{isCustomer ? "The SOS button appears shortly before the start time." : "You can enter the code from 30 minutes before the start time."}</p>}
            </Card>
          )}

          {b.status === "in_progress" && (
            <Card>
              <h2 className="mb-3 text-lg">Meet in progress</h2>
              <SafetyCheck check={b.safetyCheck} busy={busy === "safe"} onSafe={() => act("safe", {}, () => "Thanks — glad you're OK. Enjoy the rest of your meet.")} />
              <Row label="Started" value={timeOnly(b.startedAt)} />
              <Row label="Booked until" value={timeOnly(b.endAt)} />
              <p className="mt-3 text-xs text-muted">The meet ends by itself at the booked time. End it earlier if you're done.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" loading={busy === "complete"} onClick={() => act("complete", {}, () => "Meet ended. Thanks! Leave a review below.")}>
                  <FiCheck /> End meet
                </Button>
                <SosButton bookingId={b.id} />
              </div>
            </Card>
          )}

          {b.canReview && <ReviewForm name={other.name.split(" ")[0]} onSubmit={(body) => act("review", body, () => "Thanks for your review.")} busy={busy === "review"} />}
          {b.myReview && (
            <Card>
              <h2 className="mb-2 text-lg">Your review</h2>
              <p className="m-0 text-rose">{"★".repeat(b.myReview.rating)}</p>
              {b.myReview.comment && <p className="m-0 mt-1 text-sm">{b.myReview.comment}</p>}
            </Card>
          )}
          {b.theirReview && (
            <Card>
              <h2 className="mb-2 text-lg">{other.name.split(" ")[0]}'s review of you</h2>
              <p className="m-0 text-rose">{"★".repeat(b.theirReview.rating)}</p>
              {b.theirReview.comment && <p className="m-0 mt-1 text-sm">{b.theirReview.comment}</p>}
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <h2 className="mb-3 text-lg">Payment</h2>
            <Row label={`${inr(b.pricePerHourPaise)} × ${b.hours} h`} value={inr(b.amountPaise)} />
            {!isCustomer && (
              <>
                <Row label={`Platform fee (${b.commissionPct}%)`} value={`− ${inr(b.commissionPaise)}`} />
                <Row label="You receive" value={<strong>{inr(b.payoutPaise)}</strong>} />
              </>
            )}
            {isCustomer && b.discountPaise ? <Row label="Coupon discount" value={`− ${inr(b.discountPaise)}`} /> : null}
            {b.refundPaise ? <Row label="Refunded" value={inr(b.refundPaise)} /> : null}
            <p className="mb-0 mt-2 text-xs text-muted">
              {["confirmed", "in_progress"].includes(b.status) && "Paid and held safely by us until after the meet."}
              {b.status === "completed" && (b.payoutReleasedAt
                ? "Released to the Companion."
                : b.complaintWindowEndsAt && now < new Date(b.complaintWindowEndsAt).getTime()
                  ? `Held until ${dateTime(b.complaintWindowEndsAt)} in case there's a problem, then paid to the Companion.`
                  : "Complaint window over — payout being sent to the Companion.")}
              {b.status === "disputed" && "On hold while our team reviews the problem."}
              {["pending", "accepted"].includes(b.status) && "Nothing has been charged yet."}
            </p>
          </Card>

          <Card className="space-y-2">
            {b.status === "pending" && !isCustomer && (
              <>
                <Button block loading={busy === "accept"} onClick={() => act("accept", {}, () => "Accepted. The Customer has been asked to pay.")}><FiCheck /> Accept</Button>
                <Button block variant="outline" onClick={() => setDialog("reject")}><FiX /> Decline</Button>
              </>
            )}
            {b.status === "pending" && isCustomer && <p className="m-0 text-sm text-muted">Waiting for {other.name.split(" ")[0]} to answer — usually within a day.</p>}
            {b.status === "accepted" && isCustomer && <PayBox bookingId={b.id} amountPaise={b.amountPaise} busy={busy === "pay"} onPay={pay} />}
            {b.status === "accepted" && !isCustomer && <p className="m-0 text-sm text-muted">Waiting for the Customer to pay.</p>}
            {b.conversationId && <Button block variant="outline" to={`/messages/${b.conversationId}`}><FiMessageCircle /> Chat</Button>}
            {["pending", "accepted", "confirmed"].includes(b.status) && <Button block variant="ghost" onClick={() => setDialog("cancel")}>Cancel booking</Button>}
            {b.canDispute && (
              <Button block variant="ghost" onClick={() => setDialog("dispute")}>Report a problem with this meet</Button>
            )}
            {isCustomer && ["completed", "cancelled", "expired", "rejected"].includes(b.status) && (
              <>
                <Button block to={`/companions/${other.id}`}><FiRepeat /> Book {first} again</Button>
                <FavoriteButton companionId={other.id} />
              </>
            )}
            <Button block variant="ghost" onClick={() => setReporting(true)}><FiFlag /> Report {other.name.split(" ")[0]}</Button>
          </Card>
        </aside>
      </div>

      <ReasonDialog
        kind={dialog}
        onHide={() => setDialog(null)}
        busy={Boolean(busy)}
        isCustomer={isCustomer}
        status={b.status}
        onSubmit={(reason, refundTo) => {
          if (dialog === "cancel") act("cancel", { reason, refundTo }, (next) => `${next.refundNote || "Booking cancelled."}${next.refundPaise && refundTo === "wallet" ? " The refund is in your wallet now." : ""}`);
          if (dialog === "reject") act("reject", { reason }, () => "Declined. The Customer has been told.");
          if (dialog === "dispute") act("dispute", { reason }, () => "Thanks. Our team will review this and contact you; the payment is on hold meanwhile.");
        }}
      />
      <ReportModal show={reporting} onHide={() => setReporting(false)} reportedId={other.id} name={other.name.split(" ")[0]} bookingId={b.id} />
      {checkout && (
        <Checkout
          checkout={checkout}
          onClose={() => setCheckout(null)}
          onPaid={() => {
            setCheckout(null);
            setNotice("Paid — your booking is confirmed and chat is open.");
            load();
          }}
        />
      )}
    </div>
  );
}

function StartCodeForm({ name, disabled, busy, onSubmit }) {
  const [code, setCode] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 4) onSubmit(code);
      }}
    >
      <p className="text-sm text-muted">When you meet {name}, ask for their 4-digit start code and enter it here. Your payout depends on it — it proves the meet happened.</p>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field
            label="Start code"
            id="start-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            disabled={disabled}
          />
        </div>
        <Button type="submit" loading={busy} disabled={disabled || code.length !== 4}><FiPlay /> Start meet</Button>
      </div>
    </form>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink-line py-2 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function ReasonDialog({ kind, onHide, onSubmit, busy, isCustomer, status }) {
  const [reason, setReason] = useState("");
  const [refundTo, setRefundTo] = useState("wallet");
  const { freeHours, partialPct } = useSiteConfig();
  if (!kind) return null;
  const copy = {
    cancel: {
      title: "Cancel this booking?",
      body:
        status !== "confirmed"
          ? !isCustomer && status === "accepted"
            ? "Nothing has been charged. Cancelling a booking you accepted counts as a strike — 3 strikes suspend your account."
            : "Nothing has been charged, so there is nothing to refund."
          : isCustomer
            ? `Full refund if you cancel ${freeHours} hours or more before the start; ${partialPct}% inside ${freeHours} hours; none after the start.`
            : "The Customer gets a full refund, and cancelling an accepted booking counts as a strike. 3 strikes suspend your account.",
      button: "Cancel booking",
    },
    reject: { title: "Decline this request?", body: "The Customer is not charged. A short reason helps them.", button: "Decline" },
    dispute: { title: "Report a problem", body: "Tell us what went wrong. The payment is held until our team decides — usually within 48 hours.", button: "Send to our team" },
  }[kind];
  return (
    <Modal show onHide={onHide} centered>
      <Modal.Header closeButton><Modal.Title>{copy.title}</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className="text-sm text-muted">{copy.body}</p>
        <Field as="textarea" rows={3} label={kind === "dispute" ? "What happened?" : "Reason (optional)"} id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        {kind === "cancel" && isCustomer && status === "confirmed" && (
          <fieldset className="mb-4">
            <legend className="mb-2 text-sm font-bold">Where should any refund go?</legend>
            <label className="mb-1 flex items-start gap-2 text-sm">
              <input type="radio" name="refundTo" className="mt-1" checked={refundTo === "wallet"} onChange={() => setRefundTo("wallet")} />
              <span>My wallet — <strong>instant</strong>, use it on your next booking</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="refundTo" className="mt-1" checked={refundTo === "original"} onChange={() => setRefundTo("original")} />
              <span>Back to my card / UPI — takes 5–7 working days</span>
            </label>
          </fieldset>
        )}
        <Button block loading={busy} onClick={() => onSubmit(reason, refundTo)}>{copy.button}</Button>
      </Modal.Body>
    </Modal>
  );
}

function ReviewForm({ name, onSubmit, busy }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  return (
    <Card>
      <h2 className="mb-2 text-lg">How was your time with {name}?</h2>
      <div className="mb-3 flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} stars`} onClick={() => setRating(n)} className={`text-3xl ${n <= rating ? "text-rose" : "text-muted"}`} style={{ background: "none", border: 0 }}>★</button>
        ))}
      </div>
      <Field as="textarea" rows={3} label="A few words (optional)" id="review" value={comment} onChange={(e) => setComment(e.target.value)} />
      <Button loading={busy} disabled={!rating} onClick={() => onSubmit({ rating, comment })}>Post review</Button>
    </Card>
  );
}

/** Halfway through a meet: "Are you OK?" — one tap answers it. */
function SafetyCheck({ check, busy, onSafe }) {
  if (!check) return null;
  if (check.waiting) {
    return (
      <div className="mb-4 rounded-xl border p-4" style={{ borderColor: "var(--rose)" }}>
        <p className="m-0 font-bold">Are you OK?</p>
        <p className="mb-3 mt-1 text-sm text-muted">A quick safety check. If you don't answer, our safety team is told and may call you.</p>
        <Button loading={busy} onClick={onSafe}><FiShield /> I'm safe</Button>
      </div>
    );
  }
  if (check.mySafeAt) return <p className="mb-3 flex items-center gap-1 text-sm text-muted"><FiShield /> You checked in safe at {timeOnly(check.mySafeAt)}.</p>;
  return (
    <p className="mb-3 text-sm text-muted">
      We'll ask both of you "Are you OK?" partway through. <button type="button" className="underline" style={{ background: "none", border: 0, padding: 0 }} onClick={onSafe}>I'm safe</button>
    </p>
  );
}

/** Pay an accepted booking: optional coupon, optional wallet, then checkout. */
function PayBox({ bookingId, amountPaise, busy, onPay }) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState("");
  const [useWallet, setUseWallet] = useState(false);
  const [q, setQ] = useState(null);
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async (opts) => {
    setChecking(true);
    try {
      setQ(await api.bookingAction(bookingId, "quote", opts));
      setErr("");
      return true;
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not check that.");
      return false;
    } finally {
      setChecking(false);
    }
  }, [bookingId]);

  useEffect(() => { refresh({ couponCode: applied || null, useWallet }); }, [refresh, applied, useWallet]);

  const apply = async () => {
    const c = code.trim();
    if (!c) return;
    if (await refresh({ couponCode: c, useWallet })) setApplied(c);
  };

  const payable = q ? q.payablePaise : amountPaise;
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="Coupon code" id="coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. FIRST20" disabled={Boolean(applied)} />
        </div>
        {applied ? (
          <Button variant="ghost" size="sm" onClick={() => { setApplied(""); setCode(""); }}>Remove</Button>
        ) : (
          <Button variant="outline" size="sm" loading={checking} disabled={!code.trim()} onClick={apply}>Apply</Button>
        )}
      </div>
      {err && <p className="m-0 text-xs" style={{ color: "var(--rose)" }}>{err}</p>}
      {q?.walletBalancePaise > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useWallet} onChange={() => setUseWallet((v) => !v)} />
          Use my wallet ({inr(q.walletBalancePaise)} available)
        </label>
      )}
      {q && (q.discountPaise > 0 || q.walletPaise > 0 || q.gstPaise > 0) && (
        <div className="text-sm">
          <Row label="Booking" value={inr(q.amountPaise)} />
          {q.gstPaise > 0 && <Row label="GST on fee" value={inr(q.gstPaise)} />}
          {q.discountPaise > 0 && <Row label={`Coupon ${q.coupon?.code}`} value={`− ${inr(q.discountPaise)}`} />}
          {q.walletPaise > 0 && <Row label="From wallet" value={`− ${inr(q.walletPaise)}`} />}
          <Row label="To pay now" value={<strong>{inr(q.payablePaise)}</strong>} />
        </div>
      )}
      <Button block loading={busy} disabled={checking} onClick={() => onPay({ couponCode: applied || null, useWallet })}>
        {payable === 0 ? "Confirm — paid by wallet / coupon" : `Pay ${inr(payable)}`}
      </Button>
    </div>
  );
}

/** Save a Companion for later ("Book again" from your favourites). */
function FavoriteButton({ companionId }) {
  const [on, setOn] = useState(null);
  useEffect(() => {
    api.favorites().then((d) => setOn(d.favorites.some((f) => f.id === companionId))).catch(() => setOn(false));
  }, [companionId]);
  if (on === null) return null;
  return (
    <Button block variant="ghost" onClick={async () => { await api.favorite(companionId, !on); setOn(!on); }}>
      <FiHeart style={on ? { fill: "currentColor" } : undefined} /> {on ? "Saved to favourites" : "Save to favourites"}
    </Button>
  );
}
