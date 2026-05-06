import { cn } from "./cn";

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_0_rgb(15_23_42_/_0.04),0_4px_12px_-2px_rgb(15_23_42_/_0.05)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn("p-5 sm:p-6", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
