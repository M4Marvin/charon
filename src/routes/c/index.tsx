import { createFileRoute } from "@tanstack/react-router";
import { ChatListPage } from "@/features/chat/ui/pages/chat-list-page";

export const Route = createFileRoute("/c/")({
  component: ChatListPage,
});
