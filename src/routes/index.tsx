import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { SkipLink } from "@/components/common/SkipLink";
import {
  ArrowRight,
  BookOpen,
  Check,
  Eye,
  FileImage,
  HardDrive,
  Image as ImageIcon,
  Lock,
  MonitorSmartphone,
  Plug,
  ShieldCheck,
  Smartphone,
  Type,
  UserRound,
  Zap,
} from "lucide-react";

import { Logo } from "@/components/common/Logo";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth.functions";
import { getSetupRequired } from "@/server/fns/setup";

const SITE_URL =
  (typeof process !== "undefined" && process.env.APP_URL?.replace(/\/$/, "")) ||
  "http://localhost:3000";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const [session, setup] = await Promise.all([getSession(), getSetupRequired()]);
    if (session) throw redirect({ to: "/chat" });
    return { needsSetup: setup.needsSetup };
  },
  head: () => ({
    meta: [
      { title: "Charon — roleplay, with the finish it deserves" },
      {
        name: "description",
        content:
          "A chat app for stories and roleplay with the finish of a published book. Fast replies, a library worth looking at, and everything on your own machine.",
      },
      { property: "og:title", content: "Charon — roleplay, with the finish it deserves" },
      {
        property: "og:description",
        content:
          "AI character chat that looks as good as the story. Your cards, your model, your machine.",
      },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: `${SITE_URL}/og.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Charon — roleplay, with the finish it deserves" },
      {
        name: "twitter:description",
        content:
          "AI character chat that looks as good as the story. Your cards, your model, your machine.",
      },
      { name: "twitter:image", content: `${SITE_URL}/og.png` },
    ],
  }),
  component: LandingPage,
});

const START_STEPS = [
  ["Open the app", "This page is the app. Bookmark it; it works on a phone too."],
  ["Sign in", "One private instance: accounts are made by whoever runs it."],
  [
    "Pick a character and say hello",
    "Three starters are waiting, or import a PNG card of your own.",
  ],
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
    body: "Keyword-triggered entries give the model the right history at the right moment. Import a world-info JSON file or write your own.",
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
    body: "Put a backdrop behind the conversation and a portrait beside it. Your images stay with your chats.",
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
    a: "No. Open the app, sign in, connect a provider, pick a character. There are no config files to edit for normal use.",
  },
  {
    q: "Does it cost anything?",
    a: "Nothing to unlock here. You pay your AI provider directly, or nothing if you point Charon at a model on your own machine. No subscription, no seats.",
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
    q: "Can I import my existing characters?",
    a: "Yes. Charon reads V2 and V3 PNG cards, keeps the portrait and greetings, and extracts an embedded lorebook into one you can edit.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. Open the same address in your phone's browser. One library, one account.",
  },
  {
    q: "Is this NSFW?",
    a: 'No. Charon is built and presented for stories and roleplay: SFW starter characters, no adult content bundled, and no "unfiltered" marketing. Because it is your machine and your model, what you import is your choice — but if you are looking for an adult platform, this is not one.',
  },
  {
    q: "Is Charon open source?",
    a: "Yes. It is MIT-licensed, and the whole source is published at charonx.dev/source, ready to download. Read it, build it, change it.",
  },
  {
    q: "Where do my chats live?",
    a: "In one SQLite database and an uploads folder on the machine running Charon. Copy that folder to back everything up. Nothing is stored anywhere else.",
  },
  {
    q: "Something is broken. What do I check?",
    a: "Reload the page first. If it keeps happening, tell whoever runs this instance what you were doing and when.",
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
            Charon is a chat app for stories and roleplay that runs on your own computer. Replies
            stream as they are written, the take you liked stays saved, and your cards, chats, and
            keys live in one local database.
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
        <Craft />
        <Features />
        <Privacy />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
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
                href="#faq"
                className="text-2 hidden min-h-6 items-center no-underline transition-colors hover:text-1 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-4 sm:inline-flex"
              >
                FAQ
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
        <h1 className="text-hero mb-6 max-w-[15ch] text-1">
          Roleplay, with the finish it deserves.
        </h1>
        <p className="text-2 mb-8 max-w-xl text-lg leading-relaxed">
          Charon is a chat app for stories and roleplay, made with the care of a printed book: type
          set for long scenes, a library that looks like a shelf, and replies quick enough to feel
          live. Private, and running on a machine you own.
        </p>
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <InstallCta />
          <a
            href="#craft"
            className="text-2 inline-flex h-11 items-center px-2 text-sm no-underline transition-colors hover:text-1"
          >
            See the craft
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
      <div className="lg:col-span-5">
        <InstallCard />
      </div>
    </section>
  );
}

function InstallCta() {
  return (
    <Button asChild className="h-11 px-6 text-sm">
      <Link to="/signin">
        Sign in to Charon <ArrowRight className="size-4" />
      </Link>
    </Button>
  );
}

function InstallCard() {
  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-2xl shadow-black/30 sm:p-6">
      <h2 className="text-headline text-1">Runs on the machine that hosts it</h2>
      <p className="text-2 mt-1 mb-5 text-sm">
        One container, one SQLite file, one account. Nothing here depends on someone else&apos;s
        server.
      </p>

      <ol className="grid gap-4">
        {START_STEPS.map(([title, body], index) => (
          <li key={title} className="flex gap-3">
            <StepDot n={index + 1} />
            <div className="grid gap-1">
              <span className="text-sm font-medium text-1">{title}</span>
              <span className="text-2 text-xs">{body}</span>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-2 mt-4 border-t border-border pt-3 text-xs">
        Runs in the browser. Nothing to install, nothing to update.
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
          See it before you sign in.
        </h2>
        <p className="text-2 mb-10 max-w-2xl text-lg">
          This is the whole app, not a mockup: the reading view, the library, and the controls you
          will actually use.
        </p>

        <figure className="mb-4 overflow-hidden rounded-2xl border border-border bg-surface">
          <img
            src="/marketing/chat-branching.webp"
            width={1440}
            height={900}
            alt="A conversation with Captain Elias Thorne in the reading view, with the reply controls under the last message."
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
              alt="Close view of a reply with its regenerate control."
              className="w-full rounded-xl border border-border"
              loading="lazy"
            />
            <figcaption className="text-2 mt-2 text-xs">
              The controls stay quiet until you reach for them.
            </figcaption>
          </figure>
          <figure>
            <img
              src="/marketing/chat-mobile.webp"
              width={390}
              height={844}
              alt="The same conversation on a phone, with the composer and reply controls."
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
          Everything the story needs
        </h2>
        <p className="text-2 mb-10 max-w-2xl text-lg">
          One app, nothing bolted on. Import the cards you own, set the scene, and keep going.
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

function Craft() {
  const marks = [
    {
      icon: Type,
      title: "Set for long scenes",
      body: "A comfortable measure, a quiet hierarchy, and figures that line up. The page reads well at hour three, not just minute one.",
    },
    {
      icon: Zap,
      title: "Quick enough to feel live",
      body: "Replies stream from the first token. Opening a chat, switching characters, and scrolling back through a scene stay out of your way.",
    },
    {
      icon: Eye,
      title: "Nothing competing for attention",
      body: "One accent, no badges, no banners, no upsell. The story is the only thing on the page.",
    },
    {
      icon: Smartphone,
      title: "The same care on a phone",
      body: "The same type, spacing, and controls at phone width. One library, one account, whichever screen is in your hand.",
    },
  ];

  return (
    <section id="craft" className="border-t border-border bg-surface">
      <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-6 lg:py-24">
        <h2 className="text-display mb-3 max-w-[16ch] text-4xl leading-tight text-1">
          Made to be read.
        </h2>
        <p className="text-2 mb-10 max-w-2xl text-lg">
          Charon is not a chat window with a character sheet stapled to it. The type, the measure,
          the spacing, and the motion were set for one thing: a scene you want to keep reading.
        </p>
        <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {marks.map((mark) => (
            <div key={mark.title} className="flex gap-3">
              <mark.icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
              <div>
                <h3 className="text-headline mb-1 text-1">{mark.title}</h3>
                <p className="text-2 text-sm leading-relaxed">{mark.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
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
          everything it knows lives in one SQLite file.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: HardDrive,
              title: "One database, one folder",
              body: "Characters, chats, lorebooks, personas, and settings are one SQLite file. Back it up by copying a folder; move it by moving that folder.",
            },
            {
              icon: Lock,
              title: "Keys encrypted before storage",
              body: "Your provider key is encrypted with a secret that only this instance has, then written to the database. It travels only to the provider you chose.",
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
          <Link to="/signin">
            Open Charon <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Logo className="size-6" />
            <span className="text-sm font-semibold text-1">Charon</span>
          </div>
          <p className="text-2 max-w-xs text-xs leading-relaxed">
            A private home for AI characters. No telemetry, no analytics, no account on anyone
            else&apos;s service.
          </p>
        </div>
        <FooterColumn
          title="Explore"
          links={[
            ["Tour", "#tour"],
            ["Features", "#features"],
            ["Craft", "#craft"],
            ["Privacy", "#privacy"],
            ["FAQ", "#faq"],
          ]}
        />
        <FooterColumn
          title="This instance"
          links={[
            ["Open Charon", "/signin"],
            ["Where data lives", "#privacy"],
            ["Questions", "#faq"],
          ]}
        />
      </div>
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-5 text-xs text-2 sm:px-6">
        <span>Self-hosted · No telemetry · No analytics</span>
        <span>Charon</span>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-1 uppercase">{title}</h3>
      <ul className="grid gap-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <a
              href={href}
              className="text-2 inline-flex min-h-6 items-center text-xs no-underline transition-colors hover:text-1 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-4"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
