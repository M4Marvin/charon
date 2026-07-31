import { useCallback, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Eye, EyeOff, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { authClient } from "@/lib/auth-client";

const signupSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const form = useForm({
    defaultValues: { username: "", password: "", confirmPassword: "" },
    validators: { onSubmit: signupSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = await authClient.signUp.email({
        email: `${value.username}@demo.local`,
        password: value.password,
        name: value.username,
        username: value.username,
      });
      if (result.error) {
        setError(result.error.message || "Sign up failed");
        toast.error(result.error.message || "Sign up failed");
        return;
      }
      await navigate({ to: "/chat" });
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      e.stopPropagation();
      void form.handleSubmit();
    },
    [form],
  );

  return (
    <div className="grid lg:grid-cols-[45%_55%] min-h-svh">
      <div className="hidden lg:flex flex-col justify-center bg-surface px-12">
        <div>
          <h1 className="font-heading text-3xl text-brand-strong mb-2">Charon</h1>
          <p className="text-2 text-sm max-w-xs">
            AI character chat with branching narratives, world lore, and full V2 card support.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="text-2 hover:text-1 text-sm mb-6 inline-block">
            ← Back to home
          </Link>
          <h2 className="text-title mb-6">Create an account</h2>

          {error ? <ErrorBanner message={error} /> : null}

          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <form.Field
                name="username"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        type="text"
                        placeholder="your_username"
                        autoComplete="username"
                        minLength={3}
                        aria-invalid={isInvalid}
                        aria-describedby="username-error"
                      />
                      {isInvalid && <FieldError id="username-error" errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />
              <form.Field
                name="password"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  const pwLen = field.state.value.length;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                      <div className="relative">
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          type={showPw ? "text" : "password"}
                          autoComplete="new-password"
                          minLength={8}
                          aria-invalid={isInvalid}
                          aria-describedby="password-error"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(!showPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-2 hover:text-1"
                          aria-label={showPw ? "Hide password" : "Show password"}
                        >
                          {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div
                          className={`flex items-center gap-1.5 text-xs ${pwLen >= 8 ? "text-success" : "text-2"}`}
                        >
                          {pwLen >= 8 ? (
                            <Check className="size-3" />
                          ) : (
                            <span className="ml-4">—</span>
                          )}
                          At least 8 characters
                        </div>
                      </div>
                      {isInvalid && <FieldError id="password-error" errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />
              <form.Field
                name="confirmPassword"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Confirm Password</FieldLabel>
                      <div className="relative">
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          type={showPw ? "text" : "password"}
                          autoComplete="new-password"
                          minLength={8}
                          aria-invalid={isInvalid}
                          aria-describedby="confirm-password-error"
                          className="pr-10"
                        />
                      </div>
                      {isInvalid && <FieldError id="confirm-password-error" errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />
              <form.Subscribe
                selector={(state) => ({ isSubmitting: state.isSubmitting })}
                children={({ isSubmitting }) => (
                  <Field>
                    <Button type="submit" disabled={isSubmitting} className="w-full">
                      {isSubmitting ? "Creating account..." : "Create Account"}
                    </Button>
                    <p className="text-center text-sm text-2">
                      Already have an account?{" "}
                      <Link
                        to="/signin"
                        className="text-brand hover:text-brand-strong underline underline-offset-4"
                      >
                        Sign in
                      </Link>
                    </p>
                  </Field>
                )}
              />
            </FieldGroup>
          </form>
        </div>
      </div>
    </div>
  );
}
