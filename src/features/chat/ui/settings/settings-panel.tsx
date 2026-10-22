import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Info,
  X,
  BookOpen,
  FileText,
  UserRoundCog,
  Wallpaper,
  Monitor,
  MessageSquare,
  Cpu,
  IdCard,
} from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useChatConfig } from "@/hooks/useChatConfig";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { SettingsNav } from "./settings-nav";
import { SettingsSaveProvider, SettingsSaveStatus } from "./save-status";
import { SettingsModeSwitch } from "./settings-mode-switch";
import { SettingsSectionPicker } from "./settings-section-picker";
import { getSectionsForMode, type SettingsMode, type SettingsSection } from "./settings-nav-model";
import { ModelSection } from "./sections/model-section";
import { PersonaSection } from "./sections/persona-section";
import { LorebooksSection } from "./sections/lorebooks-section";
import { PromptsSection } from "./sections/prompts-section";
import { CharacterSection } from "./sections/character-section";
import { BackgroundSection } from "./sections/background-section";
import { ChatDetailsSection } from "./sections/chat-details-section";
import { DisplaySection } from "./sections/display-section";

const SECTIONS: SettingsSection[] = [
  { id: "character", label: "Character", icon: UserRoundCog, scope: "chat" },
  { id: "background", label: "Background", icon: Wallpaper, scope: "chat" },
  { id: "chat-details", label: "Chat details", icon: MessageSquare, scope: "chat" },
  { id: "model", label: "Model & preset", icon: Cpu, scope: "global" },
  { id: "persona", label: "Your persona", icon: IdCard, scope: "global" },
  { id: "lorebooks", label: "Lorebooks", icon: BookOpen, scope: "global" },
  { id: "prompts", label: "Global prompts", icon: FileText, scope: "global" },
  { id: "display", label: "Display", icon: Monitor, scope: "browser" },
];

interface SettingsPanelProps {
  chatId: string;
  open: boolean;
  isStreaming: boolean;
  onOpenChange: (open: boolean) => void;
  characterName?: string;
  chatTitle?: string;
  characterAvatarSrc?: string | null;
  messageCount?: number;
  onOpenScenePanel?: () => void;
}

