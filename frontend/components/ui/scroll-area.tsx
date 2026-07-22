import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const scrollAreaVariants = cva("relative w-full h-full", {
  variants: {},
  defaultVariants: {},
});

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof scrollAreaVariants> {
  children?: React.ReactNode;
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "overflow-auto scrollbar-thin scrollbar-thumb-primary/40 scrollbar-track-transparent",
        scrollAreaVariants(className)
      )}
      {...props}
    >
      {props.children}
    </div>
  )
);
ScrollArea.displayName = "ScrollArea";