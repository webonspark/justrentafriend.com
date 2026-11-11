import { FiClock } from "react-icons/fi";
import { Button, EmptyState } from "../components/ui";

/**
 * A stand-in for a page a later phase builds.
 *
 * It names the phase that fills it, so the route exists, the navigation
 * works end to end, and nobody clicks into a blank screen wondering whether
 * something is broken.
 */
export default function Placeholder({ title, phase, body }) {
  return (
    <div className="k-wrap py-20">
      <EmptyState
        icon={<FiClock size={22} />}
        title={title}
        body={body || `This page arrives in Phase ${phase}.`}
        action={
          <Button to="/" variant="outline">
            Back to the home page
          </Button>
        }
      />
    </div>
  );
}
