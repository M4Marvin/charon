import { useCallback, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { authClient } from "@/lib/auth-client";

const signinSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const Route = createFileRoute("/signin")({
  component: SigninPage,
});

function SigninPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const form = useForm({
    defaultValues: { username: "", password: "" },
    validators: { onSubmit: signinSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = await authClient.signIn.username({
        username: value.username,
        password: value.password,
      });
      if (result.error) {
        setError(result.error.message || result.error.statusText || "Sign in failed");
        toast.error(result.error.message || "Sign in failed");
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
          <h2 className="text-title mb-6">Sign in to your account</h2>

          {error ? <ErrorBanner message={error} /> : null}

          <form onSubmit={handleSubmit}>
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
                        placeholder="demo"
                        autoComplete="username"
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />
              <form.Field
                name="password"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
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
                          autoComplete="current-password"
                          aria-invalid={isInvalid}
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
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />
              <form.Subscribe
                selector={(state) => ({ isSubmitting: state.isSubmitting })}
                children={({ isSubmitting }) => (
                  <Field>
                    <Button type="submit" disabled={isSubmitting} className="w-full">
                      {isSubmitting ? "Signing in..." : "Sign In"}
                    </Button>
                    <p className="text-center text-sm text-2">
                      Don&apos;t have an account?{" "}
                      <Link
                        to="/signup"
                        className="text-brand hover:text-brand-strong underline underline-offset-4"
                      >
                        Sign up
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
