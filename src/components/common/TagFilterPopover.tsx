import { useMemo, useState } from "react";
import { Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface TagFilterPopoverProps {
  tags: { name: string; count: number }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function TagFilterPopover({ tags, selected, onChange }: TagFilterPopoverProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return tags;
    const q = search.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, search]);

  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Filter className="size-3.5" data-icon="inline-start" />
          Tags
          {selected.length > 0 ? (
            <Badge variant="secondary" className="ml-1 h-5 px-1 py-0 text-[10px]">
              {selected.length}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="border-b px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-7 text-xs"
              placeholder="Filter tags..."
              aria-label="Filter tags"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="max-h-64 overflow-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No tags found</p>
          ) : (
            filtered.map((t) => (
              <label
                key={t.name}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
              >
                <Checkbox
                  checked={selected.includes(t.name)}
                  onCheckedChange={() => toggle(t.name)}
                />
                <span className="flex-1 text-sm">{t.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {t.count}
                </span>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
