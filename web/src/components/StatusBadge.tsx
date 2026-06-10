import { humanise } from '../lib/format';

/** Colour-coded pill for any workflow/invoice status. */
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge--${status.toLowerCase()}`}>
      {humanise(status)}
    </span>
  );
}