export function SettingsPanel({
  chatId,
  open,
  isStreaming,
  onOpenChange,
  characterName,
  chatTitle,
  characterAvatarSrc,
  messageCount,
  onOpenScenePanel,
}: SettingsPanelProps) {
  const { error: configError, refetch: refetchConfig } = useChatConfig(chatId);

  const [mode, setMode] = useState<SettingsMode>("chat");
  const [activeId, setActiveId] = useState("character");
  const [visited, setVisited] = useState<Set<string>>(() => new Set(["character"]));
  const contentRef = useRef<HTMLDivElement>(null);

  const sectionsForMode = useMemo(() => getSectionsForMode(SECTIONS, mode), [mode]);
  const activeSection =
    sectionsForMode.find((section) => section.id === activeId) ?? sectionsForMode[0] ?? SECTIONS[0];

  useEffect(() => {
    if (!sectionsForMode.some((section) => section.id === activeId)) {
      const first = sectionsForMode[0];
      if (first) setActiveId(first.id);
    }
  }, [activeId, sectionsForMode]);

  useEffect(() => {
    setVisited((prev) => (prev.has(activeId) ? prev : new Set(prev).add(activeId)));
    contentRef.current?.scrollTo({ top: 0 });
  }, [activeId]);

  const handleSectionChange = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const handleModeChange = useCallback(
    (next: SettingsMode) => {
      if (next === mode) return;
      const first = getSectionsForMode(SECTIONS, next)[0];
      setMode(next);
      if (first) setActiveId(first.id);
    },
    [mode],
  );

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);
  const handleOpenScene = useCallback(() => {
    onOpenChange(false);
    onOpenScenePanel?.();
  }, [onOpenChange, onOpenScenePanel]);

  const renderSection = (id: string) => {
    switch (id) {
      case "character":
        return <CharacterSection chatId={chatId} />;
      case "background":
        return (
          <BackgroundSection
            chatId={chatId}
            onOpenScenePanel={onOpenScenePanel ? handleOpenScene : undefined}
          />
        );
      case "chat-details":
        return (
          <ChatDetailsSection
            chatId={chatId}
            isStreaming={isStreaming}
            onClose={handleClose}
            messageCount={messageCount}
          />
        );
      case "model":
        return <ModelSection chatId={chatId} onClose={handleClose} />;
      case "persona":
        return <PersonaSection chatId={chatId} isStreaming={isStreaming} />;
      case "lorebooks":
        return <LorebooksSection chatId={chatId} isStreaming={isStreaming} />;
      case "prompts":
        return <PromptsSection chatId={chatId} isStreaming={isStreaming} />;
      case "display":
        return <DisplaySection chatId={chatId} isStreaming={isStreaming} />;
      default:
        return null;
    }
  };

  const displayTitle = chatTitle?.trim() || "This chat";
  const subtitle =
    characterName && characterName !== displayTitle
      ? `with ${characterName}`
      : "Settings for this chat";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex max-h-dvh w-full flex-col gap-0 overflow-hidden bg-(--bg-raised)/95 p-0 pb-[var(--keyboard-inset,0px)] shadow-[-32px_0_80px_-32px_rgba(0,0,0,0.8)] ring-1 ring-inset ring-(--border-subtle) duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[side=right]:w-full data-[side=right]:sm:max-w-[720px] data-[side=right]:sm:rounded-l-2xl data-[side=right]:xl:max-w-[780px]"
      >
        <SettingsSaveProvider activeSection={activeId}>
          <SheetHeader className="relative shrink-0 border-b border-subtle px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 pr-14">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-9 shrink-0" aria-hidden="true">
                <AvatarImage
                  src={characterAvatarSrc ?? undefined}
                  alt=""
                  className="object-cover"
                />
                <AvatarFallback className="text-sm text-brand">
                  {(characterName ?? "C").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-2">
                  Chat settings
                </p>
                <SheetTitle className="truncate font-heading text-[21px] leading-6 font-semibold text-1">
                  {displayTitle}
                </SheetTitle>
                <SheetDescription className="truncate text-xs text-2">{subtitle}</SheetDescription>
                <SettingsSaveStatus />
              </div>
            </div>
            <SheetClose
              render={
                <Button
                  variant="ghost"
                  className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-3 size-10 rounded-full text-2 hover:bg-(--bg-hover) hover:text-1 max-sm:size-11"
                  size="icon-sm"
                />
              }
            >
              <X />
              <span className="sr-only">Close</span>
            </SheetClose>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="grid shrink-0 grid-cols-2 items-center gap-2 border-b border-subtle px-4 py-3 lg:hidden">
              <SettingsModeSwitch mode={mode} onChange={handleModeChange} />
              <SettingsSectionPicker
                sections={sectionsForMode}
                activeId={activeId}
                onChange={handleSectionChange}
              />
            </div>

            <div className="hidden w-[13.5rem] shrink-0 flex-col border-r border-subtle lg:flex">
              <div className="px-3 pt-3">
                <SettingsModeSwitch mode={mode} onChange={handleModeChange} />
              </div>
              <SettingsNav
                sections={sectionsForMode}
                activeId={activeId}
                onChange={handleSectionChange}
                open={open}
              />
            </div>

            <div
              ref={contentRef}
              className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 scrollbar-thin sm:px-5 lg:px-7 lg:py-6"
            >
              <div className="mx-auto flex w-full max-w-[34rem] flex-col gap-5">
                <p className="sr-only" aria-live="polite" aria-atomic="true">
                  Showing {activeSection.label} settings
                </p>
                {isStreaming ? (
                  <div
                    role="status"
                    className="flex items-start gap-2 rounded-xl border border-subtle bg-surface px-3 py-2 text-xs text-2"
                  >
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    A reply is generating. Changes apply to your next reply.
                  </div>
                ) : null}
                {configError ? (
                  <ErrorBanner
                    message={
                      configError instanceof Error
                        ? configError.message
                        : "Failed to load chat config"
                    }
                    onRetry={() => void refetchConfig()}
                  />
                ) : null}
                <div
                  id="settings-panel"
                  role="region"
                  aria-label={`${activeSection.label} settings`}
                >
                  {SECTIONS.map((section) => {
                    if (!visited.has(section.id)) return null;
                    const active = section.id === activeId;
                    return (
                      <div key={section.id} hidden={!active}>
                        {renderSection(section.id)}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </SettingsSaveProvider>
      </SheetContent>
    </Sheet>
  );
}
