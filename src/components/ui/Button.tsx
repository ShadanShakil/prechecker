import * as React from "react";
import { cn } from "./cn";

type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success"
  | "outline";
type Size = "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-[var(--color-brand-600)] text-white shadow-sm hover:bg-[var(--color-brand-700)] active:translate-y-px",
  secondary:
    "bg-slate-100 text-slate-900 hover:bg-slate-200 active:translate-y-px",
  outline:
    "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger:
    "bg-[var(--color-danger-600)] text-white shadow-sm hover:bg-[var(--color-danger-500)]/95 active:translate-y-px",
  success:
    "bg-[var(--color-success-600)] text-white shadow-sm hover:bg-[var(--color-success-500)]/95 active:translate-y-px",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      iconLeft,
      iconRight,
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        {...rest}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 ease-out",
          "focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]/40 focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
      >
        {iconLeft}
        {children}
        {iconRight}
      </button>
    );
  },
);
