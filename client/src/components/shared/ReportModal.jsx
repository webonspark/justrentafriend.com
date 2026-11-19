import { useState } from "react";
import { Modal } from "react-bootstrap";
import { api, ApiError } from "../../services/api";
import { REPORT_REASONS } from "../../lib/format";
import { Alert, Button, Field } from "../ui";

/**
 * Report someone — from a profile, a booking or a chat message — and
 * optionally block them at the same time.
 */
export default function ReportModal({ show, onHide, reportedId, name, bookingId, messageId, onDone }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [block, setBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");

  const submit = async () => {
    if (!reason) return setProblem("Choose a reason.");
    setBusy(true);
    setProblem("");
    try {
      const r = await api.report({ reportedId, reason, details, bookingId, messageId, block });
      setDone(r.message);
      onDone?.({ blocked: block });
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Could not send the report.");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setDone("");
    setReason("");
    setDetails("");
    onHide();
  };

  return (
    <Modal show={show} onHide={close} centered>
      <Modal.Header closeButton>
        <Modal.Title>Report {name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {done ? (
          <>
            <Alert tone="good">{done}</Alert>
            <Button block onClick={close}>Close</Button>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">Reports are confidential — {name} is not told who reported them. If you are in danger, call 112.</p>
            <div className="mb-4 space-y-2">
              {REPORT_REASONS.map(([id, label]) => (
                <label key={id} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="reason" value={id} checked={reason === id} onChange={() => setReason(id)} /> {label}
                </label>
              ))}
            </div>
            <Field as="textarea" rows={3} label="What happened? (optional)" id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} />
            <label className="mb-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} /> Also block {name}
            </label>
            <Alert>{problem}</Alert>
            <Button block loading={busy} onClick={submit}>Send report</Button>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
