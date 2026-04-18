import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input/90 placeholder:text-muted-foreground bg-input/55 focus-visible:border-ring focus-visible:ring-ring/35 aria-invalid:ring-destructive/30 aria-invalid:border-destructive flex min-h-20 w-full rounded-lg border px-3 py-2 text-sm shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] outline-none transition-[border-color,box-shadow,background-color] focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
