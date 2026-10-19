import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  FileImage,
  GitBranch,
  HardDrive,
  Image as ImageIcon,
  Lock,
  MonitorSmartphone,
  Plug,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Logo } from "@/components/common/Logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSession } from "@/lib/auth.functions";
import { getSetupRequired } from "@/server/fns/setup";

const GITHUB = "https://github.com/M4Marvin/charon";
const SITE_URL =
  (typeof process !== "undefined" && process.env.APP_URL) || "https://chat.m4marvin.com";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const [session, setup] = await Promise.all([getSession(), getSetupRequired()]);
    if (session) throw redirect({ to: "/chat" });
    return { needsSetup: setup.needsSetup };
  },
  head: () => ({
    meta: [
      { title: "Charon — a private home for your AI characters" },
      {
        name: "description",
        content:
          "A self-hosted chat app for stories and roleplay. Import character cards, bring your own model, and keep every branching conversation on your own computer.",
      },
      { property: "og:title", content: "Charon — a private home for your AI characters" },
      {
        property: "og:description",
        content:
          "Self-hosted AI character chat with branching conversations. Your cards, your model, your machine.",
      },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: `${SITE_URL}/og.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Charon — a private home for your AI characters" },
      {
        name: "twitter:description",
        content:
          "Self-hosted AI character chat with branching conversations. Your cards, your model, your machine.",
      },
      { name: "twitter:image", content: `${SITE_URL}/og.png` },
    ],
  }),
  component: LandingPage,
});

const INSTALL_METHODS = [
  {
    id: "unix",
    label: "macOS & Linux",
    terminal: "Open Terminal",
    prerequisite: "Nothing to install first.",
    command:
      "curl -fsSL https://github.com/M4Marvin/charon/releases/latest/download/install.sh | sh",
    note: "No administrator rights. The installer checks the download and keeps everything in one folder.",
    installer: true,
    script: "install.sh",
  },
  {
    id: "windows",
    label: "Windows",
    terminal: "Open PowerShell",
    prerequisite: "Nothing to install first.",
    command: "irm https://github.com/M4Marvin/charon/releases/latest/download/install.ps1 | iex",
    note: "No administrator rights. The installer checks the download and keeps everything in one folder.",
    installer: true,
    script: "install.ps1",
  },
  {
    id: "docker",
    label: "Docker",
    terminal: "Open a terminal",
    prerequisite: "Docker Desktop or Docker Engine. Builds locally.",
    command:
      "git clone https://github.com/M4Marvin/charon.git charon && cd charon && docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build",
    note: "The prebuilt GHCR image is pending; this builds from source. Secrets and data are generated in the charon-data volume.",
    installer: false,
    script: null,
  },
] as const;

const TRUST = ["No cloud account", "No subscription", "No telemetry", "Works with Ollama"];

const FEATURES = [
  {
    icon: FileImage,
    title: "Import the cards you already own",
    body: "Drag in a V2 or V3 PNG card. Portrait, personality, greetings, tags, and embedded lorebooks come across.",
  },
  {
    icon: BookOpen,
    title: "Lorebooks that remember your world",
    body: "Keyword-triggered entries give the model the right history at the right moment. Import a SillyTavern world-info file or write your own.",
  },
  {
    icon: Plug,
    title: "Your model, your key",
    body: "OpenAI, OpenRouter, Anthropic through a proxy, or a model running on your own machine with Ollama.",
  },
  {
    icon: UserRound,
    title: "Personas and presets",
    body: "Play as yourself or someone else. Save the settings that make a scene work, and switch moods without editing a file.",
  },
  {
    icon: ImageIcon,
    title: "Scenes and portraits",
    body: "Put a backdrop behind the conversation and a portrait beside it. Your images stay on your disk.",
  },
  {
    icon: MonitorSmartphone,
    title: "On every screen you own",
    body: "Charon is a web app. Open it on your laptop, desktop, or phone and the same library is there.",
  },
];

const FAQ = [
  {
    q: "Do I need to be technical?",
    a: "The install is one command. After that, setup happens in the browser: account, provider, character, chat. There are no config files to edit for normal use. A desktop app with no terminal at all is next.",
  },
  {
    q: "Does it cost anything?",
    a: "Charon is free and open source. You pay your AI provider directly, or nothing if you run a model on your own machine. No subscription, no seats, nothing to unlock.",
  },
  {
    q: "Do I need an API key?",
    a: "For real replies, yes. Charon connects to a provider instead of bundling a model. Use a key from OpenAI or OpenRouter, or point it at Ollama or LM Studio on your own machine.",
  },
  {
    q: "Which models work?",
    a: "Anything that speaks the OpenAI chat-completions API: OpenAI, OpenRouter, vLLM, LM Studio, Ollama, and Anthropic through a proxy. If it has a base URL, Charon can probably talk to it.",
  },
  {
    q: "Can I import my SillyTavern or Chub characters?",
    a: "Yes. Charon reads V2 and V3 PNG cards, keeps the portrait and greetings, and extracts an embedded lorebook into one you can edit.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. Run Charon on a computer, publish the port, and open that address from your phone's browser on the same network. One library, one account.",
  },
  {
    q: "Is this NSFW?",
    a: 'No. Charon is built and presented for stories and roleplay: SFW starter characters, no adult content bundled, and no "unfiltered" marketing. Because it is your machine and your model, what you import is your choice — but if you are looking for an adult platform, this is not one.',
  },
  {
    q: "Where do my chats live?",
    a: "In one SQLite database and an uploads folder on the machine running Charon. Copy that folder to back everything up. Nothing is stored anywhere else.",
  },
  {
    q: "Something is broken. What do I check?",
    a: "Run charon doctor in a terminal. It checks Node, the app files, the data folder, and the health endpoint, and names what failed. charon logs shows the server log. The troubleshooting guide covers the common cases.",
  },
] as const;

function LandingPage() {
  const { needsSetup } = Route.useRouteContext();
  if (needsSetup) return <FirstRun />;
  return <Marketing />;
}

function FirstRun() {
  return (
    <div className="min-h-svh bg-base">
      <SkipLink />
      <LandingNav minimal />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex max-w-[720px] flex-col px-5 py-20 sm:py-28"
      >
        <p className="mb-4 text-xs font-semibold tracking-[0.14em] text-brand uppercase">
          First run
        </p>
        <h1 className="text-display mb-5 text-5xl leading-[1.02] tracking-tight text-1 sm:text-6xl">
          Welcome to Charon.
        </h1>
        <p className="text-2 mb-8 max-w-xl text-lg leading-relaxed">
          You are a few minutes from your first conversation. Create a local account — no email,
          nothing to verify — and the setup wizard walks you through the rest.
        </p>
        <ol className="mb-10 grid gap-4">
          {["Create your account", "Connect an AI provider", "Pick a character and say hello"].map(
            (step, index) => (
              <li key={step} className="flex items-center gap-3 text-sm text-1">
                <span className="grid size-7 place-items-center rounded-full border border-brand/40 bg-brand/10 text-xs font-semibold text-brand">
                  {index + 1}
                </span>
                {step}
              </li>
            ),
          )}
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild className="h-11 px-6 text-sm">
            <Link to="/setup">
              Create your account <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <details className="group mt-12 rounded-2xl border border-border bg-surface p-5 text-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-1 [&::-webkit-details-marker]:hidden">
            What is Charon?
            <span className="text-2 transition-transform group-open:rotate-45" aria-hidden="true">
              +
            </span>
          </summary>
          <p className="text-2 mt-3 leading-relaxed">
            Charon is a chat app for stories and roleplay that runs on your own computer. Every
            swipe creates a branch, so no reply is ever overwritten. Your cards, chats, and keys
            stay in one local database.
          </p>
        </details>
      </main>
    </div>
  );
}

function Marketing() {
  return (
    <div className="min-h-svh bg-base">
      <SkipLink />
      <LandingNav />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Tour />
        <Branch />
        <Features />
        <Privacy />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}

function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-lg bg-surface px-3 py-2 text-sm text-1 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:outline-2 focus:outline-brand focus:outline-offset-2"
    >
      Skip to content
    </a>
  );
}

function LandingNav({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-base/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-5 sm:px-6">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <Logo className="size-7" />
          <span className="text-sm font-semibold tracking-tight text-1">Charon</span>
        </Link>
        <nav aria-label="Landing" className="flex items-center gap-5 text-sm">
          {minimal ? null : (
            <>
              <a
                href="#tour"
                className="text-2 hidden min-h-6 items-center no-underline transition-colors hover:text-1 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-4 sm:inline-flex"
              >
                Tour
              </a>
              <a
                href="#features"
                className="text-2 hidden min-h-6 items-center no-underline transition-colors hover:text-1 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-4 sm:inline-flex"
              >
                Features
              </a>
              <a
                href={`${GITHUB}/blob/main/docs/user/index.md`}
                className="text-2 hidden min-h-6 items-center no-underline transition-colors hover:text-1 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-4 sm:inline-flex"
                rel="noreferrer"
              >
                Docs
              </a>
              <a
                href={GITHUB}
                className="text-2 hidden min-h-6 items-center no-underline transition-colors hover:text-1 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-4 sm:inline-flex"
                rel="noreferrer"
              >
                GitHub
              </a>
            </>
          )}
          <Button asChild variant="outline" size="sm" className="h-9 px-4">
            <Link to="/signin">Sign in</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-[1200px] grid-cols-1 items-start gap-12 px-5 pt-16 pb-20 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:pt-24 lg:pb-28">
      <div className="lg:col-span-7">
        <p className="mb-5 text-xs font-semibold tracking-[0.14em] text-brand uppercase">
          For stories and roleplay
        </p>
        <h1 className="text-hero mb-6 max-w-[13ch] text-1">
          A private home for your AI characters.
        </h1>
        <p className="text-2 mb-8 max-w-xl text-lg leading-relaxed">
          Charon is a chat app for stories and roleplay that runs on your own computer. Bring the
          character cards you already have and your own AI key — or a model running locally — and
          keep every conversation, including every branch of it, to yourself.
        </p>
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <InstallCta />
          <a
            href="#branch"
            className="text-2 inline-flex h-11 items-center px-2 text-sm no-underline transition-colors hover:text-1"
          >
            See what is different
          </a>
        </div>
        <ul className="text-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {TRUST.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check className="size-4 text-brand" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="lg:col-span-5" id="install">
        <InstallCard />
      </div>
    </section>
  );
}

function InstallCta() {
  return (
    <Button
      type="button"
      className="h-11 px-6 text-sm"
      onClick={() => {
        const card = document.getElementById("install");
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        card?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        card?.querySelector<HTMLElement>('[role="tab"]')?.focus({ preventScroll: true });
        card?.classList.add("outline-2", "outline-brand", "outline-offset-4");
        window.setTimeout(
          () => card?.classList.remove("outline-2", "outline-brand", "outline-offset-4"),
          1400,
        );
      }}
    >
      Install Charon <ArrowRight className="size-4" />
    </Button>
  );
}

function InstallCard() {
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function copy(method: (typeof INSTALL_METHODS)[number]) {
    setFailed(null);
    try {
      await navigator.clipboard.writeText(method.command);
      setCopied(method.id);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setFailed(method.id);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-2xl shadow-black/30 sm:p-6">
      <h2 className="text-headline text-1">Run Charon on this computer</h2>
      <p className="text-2 mt-1 mb-5 text-sm">One command. About five minutes.</p>

      <Tabs defaultValue="unix" className="gap-4">
        <TabsList variant="line" className="w-full justify-start gap-4 border-b border-border">
          {INSTALL_METHODS.map((method) => (
            <TabsTrigger
              key={method.id}
              value={method.id}
              className="flex-none rounded-none px-0 pb-2 text-2 data-active:text-1"
            >
              {method.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {INSTALL_METHODS.map((method) => (
          <TabsContent key={method.id} value={method.id} className="mt-2">
            <ol className="grid gap-4">
              <li className="flex gap-3">
                <StepDot n={1} />
                <div className="grid gap-1">
                  <span className="text-sm font-medium text-1">{method.terminal}</span>
                  <span className="text-2 text-xs">{method.prerequisite}</span>
                </div>
              </li>
              <li className="flex gap-3">
                <StepDot n={2} />
                <div className="grid w-full gap-2">
                  <span className="text-sm font-medium text-1">Paste this</span>
                  <div className="rounded-xl border border-border bg-base">
                    <pre
                      tabIndex={0}
                      onFocus={(event) => {
                        const range = document.createRange();
                        range.selectNodeContents(event.currentTarget);
                        const selection = window.getSelection();
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                      }}
                      className="p-3 text-[13px] leading-relaxed break-all whitespace-pre-wrap text-1 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
                    >
                      <code>{method.command}</code>
                    </pre>
                    <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
                      <span aria-live="polite" className="text-2 text-xs">
                        {copied === method.id ? "Copied to clipboard" : null}
                        {failed === method.id ? "The command is selected; press Ctrl/Cmd+C." : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copy(method)}
                        aria-label={`Copy the ${method.label} install command`}
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-2 transition-colors hover:text-1 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
                      >
                        {copied === method.id ? (
                          <Check className="size-3.5 text-brand" aria-hidden="true" />
                        ) : (
                          <Copy className="size-3.5" aria-hidden="true" />
                        )}
                        {copied === method.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <StepDot n={3} />
                <div className="grid gap-1">
                  <span className="text-sm font-medium text-1">Open Charon</span>
                  <a
                    href="http://localhost:3000"
                    className="text-sm text-brand underline-offset-4 hover:underline"
                  >
                    localhost:3000
                  </a>
                </div>
              </li>
            </ol>
            <p className="text-2 mt-4 border-t border-border pt-3 text-xs leading-relaxed">
              {method.note}
              {method.installer ? (
                <>
                  {" "}
                  <a
                    href={`${GITHUB}/blob/main/scripts/${method.script}`}
                    className="underline underline-offset-4 hover:text-1"
                    rel="noreferrer"
                  >
                    Read the script
                  </a>{" "}
                  first if you like.
                </>
              ) : null}
            </p>
          </TabsContent>
        ))}
      </Tabs>

      <p className="text-2 mt-4 border-t border-border pt-3 text-xs">
        Already installed?{" "}
        <Link to="/signin" className="text-brand underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function StepDot({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-6 shrink-0 place-items-center rounded-full border border-brand/40 bg-brand/10 text-[11px] font-semibold text-brand"
    >
      {n}
    </span>
  );
}

function Tour() {
  return (
    <section id="tour" className="border-t border-border">
      <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-6 lg:py-24">
        <h2 className="text-display mb-3 max-w-[20ch] text-4xl leading-tight text-1">
          See it before you install it.
        </h2>
        <p className="text-2 mb-10 max-w-2xl text-lg">
          This is the whole app, not a mockup: the conversation view, the library, and the branch
          controls you will actually use.
        </p>

        <figure className="mb-4 overflow-hidden rounded-2xl border border-border bg-surface">
          <img
            src="/marketing/chat-branching.webp"
            width={1440}
            height={900}
            alt="A conversation with Captain Elias Thorne. The last reply shows a 2/3 counter with previous and next arrows."
            className="w-full"
            loading="lazy"
          />
        </figure>

        <div className="grid gap-4 sm:grid-cols-3">
          <figure>
            <img
              src="/marketing/characters-library.webp"
              width={1200}
              height={750}
              alt="The character library with three portrait cards: Captain Elias Thorne, Dr. Margaret Finch, and Lucien Vane."
              className="w-full rounded-xl border border-border"
              loading="lazy"
            />
            <figcaption className="text-2 mt-2 text-xs">
              Your library. Portraits, tags, and greetings come with the card.
            </figcaption>
          </figure>
          <figure>
            <img
              src="/marketing/tree-detail.webp"
              width={960}
              height={468}
              alt="Close view of a reply with its branch counter and regenerate control."
              className="w-full rounded-xl border border-border"
              loading="lazy"
            />
            <figcaption className="text-2 mt-2 text-xs">
              The branch controls: change the reply without losing the old one.
            </figcaption>
          </figure>
          <figure>
            <img
              src="/marketing/chat-mobile.webp"
              width={390}
              height={844}
              alt="The same conversation on a phone, with the composer and swipe controls."
              className="mx-auto max-h-[420px] w-auto rounded-xl border border-border"
              loading="lazy"
            />
            <figcaption className="text-2 mt-2 text-xs">The same story on your phone.</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="border-t border-border">
      <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-6 lg:py-24">
        <h2 className="text-display mb-3 max-w-[18ch] text-4xl leading-tight text-1">
          What you get
        </h2>
        <p className="text-2 mb-10 max-w-2xl text-lg">
          Everything a long-running story needs, in one app, with no extensions to install.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-border bg-surface p-5">
              <feature.icon className="mb-4 size-5 text-brand" aria-hidden="true" />
              <h3 className="text-headline mb-2 text-1">{feature.title}</h3>
              <p className="text-2 text-sm leading-relaxed">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Branch() {
  return (
    <section id="branch" className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 px-5 py-16 sm:px-6 lg:grid-cols-12 lg:py-24">
        <div className="lg:col-span-6">
          <h2 className="text-display mb-4 max-w-[16ch] text-4xl leading-tight text-1">
            Every reply is a branch. Nothing gets overwritten.
          </h2>
          <p className="text-2 mb-6 max-w-xl leading-relaxed">
            Swipe to see another version of a reply and the one you had stays where it was.
            Regenerate, edit, or continue, and each choice becomes a path you can come back to. Go
            three scenes forward, change your mind, and take the other road — the first story is
            still there.
          </p>
          <ul className="text-2 grid gap-3 text-sm">
            <li className="flex gap-2">
              <GitBranch className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
              A small counter under the message tells you which reply you are reading.
            </li>
            <li className="flex gap-2">
              <GitBranch className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
              Edit any message and the story continues from your edit.
            </li>
            <li className="flex gap-2">
              <GitBranch className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
              Delete a branch without touching the rest of the tree.
            </li>
            <li className="flex gap-2">
              <GitBranch className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
              Close the tab. The tree is in your database, not a session.
            </li>
          </ul>
        </div>
        <div className="lg:col-span-6">
          <BranchDiagram />
        </div>
      </div>
    </section>
  );
}

function BranchDiagram() {
  const nodes = [
    { x: 30, y: 112, w: 90, label: "You", active: false },
    { x: 220, y: 52, w: 200, label: "reply 1", active: false },
    { x: 220, y: 112, w: 200, label: "reply 2", active: false },
    { x: 220, y: 172, w: 200, label: "reply 3 · 3/3", active: true },
  ];
  return (
    <svg
      viewBox="0 0 460 250"
      role="img"
      aria-label="One message branches into three replies. All three remain reachable; the third is selected."
      className="hidden w-full rounded-2xl border border-border bg-base p-4 sm:block"
    >
      <path d="M120 130 H170 V70 H220" stroke="var(--border)" strokeWidth="1.5" fill="none" />
      <path d="M120 130 H220" stroke="var(--border)" strokeWidth="1.5" fill="none" />
      <path d="M120 130 H170 V190 H220" stroke="var(--brand)" strokeWidth="1.5" fill="none" />
      {nodes.map((node) => (
        <g key={node.label}>
          <rect
            x={node.x}
            y={node.y}
            width={node.w}
            height="36"
            rx="18"
            fill={node.active ? "var(--brand)" : "var(--bg-raised)"}
            stroke={node.active ? "var(--brand)" : "var(--border)"}
            strokeWidth="1.5"
          />
          <text
            x={node.x + node.w / 2}
            y={node.y + 18}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[12px]"
            fill={node.active ? "var(--bg-base)" : "var(--text-2)"}
          >
            {node.label}
          </text>
        </g>
      ))}
      <text x="230" y="235" textAnchor="middle" fill="var(--text-2)" className="text-[12px]">
        one message · three futures · all saved
      </text>
    </svg>
  );
}

function Privacy() {
  return (
    <section id="privacy" className="border-t border-border">
      <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-6 lg:py-24">
        <h2 className="text-display mb-3 max-w-[18ch] text-4xl leading-tight text-1">
          Where your data actually lives.
        </h2>
        <p className="text-2 mb-10 max-w-2xl text-lg">
          Not “we don’t sell your data.” There is no we. Charon is one process on one machine, and
          you can read the code that runs it.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: HardDrive,
              title: "One database, on your disk",
              body: "Characters, chats, lorebooks, personas, and settings are one SQLite file. Back it up by copying a folder; move it by moving that folder.",
            },
            {
              icon: Lock,
              title: "Keys encrypted before storage",
              body: "Your provider key is encrypted with a secret that only your install has, then written to the database. It travels only to the provider you chose.",
            },
            {
              icon: ShieldCheck,
              title: "No telemetry, no phoning home",
              body: "No analytics, no crash reporting, no licence check, no update pings. Charon does not know it is running.",
            },
          ].map((item) => (
            <div key={item.title}>
              <item.icon className="mb-4 size-5 text-brand" aria-hidden="true" />
              <h3 className="text-headline mb-2 text-1">{item.title}</h3>
              <p className="text-2 text-sm leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 rounded-2xl border border-border bg-surface p-5">
          <p className="text-2 text-sm leading-relaxed">
            <strong className="text-1">The honest part:</strong> if you use OpenAI or another cloud
            provider, your messages go to that provider under their terms. If you want nothing to
            leave the machine at all, run a local model with Ollama. In Charon, the difference
            between the two is one base URL.
          </p>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="border-t border-border">
      <div className="mx-auto max-w-[820px] px-5 py-16 sm:px-6 lg:py-24">
        <h2 className="text-display mb-8 text-4xl leading-tight text-1">
          Questions people actually ask.
        </h2>
        <div className="divide-y divide-border rounded-2xl border border-border">
          {FAQ.map((item) => (
            <details key={item.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg text-sm font-medium text-1 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  className="text-2 transition-transform group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="text-2 mt-3 text-sm leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-t border-border bg-surface">
      <div className="mx-auto max-w-[820px] px-5 py-20 text-center sm:px-6">
        <h2 className="text-display mb-3 text-4xl leading-tight text-1">
          Your characters are already in a folder somewhere.
        </h2>
        <p className="text-2 mb-8 text-lg">Bring them aboard.</p>
        <Button asChild className="h-11 px-6 text-sm">
          <a href="#install">
            Install Charon <ArrowRight className="size-4" />
          </a>
        </Button>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Logo className="size-6" />
            <span className="text-sm font-semibold text-1">Charon</span>
          </div>
          <p className="text-2 text-xs leading-relaxed">
            A private home for AI characters. Self-hosted, open source, no telemetry.
          </p>
        </div>
        <FooterColumn
          title="Product"
          links={[
            ["Tour", "#tour"],
            ["Features", "#features"],
            ["Branching", "#branch"],
            ["Privacy", "#privacy"],
            ["FAQ", "#faq"],
          ]}
        />
        <FooterColumn
          title="Docs"
          links={[
            ["Getting started", `${GITHUB}/blob/main/docs/user/getting-started.md`],
            ["Chatting", `${GITHUB}/blob/main/docs/user/chatting.md`],
            ["Troubleshooting", `${GITHUB}/blob/main/docs/user/troubleshooting.md`],
          ]}
          external
        />
        <FooterColumn
          title="Project"
          links={[
            ["GitHub", GITHUB],
            ["Issues", `${GITHUB}/issues`],
            ["Contributing", `${GITHUB}/blob/main/CONTRIBUTING.md`],
            ["License & notices", `${GITHUB}/blob/main/NOTICE`],
          ]}
          external
        />
      </div>
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-5 text-xs text-3 sm:px-6">
        <span>Runs on your machine · No telemetry · Built by Marv</span>
        <span>Charon</span>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  external = false,
}: {
  title: string;
  links: ReadonlyArray<readonly [string, string]>;
  external?: boolean;
}) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-1 uppercase">{title}</h3>
      <ul className="grid gap-2">
        {links.map(([label, href]) => (
          <li key={label}>
            {external ? (
              <a
                href={href}
                className="text-2 inline-flex min-h-6 items-center text-xs no-underline transition-colors hover:text-1 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-4"
                rel="noreferrer"
              >
                {label}
              </a>
            ) : (
              <a
                href={href}
                className="text-2 inline-flex min-h-6 items-center text-xs no-underline transition-colors hover:text-1 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-4"
              >
                {label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
