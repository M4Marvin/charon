import { useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Zap,
  User,
  BookOpen,
  FileText,
  UserRoundCog,
  Image,
  Monitor,
  Server,
  SlidersHorizontal,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useChatConfig } from "@/hooks/useChatConfig";
import { useDeleteChat } from "@/hooks/useChats";
import { authClient } from "@/lib/auth-client";
import { SettingsNav } from "./settings-nav";
import type { SettingsSection } from "./settings-nav-model";
import { ConfirmDialog } from "./confirm-dialog";
import { ConnectionSection } from "./sections/connection-section";
import { ProviderSection } from "./sections/provider-section";
import { PresetSection } from "./sections/preset-section";
import { PersonaSection } from "./sections/persona-section";
import { LorebooksSection } from "./sections/lorebooks-section";
import { PromptsSection } from "./sections/prompts-section";
import { CharacterSection } from "./sections/character-section";
import { SceneSection } from "./sections/scene-section";
import { DisplaySection } from "./sections/display-section";

const SECTIONS: SettingsSection[] = [
  { id: "connection", label: "Connection", icon: Zap, adminOnly: true, group: "connection" },
  { id: "providers", label: "Providers", icon: Server, adminOnly: true, group: "connection", secondary: true },
  { id: "presets", label: "Presets", icon: SlidersHorizontal, adminOnly: true, group: "connection", secondary: true },
  { id: "persona", label: "Persona", icon: User, group: "chat" },
  { id: "lorebooks", label: "Lorebooks", icon: BookOpen, group: "chat" },
  { id: "prompts", label: "Prompts", icon: FileText, group: "chat" },
  { id: "character", label: "Character", icon: UserRoundCog, group: "chat" },
  { id: "scene", label: "Scene", icon: Image, group: "chat" },
  { id: "display", label: "Display", icon: Monitor, group: "display" },
];

interface SettingsPanelProps {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsPanel({ chatId, open, onOpenChange }: SettingsPanelProps) {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const { data: config } = useChatConfig(chatId);
  const deleteChat = useDeleteChat();

  const isAdmin = session?.user?.role === "admin";
  const isStreaming = config?.chat.lockState === "generating";
  const firstVisibleId = SECTIONS.find((s) => !s.adminOnly || isAdmin)?.id ?? "persona";

  const [activeId, setActiveId] = useState(firstVisibleId);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = useCallback(() => {
    deleteChat.mutate(
      { id: chatId },
      {
        onSuccess: () => {
          navigate({ to: "/chat" });
        },
      },
    );
  }, [chatId, deleteChat, navigate]);

  const handleSectionChange = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const sectionProps = { chatId, isStreaming, isAdmin, onNavigate: handleSectionChange };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full data-[side=right]:w-full data-[side=right]:sm:max-w-2xl glass-strong flex flex-col gap-0 p-0"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-white/5">
            <SheetTitle className="font-heading text-[--sea-ink]">Chat Settings</SheetTitle>
            <SheetDescription className="text-xs">
              Configure AI, persona, prompts, and appearance.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 min-h-0">
            <SettingsNav sections={SECTIONS} activeId={activeId} onChange={handleSectionChange} />

            <div className="flex-1 min-w-0 overflow-y-auto px-5 py-5 scrollbar-thin scroll-fade-b">
              <div key={activeId} className="section-switch">
                {activeId === "connection" && isAdmin && <ConnectionSection {...sectionProps} />}
                {activeId === "providers" && isAdmin && <ProviderSection {...sectionProps} />}
                {activeId === "presets" && isAdmin && <PresetSection {...sectionProps} />}
                {activeId === "persona" && <PersonaSection {...sectionProps} />}
                {activeId === "lorebooks" && <LorebooksSection {...sectionProps} />}
                {activeId === "prompts" && <PromptsSection {...sectionProps} />}
                {activeId === "character" && <CharacterSection {...sectionProps} />}
                {activeId === "scene" && <SceneSection {...sectionProps} />}
                {activeId === "display" && <DisplaySection {...sectionProps} />}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center px-5 py-3 border-t border-white/5">
            <button
              type="button"
              className="rounded px-1 py-0.5 text-xs text-3 transition-colors hover:text-danger focus-ring"
              onClick={() => setDeleteOpen(true)}
            >
              Delete this chat
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete chat?"
        description="This permanently deletes the chat and all its messages. This cannot be undone."
        onConfirm={handleDelete}
      />
    </>
  );
}
