import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Bot, BookOpen, Puzzle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth.functions";

const features = [
  {
    icon: Bot,
    title: "Characters",
    description:
      "Import V2 character cards with full personality data, lorebooks, and alternate greetings.",
  },
  {
    icon: BookOpen,
    title: "Lorebooks",
    description:
      "Build world knowledge with per-entry activation rules, scan depth, and recursive context insertion.",
  },
  {
    icon: Puzzle,
    title: "AI Providers",
    description:
      "Connect any OpenAI-compatible endpoint — local Ollama, Anthropic, Gemini, or custom.",
  },
];

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getSession();
    if (session) throw redirect({ to: "/chat" });
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-20">
      <div className="mb-16 text-center">
        <h1 className="text-display mb-4">Charon</h1>
        <p className="text-2 mx-auto mb-8 max-w-2xl text-base">
          A modern AI character chat platform. Import V2 character cards, configure lorebooks,
          connect any LLM provider, and have immersive conversations with branching narratives.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link to="/signup">Get Started</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link to="/signin">Sign in</Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-6 text-center">
            <f.icon className="mx-auto mb-3 size-8 text-brand" />
            <h3 className="text-headline mb-1">{f.title}</h3>
            <p className="text-2 text-sm">{f.description}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
