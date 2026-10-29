import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const alertVariants = cva("rounded-md border-l-4 p-4 text-sm", {
  variants: {
    variant: {
      success: "border-primary bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
      warning: "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
      error: "border-destructive bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
    },
  },
  defaultVariants: { variant: "error" },
})

// Inline message box. Errors are announced immediately; success and warning politely.
function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role={variant === "error" || variant == null ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Alert }
