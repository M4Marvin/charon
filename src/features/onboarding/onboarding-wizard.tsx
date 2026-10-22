import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { QuestionnaireItemDefinition } from "@shadcn/react/questionnaire";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire";
import { onboardingKeys, useCompleteOnboarding, useOnboardingStatus } from "@/hooks/useOnboarding";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { SkeletonForm } from "@/components/common/Skeletons";
import { ProviderStep } from "./provider-step";
import { PersonaStep } from "./persona-step";
import { CharacterStep } from "./character-step";

export function OnboardingWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: status, isLoading, isError, error, refetch } = useOnboardingStatus();
  const completeOnboarding = useCompleteOnboarding();

  const [item, setItem] = useState<string | null>(null);
  const [invalidItem, setInvalidItem] = useState<string | null>(null);

  const items = useMemo<QuestionnaireItemDefinition[]>(() => {
    if (!status) return [];
    return [
      ...(status.hasConfiguredProvider ? [] : [{ name: "provider", required: true }]),
      { name: "persona" },
      ...(status.hasCharacter ? [] : [{ name: "character", required: true }]),
      { name: "ready", required: true },
    ];
  }, [status]);

  const activeItem = item ?? items[0]?.name ?? null;

  const prevItems = useRef<QuestionnaireItemDefinition[]>([]);

  useEffect(() => {
    if (!items.length) return;
    if (item && items.some((i) => i.name === item)) {
      prevItems.current = items;
      return;
    }
    if (!item) {
      setItem(items[0]?.name ?? null);
      prevItems.current = items;
      return;
    }
    const prevIdx = prevItems.current.findIndex((i) => i.name === item);
    const next = items[prevIdx] ?? items[items.length - 1];
    prevItems.current = items;
    if (next) setItem(next.name);
  }, [items, item]);

  const refreshStatus = () => {
    setInvalidItem(null);
    void queryClient.invalidateQueries({ queryKey: onboardingKeys.status });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setInvalidItem(null);
    completeOnboarding.mutate(undefined, {
      onSuccess: () => {
        void navigate({ to: "/chat" });
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("provider")) {
          setItem("provider");
          setInvalidItem("provider");
        } else if (message.includes("character")) {
          setItem("character");
          setInvalidItem("character");
        } else {
          setInvalidItem("ready");
        }
      },
    });
  };

  if (isError) {
    return (
      <div className="py-16">
        <ErrorBanner
          message={
            error instanceof Error
              ? `We couldn’t check your setup. ${error.message}`
              : "We couldn’t check your setup."
          }
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (isLoading || !status) {
    return <SkeletonForm />;
  }

  const providerPending = activeItem === "provider" && !status.hasConfiguredProvider;

  return (
    <Questionnaire
      aria-label="Onboarding"
      items={items}
      item={activeItem}
      onItemChange={(name) => {
        setItem(name);
        setInvalidItem(null);
      }}
      onSubmit={handleSubmit}
    >
      <p className="text-2 text-xs font-medium">
        Step {Math.max(1, items.findIndex((entry) => entry.name === activeItem) + 1)} of{" "}
        {items.length}
      </p>

      {!status.hasConfiguredProvider ? (
        <QuestionnaireItem name="provider" required invalid={invalidItem === "provider"}>
          <QuestionnaireTitle>Connect an AI provider</QuestionnaireTitle>
          <QuestionnaireDescription>
            An AI provider is the service that powers your characters. Pick a preset, or point
            Charon at any OpenAI-compatible endpoint. A local model works too, and needs no key.
            Your key stays in your local database.
          </QuestionnaireDescription>
          <ProviderStep onCreated={refreshStatus} />
          <QuestionnaireError>Connect a provider to continue.</QuestionnaireError>
        </QuestionnaireItem>
      ) : null}

      <QuestionnaireItem name="persona">
        <QuestionnaireTitle>Who are you?</QuestionnaireTitle>
        <QuestionnaireDescription>
          Characters will use this name. A sentence about the part you play helps the model write
          for you. You can change it later in Settings.
        </QuestionnaireDescription>
        <PersonaStep />
        {/* This step has no required choice of its own. Register an implicit
            answer so the questionnaire’s Next action can advance; the visible
            action is the Save persona button. */}
        <QuestionnaireChoices className="hidden" aria-hidden="true">
          <QuestionnaireChoice value="continue" defaultChecked>
            Continue
          </QuestionnaireChoice>
        </QuestionnaireChoices>
      </QuestionnaireItem>

      {!status.hasCharacter ? (
        <QuestionnaireItem name="character" required invalid={invalidItem === "character"}>
          <QuestionnaireTitle>Get a character</QuestionnaireTitle>
          <QuestionnaireDescription>
            Characters come from PNG card files. You can import your own, or keep the ones already
            waiting for you.
          </QuestionnaireDescription>
          <CharacterStep hasCharacter={status.hasCharacter} onImported={refreshStatus} />
          <QuestionnaireChoices>
            <QuestionnaireChoice value="continue">Continue without importing</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError>Add a character to continue.</QuestionnaireError>
        </QuestionnaireItem>
      ) : null}

      <QuestionnaireItem name="ready" required invalid={invalidItem === "ready"}>
        <QuestionnaireTitle>You're all set</QuestionnaireTitle>
        <QuestionnaireDescription>
          {status.hasConfiguredProvider ? "Your AI provider is connected. " : ""}
          {status.hasCharacter ? "You have characters to talk to. " : ""}
          Click Start chatting to open your chat list.
        </QuestionnaireDescription>
        <QuestionnaireChoices>
          <QuestionnaireChoice value="finish">Start chatting</QuestionnaireChoice>
        </QuestionnaireChoices>
      </QuestionnaireItem>

      <QuestionnaireActions className="sticky bottom-0 z-10 -mx-4 border-t border-subtle bg-base/95 px-4 py-3 backdrop-blur-sm">
        <QuestionnairePrevious>Back</QuestionnairePrevious>
        <QuestionnaireNext disabled={providerPending}>Next</QuestionnaireNext>
        <QuestionnaireSubmit>Start chatting</QuestionnaireSubmit>
      </QuestionnaireActions>
    </Questionnaire>
  );
}
