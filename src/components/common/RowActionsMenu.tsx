import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LucideIcon } from "lucide-react";

interface RowAction {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
}

interface RowActionsMenuProps {
  items: RowAction[];
  label: string;
  /** Optional visible trigger text. Icon-only triggers stay the default. */
  text?: string;
}

export function RowActionsMenu({ items, label, text }: RowActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={text ? "sm" : "icon"}
          className={text ? "h-10 gap-1.5 px-3" : "size-10"}
          aria-label={label}
        >
          <Ellipsis className="size-4" aria-hidden="true" />
          {text ? <span className="text-sm">{text}</span> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            onClick={item.onSelect}
            className={item.destructive ? "text-danger focus:text-danger" : undefined}
          >
            {item.icon ? <item.icon className="size-4" /> : null}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
