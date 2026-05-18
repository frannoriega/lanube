import { cn } from "@/lib/utils";

export default function Container({
  children,
  className,
}: React.ComponentPropsWithoutRef<"div">) {
  const cns = cn("w-full h-full max-w-7xl px-4 mx-auto", className);
  return <div className={cns}>{children}</div>;
}
