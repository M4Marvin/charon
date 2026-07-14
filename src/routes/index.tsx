import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, BookOpen, Puzzle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  component: LandingPage,
});

function LandingPage() {
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession()
      .then((session) => {
        setUserName(session?.user?.name ?? null);
      })
      .catch(() => {
        setUserName(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (userName) {
    return (
      <main className="mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-3 text-3xl font-semibold tracking-tight">Welcome back, {userName}</h1>
        <p className="text-muted-foreground mb-8 max-w-md text-sm">
          Jump back into your conversations or start a new one.
        </p>
        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link to="/chats">Go to Chats</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/chats/new">New Chat</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-16 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">st-v2</h1>
        <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg">
          A modern AI character chat platform. Import V2 character cards, configure lorebooks,
          connect any LLM provider, and have immersive conversations with branching narratives.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link to="/signup">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/signin">Sign In</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <f.icon className="mb-2 size-8 text-primary" />
              <CardTitle>{f.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm">{f.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
