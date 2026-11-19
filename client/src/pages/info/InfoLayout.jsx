import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { BRAND, CITY } from "../../config/brand";
import { Alert } from "../../components/ui";

/**
 * Shared pieces for the information and legal pages: the page frame, a
 * section, a table of contents, and the public config (commission, support
 * emails) read once from the server.
 */

export const LAST_UPDATED = "18 November 2026";

let configCache = null;

/** The public config: brand, commission, emails. Cached for the session. */
export function useSiteConfig() {
  const [config, setConfig] = useState(configCache);
  useEffect(() => {
    if (configCache) return;
    api
      .config()
      .then((c) => {
        configCache = c;
        setConfig(c);
      })
      .catch(() => {});
  }, []);
  return {
    commissionPct: config?.commissionPct ?? 18,
    gstPct: config?.gstPct ?? 18,
    freeHours: config?.cancellation?.freeHours ?? 24,
    partialPct: config?.cancellation?.partialPct ?? 50,
    supportEmail: config?.brand?.supportEmail || "support@example.com",
    grievanceEmail: config?.brand?.grievanceEmail || "grievance@example.com",
    loaded: Boolean(config),
  };
}

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**
 * A page. `sections` (optional) is [{ title, body }]; with `toc` a table of
 * contents is shown first. `legal` adds the last-updated line and the
 * lawyer-review notice.
 */
export function InfoPage({ eyebrow, title, intro, sections = [], toc = false, legal = false, children }) {
  useEffect(() => {
    document.title = `${title} · ${BRAND}`;
  }, [title]);

  return (
    <div className="k-wrap py-12 lg:py-20">
      <div className="mx-auto max-w-3xl">
        {eyebrow && <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-rose">{eyebrow}</p>}
        <h1 className="mb-4 text-[2rem] sm:text-[2.6rem]">{title}</h1>
        {intro && <p className="mb-6 text-lg text-muted">{intro}</p>}

        {legal && (
          <>
            <p className="mb-4 text-sm text-muted">
              Last updated {LAST_UPDATED} · Applies to {BRAND} in {CITY}, India
            </p>
            <Alert tone="info">
              Draft for review. This text is a starting point and must be reviewed by a qualified lawyer
              before launch. It is not legal advice.
            </Alert>
          </>
        )}

        {toc && sections.length > 2 && (
          <nav aria-label="On this page" className="k-card k-card-pad mb-10">
            <p className="mb-3 text-sm font-semibold">On this page</p>
            <ol className="m-0 grid gap-1 ps-5 text-sm sm:grid-cols-2">
              {sections.map((s) => (
                <li key={s.title}>
                  <a href={`#${slug(s.title)}`} className="text-muted hover:text-rose">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {children}

        {sections.map((s, i) => (
          <Section key={s.title} title={s.title} number={legal ? i + 1 : null}>
            {s.body}
          </Section>
        ))}
      </div>
    </div>
  );
}

export function Section({ title, number, children }) {
  return (
    <section id={slug(title)} className="mb-10 scroll-mt-24">
      <h2 className="mb-3 text-xl sm:text-2xl">
        {number ? `${number}. ` : ""}
        {title}
      </h2>
      <div className="info-prose space-y-3 leading-relaxed text-muted">{children}</div>
    </section>
  );
}

/** A plain bullet list. */
export function List({ items }) {
  return (
    <ul className="m-0 space-y-1.5 ps-5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

/** Numbered steps, for How it works. */
export function Steps({ steps }) {
  return (
    <ol className="m-0 grid list-none gap-3 p-0">
      {steps.map(([title, body], i) => (
        <li key={title} className="k-card k-card-pad flex gap-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-soft font-bold text-rose">
            {i + 1}
          </span>
          <div>
            <p className="mb-1 font-semibold">{title}</p>
            <p className="m-0 text-sm text-muted">{body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export const Mail = ({ to }) => (
  <a href={`mailto:${to}`} className="font-semibold text-rose">
    {to}
  </a>
);
