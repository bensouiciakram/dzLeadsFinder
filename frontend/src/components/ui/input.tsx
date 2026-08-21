import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

// The form-field input (auth forms, saved-search naming): taller than the
// compact Input above, uses the design-system text-body size and the
// primary-tinted focus ring. One class string owned here — the seven
// call sites used to hand-copy it, which is how a focus-ring tweak would
// have had to land seven times.
const TEXT_INPUT_CLASS =
  'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30'

// forwardRef: react-hook-form's register() spreads a ref — a plain
// function component would drop it (React 18) and sever value tracking.
const TextInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function TextInput({ className, type, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="text-input"
        className={cn(TEXT_INPUT_CLASS, className)}
        {...props}
      />
    )
  },
)

export { Input, TextInput }
