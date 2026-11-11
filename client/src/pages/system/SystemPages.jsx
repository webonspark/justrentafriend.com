import { Link } from "react-router-dom";
import { FiAlertTriangle, FiLock, FiSearch, FiTool } from "react-icons/fi";
import { BRAND } from "../../config/brand";
import { Button } from "../../components/ui";

/**
 * 404, 403, 500 and maintenance.
 *
 * Each says what happened and what to do about it. None of them apologise
 * or go vague: "that page does not exist" is more use than "oops!".
 */

function Shell({ icon: Icon, code, title, body, children }) {
  return (
    <div className="k-wrap flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      <span className="mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-ink-high text-rose">
        <Icon size={26} aria-hidden="true" />
      </span>

      {code && <p className="mb-2 text-sm font-bold text-faint">{code}</p>}

      <h1 className="mb-4 text-[2rem] sm:text-[2.5rem]">{title}</h1>
      <p className="mb-9 max-w-prose text-muted">{body}</p>

      <div className="flex flex-wrap justify-center gap-3">{children}</div>
    </div>
  );
}

export function NotFound() {
  return (
    <Shell
      icon={FiSearch}
      code="404"
      title="That page does not exist"
      body="The link may be old, or the address may have a typo in it."
    >
      <Button to="/">Back to the home page</Button>
      <Button to="/help" variant="outline">
        Get help
      </Button>
    </Shell>
  );
}

export function Forbidden() {
  return (
    <Shell
      icon={FiLock}
      code="403"
      title="You cannot open this"
      body="Your account does not have access to that page. If you think it should, support can look into it."
    >
      <Button to="/">Back to the home page</Button>
      <Button to="/contact" variant="outline">
        Contact support
      </Button>
    </Shell>
  );
}

export function ServerError() {
  return (
    <Shell
      icon={FiAlertTriangle}
      code="500"
      title="Something broke on our side"
      body="This one is ours, not yours. Try again in a moment — if it keeps happening, tell us and we will look."
    >
      <Button onClick={() => window.location.reload()}>Try again</Button>
      <Button to="/contact" variant="outline">
        Report it
      </Button>
    </Shell>
  );
}

export function Maintenance() {
  return (
    <Shell
      icon={FiTool}
      title={`${BRAND} is down for maintenance`}
      body="We are making a change that needs the site offline for a few minutes. Nothing you have paid for is affected."
    >
      <Button onClick={() => window.location.reload()}>Check again</Button>
    </Shell>
  );
}
