import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "./utils";

const ScrollArea = React.forwardRef<
    React.ElementRef<typeof ScrollAreaPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
    // The Root is `flex flex-col` so its single in-flow child (the Viewport)
    // becomes a flex item with a definite height. Without this, the Viewport's
    // `height: 100%` (`h-full`) resolves against the Root's `auto` height and
    // grows to fit content, defeating `overflow: scroll`. ScrollBar and Corner
    // are `position: absolute` (set by Radix) so they don't participate in
    // flex layout. Consumers must give the Root a bounded height — either an
    // explicit `h-*` / `max-h-*`, or `flex-1 min-h-0` inside a flex parent —
    // otherwise both Root and Viewport size to content as before.
    <ScrollAreaPrimitive.Root
        ref={ref}
        className={cn("relative flex flex-col overflow-hidden", className)}
        {...props}
    >
        <ScrollAreaPrimitive.Viewport className="min-h-0 w-full flex-1 rounded-[inherit]">
            {children}
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar />
        <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
    React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
    React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
        ref={ref}
        orientation={orientation}
        className={cn(
            "flex touch-none select-none transition-colors",
            orientation === "vertical" &&
            "h-full w-2.5 border-l border-l-transparent p-[1px]",
            orientation === "horizontal" &&
            "h-2.5 flex-col border-t border-t-transparent p-[1px]",
            className,
        )}
        {...props}
    >
        <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };