import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

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
        <Button asChild variant="ghost" size="icon" className="-ml-3 shrink-0">
          <Link to={backTo}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
      ) : null}
      {title ? (
        <div className="flex-1 min-w-0">
          <h1 className="text-display">{title}</h1>
          {subtitle ? <p className="text-2 text-sm">{subtitle}</p> : null}
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
