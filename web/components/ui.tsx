import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type LabelHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@breadcoop/ui";

// The bread-ui-kit ships no Card / Input / Alert primitives, so we build them
// here using the kit's design tokens (paper surfaces, surface-ink text, system
// colors). Button / Typography / Logo / Chip / Footer come straight from the kit.

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-paper-2 bg-paper-0 text-surface-ink shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-breadDisplay text-xl font-semibold leading-none tracking-tight text-surface-ink", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-surface-grey-2", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col items-stretch p-6 pt-0", className)} {...props} />;
}

export function Alert({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" | "warning" | "positive" }) {
  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded-xl border px-4 py-3 text-sm",
        variant === "destructive" && "border-system-red/40 bg-red-0 text-system-red",
        variant === "warning" && "border-system-warning/40 bg-orange-0 text-system-warning",
        variant === "positive" && "border-system-green/40 bg-jade-0 text-system-green",
        variant === "default" && "border-paper-2 bg-paper-1 text-surface-ink",
        className,
      )}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-xl border border-paper-2 bg-paper-0 px-3 py-2 text-sm text-surface-ink placeholder:text-surface-grey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-orange/40 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("text-sm font-medium leading-none text-surface-grey-2", className)} {...props} />
  );
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[80px] w-full rounded-xl border border-paper-2 bg-paper-0 px-3 py-2 text-sm text-surface-ink placeholder:text-surface-grey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-orange/40 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

/** Registration-grade badge, styled on the bread-ui-kit Chip tokens. */
export function GradeBadge({
  zkVerified,
  devMode,
  className,
}: {
  zkVerified: boolean;
  devMode: boolean;
  className?: string;
}) {
  const grade = zkVerified ? "verified" : devMode ? "unverified / dev" : "optimistic";
  const styles = zkVerified
    ? "border-system-green/40 bg-jade-0 text-system-green"
    : devMode
      ? "border-surface-grey/40 bg-paper-1 text-surface-grey-2"
      : "border-primary-blue/40 bg-blue-0 text-primary-blue";
  const title = zkVerified
    ? "Proof verified on-chain by the zkPassport verifier"
    : devMode
      ? "Dev-mode registration — not a verified passport proof"
      : "Real zkPassport proof accepted optimistically (verifier not yet deployed on Gnosis)";
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        styles,
        className,
      )}
    >
      {grade}
    </span>
  );
}

// Re-export the kit's Button so pages import a single UI surface.
export { Button } from "@breadcoop/ui";
