import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Modal, Table } from "react-bootstrap";
import { ApiError } from "../../services/api";
import { Alert, Badge, Button, EmptyState, Field, Skeleton } from "../../components/ui";

/**
 * Pieces every admin screen shares: who is signed in, loading a resource,
 * the confirm-with-a-reason modal, pagination and the status badge.
 */

export const AdminContext = createContext(null);
export const useAdmin = () => useContext(AdminContext);

/** What each staff role may open. super_admin sees everything. */
export const SECTION_ROLES = {
  dashboard: ["moderator", "finance", "support"],
  members: ["moderator", "finance", "support"],
  approvals: ["moderator"],
  kyc: ["moderator"],
  photos: ["moderator"],
  bookings: ["finance", "support"],
  payments: ["finance"],
  payouts: ["finance"],
  reports: ["moderator"],
  sos: ["moderator"],
  reviews: ["moderator"],
  settings: ["finance"],
  categories: ["moderator"],
  plans: ["finance"],
  audit: [],
  staff: [],
};

export const can = (admin, section) =>
  Boolean(admin) && (admin.role === "super_admin" || (SECTION_ROLES[section] || []).includes(admin.role));

/** Support staff look but do not touch. */
export const readOnly = (admin) => admin?.role === "support";

export const errText = (err) =>
  err instanceof ApiError || err instanceof Error ? err.message || "Something went wrong. Try again." : "Something went wrong. Try again.";

/**
 * Loads one admin resource. `deps` re-run it; `reload()` does it on demand,
 * quietly (without blanking the screen) so actions feel instant.
 */
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const run = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError("");
      try {
        setData(await fn());
      } catch (err) {
        setError(errText(err));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );

  useEffect(() => {
    run();
  }, [run]);

  return { data, error, loading, reload: () => run(true), setData };
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="mb-1 text-2xl">{title}</h1>
        {sub && <p className="mb-0 text-sm text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/** Loading, error and empty, in one place, so screens only render data. */
export function Loader({ state, empty, emptyTitle = "Nothing here", emptyBody, children }) {
  if (state.loading && !state.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    );
  }
  if (state.error) return <Alert>{state.error}</Alert>;
  if (empty) return <EmptyState title={emptyTitle} body={emptyBody} />;
  return children;
}

export function AdminTable({ children }) {
  return (
    <div className="k-card overflow-x-auto" style={{ padding: 0 }}>
      <Table hover className="mb-0 align-middle text-sm">
        {children}
      </Table>
    </div>
  );
}

const TONES = {
  active: "good", approved: "good", paid: "good", completed: "good", confirmed: "good", actioned: "good", resolved: "good",
  pending: "warn", submitted: "warn", reviewing: "warn", on_hold: "warn", disputed: "warn", warned: "warn", accepted: "accent", open: "warn", in_progress: "accent",
  suspended: "accent", banned: "accent", rejected: "accent", failed: "accent", urgent: "accent", high: "warn",
};

export function StatusBadge({ value }) {
  if (!value) return <span className="text-muted">—</span>;
  return <Badge tone={TONES[value] || "plain"}>{String(value).replace(/_/g, " ")}</Badge>;
}

export function Pager({ page, total, limit = 20, onPage }) {
  const pages = Math.max(Math.ceil((total || 0) / limit), 1);
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

/**
 * Asks before doing something that matters, and collects the note that goes
 * into the audit log. `fields` adds extra inputs (e.g. a refund amount).
 */
export function ConfirmModal({ show, title, body, confirmLabel = "Confirm", noteLabel = "Note (saved to the audit log)", requireNote = false, fields = [], onConfirm, onClose }) {
  const [note, setNote] = useState("");
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    if (show) {
      setNote("");
      setValues(Object.fromEntries(fields.map((f) => [f.name, f.initial ?? ""])));
      setProblem("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const go = async () => {
    if (requireNote && note.trim().length < 3) {
      setProblem("Add a short note explaining why.");
      return;
    }
    setBusy(true);
    setProblem("");
    try {
      await onConfirm({ note: note.trim(), ...values });
      onClose();
    } catch (err) {
      setProblem(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={show} onHide={busy ? undefined : onClose} centered>
      <Modal.Header closeButton={!busy}>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {body && <p className="mb-4 text-sm text-muted">{body}</p>}
        {fields.map((f) => (
          <Field
            key={f.name}
            id={`confirm-${f.name}`}
            label={f.label}
            as={f.as || "input"}
            type={f.as ? undefined : f.type || "text"}
            hint={f.hint}
            value={values[f.name] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
          >
            {f.children}
          </Field>
        ))}
        {noteLabel && (
          <Field id="confirm-note" label={noteLabel} as="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        )}
        <Alert>{problem}</Alert>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button onClick={go} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  );
}

/** One confirm modal per screen: `ask({...})` opens it. */
export function useConfirm() {
  const [cfg, setCfg] = useState(null);
  const modal = <ConfirmModal show={Boolean(cfg)} {...(cfg || {})} onConfirm={cfg?.onConfirm || (() => {})} onClose={() => setCfg(null)} />;
  return { ask: setCfg, modal };
}

/** Key/value rows for detail pages. */
export function Facts({ rows }) {
  return (
    <dl className="mb-0 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {rows.filter(Boolean).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-ink-line py-1">
          <dt className="text-muted">{k}</dt>
          <dd className="mb-0 text-right">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Opens server-rendered HTML (an invoice) in a new window. */
export function openHtml(html) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function Select({ value, onChange, options, label }) {
  return (
    <select aria-label={label} className="k-input" style={{ width: "auto", minWidth: 150 }} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
