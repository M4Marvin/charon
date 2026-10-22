import { useEffect, useState } from "react";
import { Copy, FileText } from "lucide-react";
import type { CharacterDataV2 } from "@/lib/st-core/character";
import { MarkdownContent } from "@/components/MarkdownContent";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { tokenBreakdown } from "@/routes/characters/detail-helpers";

type DefinitionItem = {
  slug: string;
  title: string;
  tokens: number;
  content?: string;
  greetings?: string[];
};

export function CharacterDefinition({ data }: { data: CharacterDataV2 }) {
  const breakdown = tokenBreakdown(data);
  const greetings = [data.first_mes, ...data.alternate_greetings].filter(Boolean);

  const items: DefinitionItem[] = [];
  if (data.description) {
    items.push({
      slug: "description",
      title: "Description",
      tokens: breakdown.description,
      content: data.description,
    });
  }
  if (data.personality) {
    items.push({
      slug: "personality",
      title: "Personality",
      tokens: breakdown.personality,
      content: data.personality,
    });
  }
  if (data.scenario) {
    items.push({
      slug: "scenario",
      title: "Scenario",
      tokens: breakdown.scenario,
      content: data.scenario,
    });
  }
  if (greetings.length > 0) {
    items.push({ slug: "greetings", title: "Greetings", tokens: breakdown.greetings, greetings });
  }
  if (data.mes_example) {
    items.push({
      slug: "example-messages",
      title: "Example Messages",
      tokens: breakdown.exampleMessages,
      content: data.mes_example,
    });
  }
  if (data.system_prompt) {
    items.push({
      slug: "system-prompt",
      title: "System Prompt",
      tokens: breakdown.systemPrompt,
      content: data.system_prompt,
    });
  }
  if (data.post_history_instructions) {
    items.push({
      slug: "post-history",
      title: "Post-History Instructions",
      tokens: breakdown.postHistory,
      content: data.post_history_instructions,
    });
  }
  const depthPrompt = data.extensions.depth_prompt;
  if (depthPrompt) {
    items.push({
      slug: "depth-prompt",
      title: "Depth Prompt",
      tokens: breakdown.depthPrompt,
      content: depthPrompt.prompt,
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-title">Character Card</h2>
        <p className="text-2 text-xs tabular-nums">{breakdown.total.toLocaleString()} tokens</p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No card content"
          description="This card has no definition fields."
        />
      ) : (
        <Accordion type="multiple" className="border-subtle">
          {items.map((item) => (
            <AccordionItem key={item.slug} value={item.slug}>
              <AccordionTrigger>
                <span>{item.title}</span>
                <span className="text-2 text-xs tabular-nums">{item.tokens} tokens</span>
              </AccordionTrigger>
              <AccordionContent>
                {item.greetings ? (
                  <GreetingCarousel greetings={item.greetings} />
                ) : (
                  <MarkdownContent content={item.content ?? ""} />
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </section>
  );
}

function GreetingCarousel({ greetings }: { greetings: string[] }) {
  if (greetings.length === 1) {
    return (
      <div className="relative rounded-xl border border-subtle bg-surface p-4">
        <div className="absolute top-3 right-3">
          <CopyButton text={greetings[0]} />
        </div>
        <MarkdownContent content={greetings[0]} />
      </div>
    );
  }
  return <MultiGreetingCarousel greetings={greetings} />;
}

function MultiGreetingCarousel({ greetings }: { greetings: string[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!api) return;
    const on = () => setIndex(api.selectedScrollSnap());
    on();
    api.on("select", on);
    return () => {
      api.off("select", on);
    };
  }, [api]);

  return (
    <div className="space-y-2">
      <Carousel setApi={setApi}>
        <CarouselContent>
          {greetings.map((greeting, i) => (
            <CarouselItem key={i}>
              <div className="relative rounded-xl border border-subtle bg-surface p-4">
                <div className="absolute top-3 right-3">
                  <CopyButton text={greeting} />
                </div>
                <MarkdownContent content={greeting} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-left-2" />
        <CarouselNext className="-right-2" />
      </Carousel>
      <p className="text-2 text-xs tabular-nums">
        {index + 1} / {greetings.length}
      </p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? (
        <span className="text-success text-[11px] font-medium">✓</span>
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  );
}
