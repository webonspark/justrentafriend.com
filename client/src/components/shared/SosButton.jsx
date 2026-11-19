import { useEffect, useRef, useState } from "react";
import { Modal } from "react-bootstrap";
import { FiAlertTriangle, FiPhone } from "react-icons/fi";
import { api, ApiError } from "../../services/api";
import { Alert, Button } from "../ui";

/**
 * The SOS button. Pressing it sends the member's live location to their
 * emergency contact (SMS/WhatsApp link) and to our safety team, then keeps
 * the location updated every 20 seconds until they mark themselves safe.
 */
export default function SosButton({ bookingId, block }) {
  const [confirm, setConfirm] = useState(false);
  const [alert, setAlert] = useState(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const watch = useRef(null);
  const last = useRef(0);

  useEffect(() => {
    api.activeSos().then((d) => d.alert && setAlert(d.alert)).catch(() => {});
    return () => watch.current !== null && navigator.geolocation?.clearWatch(watch.current);
  }, []);

  useEffect(() => {
    if (!alert || alert.status !== "active" || !navigator.geolocation) return undefined;
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (Date.now() - last.current < 20000) return;
        last.current = Date.now();
        api.sosLocation(alert.id, { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watch.current);
  }, [alert]);

  const position = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), () => resolve(null), { enableHighAccuracy: true, timeout: 8000 });
    });

  const raise = async () => {
    setBusy(true);
    setProblem("");
    try {
      const c = await position();
      const a = await api.sos({ bookingId, latitude: c?.latitude, longitude: c?.longitude, accuracy: c?.accuracy });
      setAlert(a);
      setConfirm(false);
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Could not send the SOS. Call 112.");
    } finally {
      setBusy(false);
    }
  };

  const safe = async () => {
    await api.resolveSos(alert.id);
    setAlert(null);
  };

  if (alert) {
    return (
      <div className="rounded-panel border p-4" style={{ borderColor: "var(--bad-line)", background: "var(--bad-soft)" }}>
        <p className="mb-1 flex items-center gap-2 font-bold" style={{ color: "var(--bad)" }}><FiAlertTriangle /> SOS active</p>
        <p className="mb-3 text-sm">
          {alert.contactNotified === false ? "Our safety team has been alerted." : "Your emergency contact and our safety team have your live location."} Keep this page open so it stays updated.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button href="tel:112"><FiPhone /> Call 112</Button>
          <Button variant="outline" onClick={safe}>I'm safe</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button variant="outline" block={block} onClick={() => setConfirm(true)} style={{ borderColor: "var(--bad-line)", color: "var(--bad)" }}>
        <FiAlertTriangle /> SOS
      </Button>
      <Modal show={confirm} onHide={() => setConfirm(false)} centered>
        <Modal.Header closeButton><Modal.Title>Send an SOS?</Modal.Title></Modal.Header>
        <Modal.Body>
          <p>Your live location will be sent to your emergency contact and our safety team. If you are in immediate danger, call 112 first.</p>
          <Alert>{problem}</Alert>
          <div className="flex flex-wrap gap-2">
            <Button loading={busy} onClick={raise}><FiAlertTriangle /> Send SOS</Button>
            <Button href="tel:112" variant="outline"><FiPhone /> Call 112</Button>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}
