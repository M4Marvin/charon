import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  backTo?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, backTo, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start gap-3">
      {backTo ? (
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="-ml-1 size-10 shrink-0 max-sm:size-11"
        >
          <Link to={backTo} aria-label="Back">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {title ? (
            <div className="min-w-0 flex-1">
              <h1 className="text-display break-words">{title}</h1>
              {subtitle ? (
                <p className="line-clamp-2 text-2 text-sm sm:line-clamp-none">{subtitle}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex-1" />
          )}
          {actions ? (
            <div
              className={cn(
                "flex flex-wrap items-center gap-2 sm:shrink-0",
                "[&_a]:h-10 [&_button]:h-10 max-sm:[&_a]:h-11 max-sm:[&_button]:h-11",
              )}
            >
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
