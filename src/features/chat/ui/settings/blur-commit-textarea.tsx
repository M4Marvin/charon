import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { BookOpen, Maximize2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MAX_HEIGHT = 360;

interface BlurCommitTextareaProps {
  id: string;
  label: string;
  description?: string;
  placeholder?: string;
  defaultValue: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  className?: string;
  /**
   * The value this field inherits when empty (character-card overrides). When
   * provided, the field shows a Custom / Using card chip and an Original preview.
   */
  inheritedValue?: string | null;
  onUseCard?: () => void;
}

/**
 * Grows with its content, so the sheet has a single scroll surface and no text
 * is ever clipped mid-line. Commits on blur or Cmd/Ctrl+Enter; the panel footer
 * owns the save state.
 */
export function BlurCommitTextarea({
  id,
  label,
  description,
  placeholder,
  defaultValue,
  onCommit,
  disabled,
  className,
  inheritedValue,
  onUseCard,
}: BlurCommitTextareaProps) {
  const [value, setValue] = useState(defaultValue);
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const initialRef = useRef(defaultValue);
  const focusedRef = useRef(false);

  useLayoutEffect(() => {
    if (initialRef.current !== defaultValue) {
      initialRef.current = defaultValue;
      // Keep the user's draft when the server value changes underneath us
      // (for example a failed save rolled back).
      if (!focusedRef.current) setValue(defaultValue);
    }
  }, [defaultValue]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
    setOverflowing(el.scrollHeight > MAX_HEIGHT);
  }, [value]);

  const commit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed !== defaultValue.trim()) onCommit(trimmed);
  }, [value, defaultValue, onCommit]);

  const handleBlur = useCallback(() => {
    focusedRef.current = false;
    commit();
  }, [commit]);

  const isOverridden = inheritedValue !== undefined && value.trim() !== "";
  const inherited = inheritedValue?.trim() ?? "";
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <Field className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <FieldLabel htmlFor={id} className="text-[13px] font-medium text-1">
          {label}
        </FieldLabel>
        {inheritedValue !== undefined || overflowing ? (
          <div className="flex items-center gap-0.5">
            {inheritedValue !== undefined ? (
              <>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] leading-4 font-medium",
                    isOverridden
                      ? "border-brand/25 bg-brand/10 text-brand"
                      : "border-subtle bg-surface text-2",
                  )}
                >
                  {isOverridden ? "Custom" : "Using card"}
                </span>
                {isOverridden && onUseCard ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-8 px-2 text-xs text-2 hover:text-1"
                    onClick={onUseCard}
                  >
                    Use card
                  </Button>
                ) : null}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="h-8 gap-1 px-2 text-xs text-2 hover:text-1"
                    >
                      <BookOpen className="size-3" aria-hidden="true" />
                      Original
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[min(26rem,calc(100vw-2.5rem))] p-0">
                    <div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-2.5">
                      <p className="text-xs font-medium text-1">From the character card</p>
                      {isOverridden && onUseCard ? (
                        <button
                          type="button"
                          className="focus-ring rounded px-1 text-xs font-medium text-brand underline underline-offset-2"
                          onClick={onUseCard}
                        >
                          Use card
                        </button>
                      ) : null}
                    </div>
                    <div className="max-h-64 overflow-y-auto px-4 py-3 scrollbar-thin">
                      <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-2">
                        {inherited || "The character card has no value for this field."}
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            ) : null}
            {overflowing ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-8 gap-1 px-2 text-xs text-2 hover:text-1"
                onClick={() => setExpanded(true)}
              >
                <Maximize2 className="size-3" aria-hidden="true" />
                Expand
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {description ? (
        <p id={descriptionId} className="text-xs leading-relaxed text-2">
          {description}
        </p>
      ) : null}

      <Textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        aria-describedby={descriptionId}
        className="min-h-[88px] resize-none break-words"
      />

      <Dialog
        open={expanded}
        onOpenChange={(open) => {
          if (!open) {
            setExpanded(false);
            commit();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={18}
            className="max-h-[60vh] min-h-[45vh] resize-none"
            aria-label={`${label} (expanded)`}
          />
          <DialogFooter>
            <Button
              onClick={() => {
                setExpanded(false);
                commit();
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Field>
  );
}
