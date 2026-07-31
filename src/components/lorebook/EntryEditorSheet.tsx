import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field";
import { ChipInput } from "@/components/common/ChipInput";
import { useCreateLorebookEntry, useUpdateLorebookEntry } from "@/hooks/useLorebooks";
import { ApproxTokenCounter } from "@/lib/st-core/shared";
import type { LoreEntryListItem } from "@/server/fns/lorebooks";

const counter = new ApproxTokenCounter();

const entrySchema = z
  .object({
    comment: z.string(),
    keys: z.array(z.string()),
    secondary: z.array(z.string()),
    content: z.string().min(1, "Content is required."),
    order: z.string().refine(
      (v) => !Number.isNaN(Number.parseInt(v, 10)),
      "Order must be a number.",
    ),
    disable: z.boolean(),
    constant: z.boolean(),
  })
  .superRefine((val, ctx) => {
    if (!val.constant && val.keys.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["keys"],
        message: "At least one keyword is required (or set Constant).",
      });
    }
  });

type Props =
  | { lorebookId: string; mode: "create"; onClose: () => void }
  | { lorebookId: string; mode: "edit"; entry: LoreEntryListItem; onClose: () => void };

export function EntryEditorSheet(props: Props) {
  const { lorebookId, mode, onClose } = props;
  const initial = props.mode === "edit" ? props.entry : null;

  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useCreateLorebookEntry(lorebookId);
  const updateMutation = useUpdateLorebookEntry(lorebookId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm({
    defaultValues: {
      comment: initial?.data.comment ?? "",
      keys: (initial?.data.key ?? []) as string[],
      secondary: (initial?.data.keysecondary ?? []) as string[],
      content: initial?.data.content ?? "",
      order: String(initial?.data.order ?? 100),
      disable: initial?.data.disable ?? false,
      constant: initial?.data.constant ?? false,
    },
    validators: { onSubmit: entrySchema },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const orderNum = Number.parseInt(value.order, 10);
      try {
        if (mode === "create") {
          await createMutation.mutateAsync({
            comment: value.comment.trim(),
            content: value.content.trim(),
            key: value.keys,
            keysecondary: value.secondary,
            order: orderNum,
            disable: value.disable,
            constant: value.constant,
          });
        } else {
          await updateMutation.mutateAsync({
            entryId: initial!.id,
            uid: initial!.uid,
            data: {
              ...initial!.data,
              comment: value.comment.trim(),
              content: value.content.trim(),
              key: value.keys,
              keysecondary: value.secondary,
              order: orderNum,
              disable: value.disable,
              constant: value.constant,
            },
          });
        }
        onClose();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Failed to save entry");
      }
    },
  });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{mode === "create" ? "New Entry" : "Edit Entry"}</SheetTitle>
          <SheetDescription>
            Keywords activate the entry. Content is injected into the prompt when matched.
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-4 mt-4"
        >
          <form.Field
            name="comment"
            children={(field) => (
              <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
                <FieldLabel htmlFor="entry-comment">Comment</FieldLabel>
                <Input
                  id="entry-comment"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Short description for the author"
                  disabled={isPending}
                />
              </Field>
            )}
          />
          <form.Field
            name="keys"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="entry-keys">Keywords</FieldLabel>
                  <ChipInput
                    id="entry-keys"
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    placeholder="dragon, wyrm, drake"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />
          <form.Field
            name="secondary"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="entry-secondary">Secondary keys</FieldLabel>
                  <ChipInput
                    id="entry-secondary"
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    placeholder="fire, scales"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />
          <form.Field
            name="content"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="entry-content">Content</FieldLabel>
                  <Textarea
                    id="entry-content"
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="The lore text injected into the prompt..."
                    rows={6}
                    disabled={isPending}
                    aria-invalid={isInvalid}
                  />
                  <p className="text-3 text-xs text-right">~{counter.count(field.state.value)} tokens</p>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />
          <div className="grid grid-cols-2 gap-4">
            <form.Field
              name="order"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="entry-order">Order</FieldLabel>
                    <Input
                      id="entry-order"
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={isPending}
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />
            <div className="space-y-2 pt-6">
              <form.Field
                name="constant"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field orientation="horizontal" data-invalid={isInvalid} className="gap-2">
                      <FieldContent>
                        <FieldLabel htmlFor="entry-constant">Constant (always active)</FieldLabel>
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </FieldContent>
                      <Switch
                        id="entry-constant"
                        name={field.name}
                        checked={field.state.value}
                        onCheckedChange={field.handleChange}
                        disabled={isPending}
                        aria-invalid={isInvalid}
                      />
                    </Field>
                  );
                }}
              />
              <form.Field
                name="disable"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field orientation="horizontal" data-invalid={isInvalid} className="gap-2">
                      <FieldContent>
                        <FieldLabel htmlFor="entry-disable">Disabled</FieldLabel>
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </FieldContent>
                      <Switch
                        id="entry-disable"
                        name={field.name}
                        checked={field.state.value}
                        onCheckedChange={field.handleChange}
                        disabled={isPending}
                        aria-invalid={isInvalid}
                      />
                    </Field>
                  );
                }}
              />
            </div>
          </div>
          {submitError ? (
            <p role="alert" className="text-danger text-sm">
              {submitError}
            </p>
          ) : null}
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
