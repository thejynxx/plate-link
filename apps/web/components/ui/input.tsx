import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "input-well flex h-11 w-full min-w-0 rounded-xl px-3.5 py-2 text-[15px] placeholder:text-muted-foreground/70 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

/** Input whose label sits inside and lifts on focus/when filled. */
function FloatingInput({
  label,
  id,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "placeholder"> & { label: string; id: string }) {
  return (
    <div className="float-field">
      <input
        id={id}
        placeholder=" "
        data-slot="input"
        className={cn("input-well flex h-14 w-full rounded-xl px-3.5 pb-1.5 text-[15px]", className)}
        {...props}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  )
}

export { Input, FloatingInput }
