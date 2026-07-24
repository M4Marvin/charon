import { useCallback } from "react";
import { substituteMessageMacros } from "@/lib/chat/substitute-message-macros";
import type { ChatConfig } from "@/features/chat/config/types";

export function useChatMacros(config: ChatConfig | undefined) {
  return useCallback(
    (text: string) => {
      if (!config || !text) return text;
      return substituteMessageMacros(text, {
        char: config.character.name,
        user: config.persona.name,
      });
    },
    [config?.character.name, config?.persona.name],
  );
}
