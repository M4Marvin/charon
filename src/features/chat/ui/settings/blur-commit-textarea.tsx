import { useLayoutEffect, useRef, useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { SaveStatus, type SaveState } from "./save-status";

const MAX_HEIGHT = 320;

interface BlurCommitTextareaProps {
  id: string;
  label: string;
  description?: string;
  placeholder?: string;
  defaultValue: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  className?: string;
  status?: SaveState;
  error?: unknown;
  onRetry?: () => void;
  onReset?: () => void;
  onRevert?: () => void;
  resetLabel?: string;
  original?: string | null;
}

export function BlurCommitTextarea({
  id,
  label,
  description,
  placeholder,
  defaultValue,
  onCommit,
  disabled,
  className,
  status,
  error,
  onRetry,
  onReset,
  onRevert,
  resetLabel = "Reset",
  original,
}: BlurCommitTextareaProps) {
  const [value, setValue] = useState(defaultValue);
  const ref = useRef<HTMLTextAreaElement>(null);
  const initialRef = useRef(defaultValue);
  const focusedRef = useRef(false);

  useLayoutEffect(() => {
    if (initialRef.current !== defaultValue) {
      initialRef.current = defaultValue;
      // Keep the draft on a failed save so the user can retry instead of losing text.
      if (!focusedRef.current && status !== "error") setValue(defaultValue);
    }
  }, [defaultValue, status]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const dirty = value.trim() !== defaultValue.trim();

  const commit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed !== defaultValue.trim()) onCommit(trimmed);
  }, [value, defaultValue, onCommit]);

  const handleBlur = useCallback(() => {
    focusedRef.current = false;
    commit();
  }, [commit]);

  const handleReset = useCallback(() => {
    if (onReset) {
      setValue("");
      onReset();
      return;
    }
    setValue(defaultValue);
  }, [onReset, defaultValue]);

  return (
    <Field className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {dirty ? <span className="text-[11px] text-2">Unsaved</span> : null}
      </div>
      {description ? <p className="text-[13px] text-2">{description}</p> : null}
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
        className="min-h-[60px] resize-none scrollbar-thin"
        style={{ maxHeight: MAX_HEIGHT }}
      />
      <div className="flex min-h-4 flex-wrap items-center gap-3">
        {dirty && (status === "saving" || status === "error") ? (
          <SaveStatus state={status} error={error} onRetry={onRetry} />
        ) : null}
        {dirty ? (
          <button
            type="button"
            className="text-xs text-2 underline underline-offset-2 transition-colors hover:text-1 focus-ring"
            onClick={() => {
              setValue(defaultValue);
              onRevert?.();
            }}
          >
            Revert
          </button>
        ) : null}
        {onReset && defaultValue.trim() ? (
          <button
            type="button"
            className="text-xs text-2 underline underline-offset-2 transition-colors hover:text-1 focus-ring"
            onClick={handleReset}
          >
            {resetLabel}
          </button>
        ) : null}
      </div>
      {original ? (
        <details className="text-xs text-2">
          <summary className="w-fit cursor-pointer select-none rounded focus-ring">
            Show character card original
          </summary>
          <p className="mt-1 whitespace-pre-wrap break-words rounded-lg border border-subtle bg-surface p-2">
            {original}
          </p>
        </details>
      ) : null}
    </Field>
  );
}
