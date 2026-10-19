import { useState, useCallback } from "react";
import {
  Zap,
  User,
  BookOpen,
  FileText,
  UserRoundCog,
  Image,
  Monitor,
  MessageSquare,
  Info,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useChatConfig } from "@/hooks/useChatConfig";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { SettingsNav } from "./settings-nav";
import { SettingsSectionPicker } from "./settings-section-picker";
import type { SettingsSection } from "./settings-nav-model";
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
  { id: "background", label: "Background", icon: Image, scope: "chat" },
  { id: "chat-details", label: "Chat details", icon: MessageSquare, scope: "chat" },
  { id: "model", label: "Model & preset", icon: Zap, scope: "global" },
  { id: "persona", label: "Your persona", icon: User, scope: "global" },
  { id: "lorebooks", label: "Lorebooks", icon: BookOpen, scope: "global" },
  { id: "prompts", label: "Global prompts", icon: FileText, scope: "global" },
  { id: "display", label: "Display", icon: Monitor, scope: "browser" },
];

interface SettingsPanelProps {
  chatId: string;
  open: boolean;
  isStreaming: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsPanel({ chatId, open, isStreaming, onOpenChange }: SettingsPanelProps) {
  const { error: configError, refetch: refetchConfig } = useChatConfig(chatId);

  const [activeId, setActiveId] = useState("character");

  const handleSectionChange = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);
  const sectionProps = { chatId, isStreaming, onClose: handleClose };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full data-[side=right]:w-full data-[side=right]:sm:max-w-2xl glass-strong flex flex-col gap-0 p-0"
      >
        <SheetHeader className="px-5 pr-14 pt-5 pb-3 border-b border-subtle">
          <SheetTitle className="font-heading text-1">Chat settings</SheetTitle>
          <SheetDescription className="text-xs">
            Settings for this chat and its defaults. Changes save automatically.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          <div className="border-b border-subtle px-4 py-3 md:hidden">
            <SettingsSectionPicker
              sections={SECTIONS}
              activeId={activeId}
              onChange={handleSectionChange}
            />
          </div>
          <SettingsNav sections={SECTIONS} activeId={activeId} onChange={handleSectionChange} />

          <div className="flex-1 min-w-0 overflow-y-auto px-5 py-5 scrollbar-thin scroll-fade-b">
            {isStreaming ? (
              <div
                role="status"
                className="mb-4 flex items-start gap-2 rounded-lg border border-subtle bg-surface px-3 py-2 text-xs text-2"
              >
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                A reply is generating. Changes apply to your next reply.
              </div>
            ) : null}
            {configError ? (
              <div className="mb-4">
                <ErrorBanner
                  message={
                    configError instanceof Error
                      ? configError.message
                      : "Failed to load chat config"
                  }
                  onRetry={() => void refetchConfig()}
                />
              </div>
            ) : null}
            <div key={activeId} className="section-switch">
              {activeId === "character" && <CharacterSection {...sectionProps} />}
              {activeId === "background" && <BackgroundSection {...sectionProps} />}
              {activeId === "chat-details" && <ChatDetailsSection {...sectionProps} />}
              {activeId === "model" && <ModelSection {...sectionProps} />}
              {activeId === "persona" && <PersonaSection {...sectionProps} />}
              {activeId === "lorebooks" && <LorebooksSection {...sectionProps} />}
              {activeId === "prompts" && <PromptsSection {...sectionProps} />}
              {activeId === "display" && <DisplaySection {...sectionProps} />}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
