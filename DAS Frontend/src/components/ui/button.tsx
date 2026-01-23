import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "select-none inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-base font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // iOS-style variants
        default: "bg-primary text-primary-foreground shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200",
        outline: "border border-input bg-background hover:bg-muted text-foreground shadow-sm active:scale-[0.98] transition-all duration-200",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200",
        ghost: "hover:bg-muted text-foreground active:scale-[0.98] transition-all duration-200",
        link: "text-primary underline-offset-4 hover:underline",
        hero: "bg-gradient-hero text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-300",
        glass: "glass text-foreground backdrop-blur-md hover:backdrop-blur-lg active:scale-[0.98] transition-all duration-200",
        accent: "bg-accent text-accent-foreground shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200",
        premium: "bg-gradient-primary text-primary-foreground shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-300 border border-primary/20",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-full px-4 py-2 text-sm",
        lg: "h-13 rounded-full px-8 text-lg",
        xl: "h-15 rounded-full px-10 text-xl font-bold",
        icon: "h-11 w-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };