import { ProviderManager } from "@/components/ai/ProviderManager";
import { SectionHeader } from "../section-header";

interface SectionProps {
  chatId: string;
  isStreaming: boolean;
  isAdmin: boolean;
  onNavigate: (sectionId: string) => void;
}

export function ProviderSection(_props: SectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title="Providers" description="API endpoints — shared across all chats." />
      <ProviderManager variant="sheet" />
    </div>
  );
}
