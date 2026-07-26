import clsx from "clsx";

/** Visible MOCK chip — declared first-run samples only. */
export default function MockBadge({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-rose-600/90 text-white",
        className,
      )}
      data-testid="mock-badge"
      title="Sample data — cleared after onboarding"
    >
      MOCK
    </span>
  );
}
