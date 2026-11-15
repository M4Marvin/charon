import { createFileRoute } from "@tanstack/react-router";
import { ChatPage } from "@/features/chat/ui/pages/chat-page";

export const Route = createFileRoute("/chat/$id")({
  component: ChatPageRoute,
});

/**
 * Remount `ChatPage` per chat so per-chat local state (message selection, the
 * open selection-prompt dialog) resets on navigation instead of being synced
 * by effects. Drafts, panel state, and images live in the store and survive.
 */
function ChatPageRoute() {
  const { id } = Route.useParams();
  return <ChatPage key={id} />;
}
