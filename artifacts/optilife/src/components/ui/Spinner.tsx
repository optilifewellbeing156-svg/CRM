import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

const SIZE_CLASS = { sm: "size-3", md: "size-4", lg: "size-8" } as const;

function Spinner({
  className,
  size = "md",
  ...props
}: Omit<React.ComponentProps<"svg">, "size"> & { size?: keyof typeof SIZE_CLASS }) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn(SIZE_CLASS[size], "animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
