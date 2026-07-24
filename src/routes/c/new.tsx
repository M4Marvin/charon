import { createFileRoute } from "@tanstack/react-router";
import { NewChatPage } from "@/features/chat/ui/pages/new-chat-page";

export const Route = createFileRoute("/c/new")({
  component: NewChatPage,
});
