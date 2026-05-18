import { cn } from "@/lib/utils";

export default function Breakout({
  children,
  className,
}: React.ComponentPropsWithoutRef<"div">) {
  const cns = cn("w-dvw relative left-1/2 -translate-x-1/2", className);
  return <div className={cns}>{children}</div>;
}
