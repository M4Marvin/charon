import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ChipInputProps {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

export function ChipInput({ value, onChange, suggestions, placeholder }: ChipInputProps) {
  const [text, setText] = useState("");

  function commit(t: string) {
    const trimmed = t.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setText("");
      return;
    }
    onChange([...value, trimmed]);
    setText("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(text);
    } else if (e.key === "Backspace" && !text && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const visible = suggestions?.filter(
    (s) =>
      text.trim().length > 0 &&
      s.toLowerCase().includes(text.toLowerCase()) &&
      !value.includes(s),
  );

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((chip) => (
          <Badge key={chip} variant="secondary" className="gap-1 pr-1">
            {chip}
            <button
              type="button"
              onClick={() => onChange(value.filter((c) => c !== chip))}
              className="inline-flex size-4 items-center justify-center rounded-sm hover:bg-muted-foreground/20"
              aria-label={`Remove ${chip}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(text)}
          placeholder={value.length === 0 ? placeholder : undefined}
          className="min-w-[120px] flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
        />
      </div>
      {visible && visible.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {visible.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => commit(s)}
              className="text-brand hover:text-brand-strong cursor-pointer text-xs"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
