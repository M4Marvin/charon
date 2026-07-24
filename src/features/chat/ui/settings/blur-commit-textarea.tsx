import { useLayoutEffect, useRef, useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const MAX_HEIGHT = 200;

interface BlurCommitTextareaProps {
  id: string;
  label: string;
  placeholder?: string;
  defaultValue: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function BlurCommitTextarea({
  id,
  label,
  placeholder,
  defaultValue,
  onCommit,
  disabled,
  className,
}: BlurCommitTextareaProps) {
  const [value, setValue] = useState(defaultValue);
  const ref = useRef<HTMLTextAreaElement>(null);
  const initialRef = useRef(defaultValue);

  useLayoutEffect(() => {
    if (initialRef.current !== defaultValue) {
      initialRef.current = defaultValue;
      setValue(defaultValue);
    }
  }, [defaultValue]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const handleBlur = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed !== defaultValue.trim()) {
      onCommit(trimmed);
    }
  }, [value, defaultValue, onCommit]);

  return (
    <Field className={cn("space-y-1.5", className)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="min-h-[60px] resize-none"
        style={{ maxHeight: MAX_HEIGHT }}
      />
    </Field>
  );
}
