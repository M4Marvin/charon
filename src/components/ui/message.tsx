import * as React from "react";

import { cn } from "#/lib/utils.ts";

function MessageGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-group"
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...props}
    />
  );
}

function Message({
  className,
  align = "start",
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn("group/message relative flex w-full min-w-0 flex-col text-sm", className)}
      {...props}
    />
  );
}

function MessageAvatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-avatar"
      className={cn(
        "flex w-fit min-w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn("flex w-full min-w-0 flex-col gap-2 wrap-break-word", className)}
      {...props}
    />
  );
}

function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        "flex max-w-full min-w-0 items-center justify-between gap-2 rounded-t-lg px-3 py-1 text-sm font-heading mt-4 text-muted-foreground group-data-[is-user=true]/message:bg-primary/40 group-data-[is-user=false]/message:bg-(--lagoon)/20 group-data-[is-user=true]/message:text-muted-foreground group-data-[is-user=false]/message:text-(--lagoon-deep)",
        className,
      )}
      {...props}
    />
  );
}

function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        "flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { MessageGroup, Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader };
