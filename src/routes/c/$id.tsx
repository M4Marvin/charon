import { createFileRoute } from "@tanstack/react-router";
import { ChatPage } from "@/features/chat/ui/pages/chat-page";

export const Route = createFileRoute("/c/$id")({
  component: ChatPage,
});
