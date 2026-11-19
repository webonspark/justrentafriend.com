import { useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import { FiLock, FiSmartphone, FiCreditCard } from "react-icons/fi";
import { api, ApiError } from "../../services/api";
import { inr } from "../../lib/format";
import { Alert, Button } from "../ui";

/**
 * Pays for something the server has already priced.
 *
 * `checkout` is what the server returned when the payment started. With the
 * Razorpay gateway it opens Razorpay Checkout (UPI, cards, netbanking); with
 * the mock gateway it shows a test checkout so the whole flow works with no
 * account. Either way the server verifies the payment — the browser's word
 * is never enough.
 */
function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => reject(new Error("Could not load the payment page."));
    document.body.appendChild(s);
  });
}

export default function Checkout({ checkout, onPaid, onClose }) {
  const [method, setMethod] = useState("upi");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const verify = async (gatewayPaymentId, signature) => {
    setBusy(true);
    setProblem("");
    try {
      const result = await api.verifyPayment({ paymentId: checkout.paymentId, gatewayPaymentId, signature });
      onPaid(result);
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "The payment could not be confirmed.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!checkout || checkout.gateway !== "razorpay") return;
    loadRazorpay()
      .then((Razorpay) => {
        const rzp = new Razorpay({
          key: checkout.keyId,
          order_id: checkout.orderId,
          amount: checkout.amountPaise,
          currency: "INR",
          description: checkout.description,
          prefill: checkout.prefill,
          theme: { color: "#e11d2e" },
          handler: (r) => verify(r.razorpay_payment_id, r.razorpay_signature),
          modal: { ondismiss: onClose },
        });
        rzp.open();
      })
      .catch((e) => setProblem(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout]);

  if (!checkout) return null;
  if (checkout.gateway === "razorpay") {
    return problem ? <Alert>{problem}</Alert> : null;
  }

  const fakeId = () => `mock_pay_${Math.random().toString(36).slice(2, 12)}`;

  return (
    <Modal show centered onHide={busy ? undefined : onClose}>
      <Modal.Header closeButton={!busy}>
        <Modal.Title>Pay {inr(checkout.amountPaise)}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-4 text-sm text-muted">{checkout.description}</p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          {[
            ["upi", "UPI", FiSmartphone],
            ["card", "Card", FiCreditCard],
          ].map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMethod(id)}
              className={`k-card k-card-pad flex items-center gap-2 text-left ${method === id ? "border-rose" : ""}`}
              style={method === id ? { borderColor: "var(--rose)" } : undefined}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>
        <Alert tone="info">
          Test mode — no money moves. Switch PAYMENT_GATEWAY to razorpay on the server for real UPI and card payments.
        </Alert>
        <Alert>{problem}</Alert>
        <Button block loading={busy} onClick={() => verify(fakeId(), "mock")}>
          <FiLock /> Pay {inr(checkout.amountPaise)}
        </Button>
      </Modal.Body>
    </Modal>
  );
}
