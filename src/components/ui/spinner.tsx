import { cn } from "#/lib/utils.ts";
import { SpinnerIcon } from "@phosphor-icons/react";

interface SpinnerProps extends React.ComponentProps<"svg"> {
  /** Set to announce the spinner as a status; omit to keep it decorative. */
  label?: string;
}

function Spinner({ className, label, ...props }: SpinnerProps) {
  return (
    <SpinnerIcon
      data-slot="spinner"
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
