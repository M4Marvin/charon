import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";

import { Logo } from "@/components/common/Logo";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useOnboardingStatus } from "@/hooks/useOnboarding";
import { OnboardingWizard } from "./onboarding-wizard";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { data: status } = useOnboardingStatus();
  const isReRun = Boolean(status?.completed);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-8">
      <h1 className="sr-only">Set up Charon</h1>
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Logo className="size-7 shrink-0" />
          <span className="text-sm font-semibold tracking-tight">Charon</span>
        </div>
        <div className="shrink-0">
          {isReRun ? (
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/settings/preferences">
                <Settings className="size-3.5" aria-hidden="true" />
                Back to settings
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                void authClient.signOut({
                  fetchOptions: { onSuccess: () => void navigate({ to: "/" }) },
                });
              }}
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              Sign out
            </Button>
          )}
        </div>
      </div>
      <OnboardingWizard />
    </main>
  );
}
