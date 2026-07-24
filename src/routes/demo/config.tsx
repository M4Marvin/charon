import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/server/session";
import { loadChatConfig } from "@/features/chat/config/service";
import { listChats } from "@/features/chat/tree/service";
import type { LoreEntry } from "@/lib/st-core/lorebook/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

// ── Server fn ────────────────────────────────────────────────────────────────

const loadDemoConfig = createServerFn({ method: "POST", strict: { output: false } })
  .validator((input: unknown) => input as { chatId: string })
  .handler(async ({ data }) => {
    const { user } = await getSession();
    const config = await loadChatConfig(user.id, data.chatId, user.name);

    const loreEntries = config.loreEntries.map((e: LoreEntry) => ({
      displayName: e.key.join(", "),
      keyCount: e.key.length,
      keys: e.key,
      comment: e.comment ?? null,
      content: e.content,
      enabled: !(e.disable ?? false),
      constant: e.constant ?? false,
    }));

    return {
      chat: {
        id: config.chat.id,
        title: config.chat.title,
        characterId: config.chat.characterId,
        lockState: config.chat.lockState,
        lockMessageLocalId: config.chat.lockMessageLocalId,
        characterDescription: config.chat.characterDescription,
        characterPersonality: config.chat.characterPersonality,
        characterScenario: config.chat.characterScenario,
        characterSystemPrompt: config.chat.characterSystemPrompt,
      },
      settings: config.settings,
      persona: {
        name: config.persona.name,
        description: config.persona.description ?? null,
        isFallback: config.persona.name === user.name,
      },
      provider: config.provider
        ? {
            baseUrl: config.provider.provider.baseUrl,
            model: config.provider.model,
            hasApiKey: config.provider.provider.apiKey.length > 0,
            preset: config.provider.preset,
          }
        : null,
      character: {
        name: config.character.name,
        description: config.character.description,
        personality: config.character.personality,
        scenario: config.character.scenario,
        system_prompt: config.character.system_prompt,
        first_mes: config.character.first_mes,
        post_history_instructions: config.character.post_history_instructions,
      },
      loreEntries,
    };
  });

const listDemoChats = createServerFn({ method: "GET" }).handler(async () => {
  const { user } = await getSession();
  return listChats(user.id);
});

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/demo/config")({
  component: ConfigDemo,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputBase =
  "w-full px-2.5 py-1.5 rounded-md border border-input bg-input text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border p-4 mb-4">
      <h3 className="m-0 mb-3 text-[15px] font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function JsonBlock({ data, label }: { data: unknown; label?: string }) {
  return (
    <div className="mb-4">
      {label && <div className="font-semibold mb-1 text-sm text-foreground">{label}</div>}
      <pre className="bg-muted text-foreground p-3 rounded-lg text-xs leading-relaxed overflow-auto max-h-96 m-0">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function FieldRow({ label, value, nil }: { label: string; value: React.ReactNode; nil?: boolean }) {
  return (
    <div className="flex items-start py-1 text-xs">
      <span className="text-muted-foreground w-44 shrink-0">{label}</span>
      <span className={nil ? "text-muted-foreground/50 italic" : "text-foreground font-mono break-all"}>
        {value}
      </span>
    </div>
  );
}

function Badge({ children, variant }: { children: React.ReactNode; variant: "set" | "unset" | "info" }) {
  return (
    <span
      className={cn(
        "inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold",
        variant === "set" && "bg-emerald-500/10 text-emerald-400",
        variant === "unset" && "bg-muted text-muted-foreground",
        variant === "info" && "bg-blue-500/10 text-blue-400",
      )}
    >
      {children}
    </span>
  );
}

// ── Page Component ───────────────────────────────────────────────────────────

interface DemoData {
  chat: {
    id: string;
    title: string;
    characterId: string;
    lockState: "idle" | "generating";
    lockMessageLocalId: number | null;
    characterDescription: string;
    characterPersonality: string;
    characterScenario: string;
    characterSystemPrompt: string;
  };
  settings: {
    defaultProviderId: string | null;
    defaultPresetId: string | null;
    defaultSelectedModel: string | null;
    defaultPersonaId: string | null;
    systemPrompt: string | null;
    postHistoryInstructions: string | null;
    impersonationPrompt: string | null;
  };
  persona: {
    name: string;
    description: string | null;
    isFallback: boolean;
  };
  provider: {
    baseUrl: string;
    model: string;
    hasApiKey: boolean;
    preset: Record<string, unknown>;
  } | null;
  character: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    system_prompt: string;
    first_mes: string;
    post_history_instructions: string;
  };
  loreEntries: Array<{
    displayName: string;
    keyCount: number;
    keys: string[];
    comment: string | null;
    content: string;
    enabled: boolean;
    constant: boolean;
  }>;
}

function ConfigDemo() {
  const [selectedChatId, setSelectedChatId] = useState("");

  const { data: chats } = useQuery({
    queryKey: ["demo-config-chats"],
    queryFn: () => listDemoChats(),
  });

  const { data: demoData, isFetching } = useQuery({
    queryKey: ["demo-config", selectedChatId],
    queryFn: () => loadDemoConfig({ data: { chatId: selectedChatId } }),
    enabled: selectedChatId.length > 0,
  });

  const demo = demoData as DemoData | undefined;
  const hasError = demo ? !!(demo as unknown as Record<string, unknown>).error : false;
  const hasData = !!demo && !hasError;

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex justify-between items-center mb-5">
          <h1 className="m-0 text-xl font-bold">Config Module Demo</h1>
          <div className="flex gap-3 items-center">
            <Link to="/demo/generation" className="text-sm text-primary hover:text-primary/80 transition-colors">
              Generation Demo
            </Link>
            <Link to="/" className="text-sm text-primary hover:text-primary/80 transition-colors">
              Home
            </Link>
          </div>
        </div>

        <div className="flex gap-4 flex-wrap">
          {/* ── Left panel: inspection ─────────── */}
          <div className="flex-[1_1_400px] min-w-[300px]">
            <Section title="Chat Selector">
              <select
                value={selectedChatId}
                onChange={(e) => setSelectedChatId(e.target.value)}
                className={inputBase}
              >
                <option value="">{'\u2014'} Select a chat {'\u2014'}</option>
                {(chats as Array<Record<string, unknown>> | undefined)?.map(
                  (chat: Record<string, unknown>) => (
                    <option key={chat.id as string} value={chat.id as string}>
                      {chat.title as string} ({(chat as any).characterName})
                    </option>
                  ),
                )}
              </select>
            </Section>

            {isFetching && !hasData && (
              <Section title="Loading">
                <div className="text-muted-foreground text-sm">Resolving config...</div>
              </Section>
            )}

            {hasError && (
              <Section title="Error">
                <div className="text-destructive font-mono text-sm">{String((demo as unknown as Record<string, unknown>).error)}</div>
              </Section>
            )}

            {hasData && (
              <>
                {(() => {
                  const d = demo!;
                  const { settings, persona, loreEntries, provider } = d; return (
                  <>
                {/* ── Chat Info ── */}
                <Section title="Chat Info">
                  <div className="space-y-1">
                    <FieldRow label="ID" value={d.chat.id} />
                    <FieldRow label="Title" value={d.chat.title} />
                    <FieldRow label="Character ID" value={d.chat.characterId} />
                    <FieldRow
                      label="Lock"
                      value={
                        <Badge variant={d.chat.lockState === "generating" ? "set" : "unset"}>
                          {d.chat.lockState}
                        </Badge>
                      }
                    />
                  </div>
                </Section>

                <Section title="Chat Character Overrides">
                  <div className="space-y-1">
                    <FieldRow
                      label="characterDescription"
                      value={d.chat.characterDescription || "\u2014"}
                      nil={!d.chat.characterDescription}
                    />
                    <FieldRow
                      label="characterPersonality"
                      value={d.chat.characterPersonality || "\u2014"}
                      nil={!d.chat.characterPersonality}
                    />
                    <FieldRow
                      label="characterScenario"
                      value={d.chat.characterScenario || "\u2014"}
                      nil={!d.chat.characterScenario}
                    />
                    <FieldRow
                      label="characterSystemPrompt"
                      value={d.chat.characterSystemPrompt || "\u2014"}
                      nil={!d.chat.characterSystemPrompt}
                    />
                  </div>
                </Section>

                {/* ── User Settings ── */}
                <Section title="User Settings">
                  <div className="space-y-1">
                    <FieldRow
                      label="defaultProviderId"
                      value={
                        settings.defaultProviderId ? (
                          <Badge variant="set">set</Badge>
                        ) : (
                          <Badge variant="unset">none</Badge>
                        )
                      }
                    />
                    <FieldRow
                      label="defaultSelectedModel"
                      value={
                        settings.defaultSelectedModel ? (
                          <code className="text-emerald-400">{settings.defaultSelectedModel}</code>
                        ) : (
                          <Badge variant="unset">none</Badge>
                        )
                      }
                    />
                    <FieldRow
                      label="defaultPresetId"
                      value={
                        settings.defaultPresetId ? (
                          <Badge variant="set">set</Badge>
                        ) : (
                          <Badge variant="unset">none</Badge>
                        )
                      }
                    />
                    <FieldRow
                      label="defaultPersonaId"
                      value={
                        settings.defaultPersonaId ? (
                          <Badge variant="set">set</Badge>
                        ) : (
                          <Badge variant="unset">none</Badge>
                        )
                      }
                    />
                    <FieldRow
                      label="systemPrompt"
                      value={
                        settings.systemPrompt ? (
                          <span>{`${settings.systemPrompt.substring(0, 80)}...`}</span>
                        ) : (
                          <Badge variant="unset">none</Badge>
                        )
                      }
                    />
                    <FieldRow
                      label="postHistoryInstructions"
                      value={
                        settings.postHistoryInstructions ? (
                          <span>{`${settings.postHistoryInstructions.substring(0, 80)}...`}</span>
                        ) : (
                          <Badge variant="unset">none</Badge>
                        )
                      }
                    />
                    <FieldRow
                      label="impersonationPrompt"
                      value={
                        settings.impersonationPrompt ? (
                          <Badge variant="set">custom</Badge>
                        ) : (
                          <Badge variant="unset">default</Badge>
                        )
                      }
                    />
                  </div>
                </Section>

                {/* ── Persona ── */}
                <Section title="Persona Resolution">
                  <div className="space-y-1">
                    <FieldRow
                      label="Name"
                      value={
                        <span>
                          {persona.name}
                          {persona.isFallback && (
                            <Badge variant="info">account name</Badge>
                          )}
                          {!persona.isFallback && (
                            <Badge variant="set">persona</Badge>
                          )}
                        </span>
                      }
                    />
                    <FieldRow
                      label="Description"
                      value={
                        persona.description ? (
                          <span>{persona.description.substring(0, 120)}</span>
                        ) : (
                          <Badge variant="unset">none</Badge>
                        )
                      }
                    />
                  </div>
                </Section>

                {/* ── Provider ── */}
                <Section title="Provider Resolution">
                  {provider ? (
                    <>
                      <div className="space-y-1">
                        <FieldRow label="Base URL" value={provider.baseUrl} />
                        <FieldRow
                          label="Model"
                          value={<code className="text-emerald-400">{provider.model}</code>}
                        />
                        <FieldRow
                          label="API Key"
                          value={
                            provider.hasApiKey ? (
                              <Badge variant="set">present</Badge>
                            ) : (
                              <Badge variant="unset">missing</Badge>
                            )
                          }
                        />
                      </div>
                      {Object.keys(provider.preset).length > 0 && (
                        <div className="mt-3">
                          <div className="font-semibold mb-1 text-sm text-foreground">Preset Overrides</div>
                          <pre className="bg-muted text-foreground p-3 rounded-lg text-xs leading-relaxed overflow-auto max-h-48 m-0">
                            {JSON.stringify(provider.preset, null, 2)}
                          </pre>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-muted-foreground text-sm italic">
                      No provider configured.
                    </div>
                  )}
                </Section>

                {/* ── Lorebooks ── */}
                <Section title={`Lorebooks (${loreEntries.length} entries)`}>
                  {loreEntries.length === 0 ? (
                    <div className="text-muted-foreground text-sm italic">
                      No lorebooks enabled or no entries match.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {loreEntries.map((entry, i) => (
                        <div
                          key={i}
                          className="bg-muted/50 border border-border rounded-lg p-3 text-xs"
                        >
                          <div className="flex flex-wrap gap-2 items-center mb-1">
                            <strong className="text-foreground">
                              {entry.displayName}
                            </strong>
                            <Badge variant={entry.enabled ? "set" : "unset"}>
                              {entry.enabled ? "enabled" : "disabled"}
                            </Badge>
                            {entry.constant && <Badge variant="info">constant</Badge>}
                          </div>
                          <div className="text-muted-foreground mb-1">
                            Keys: [{entry.keys.join(", ")}]
                          </div>
                          {entry.comment && (
                            <div className="text-muted-foreground/70 italic mb-1">
                              Comment: {entry.comment}
                            </div>
                          )}
                          <div className="text-foreground/80 whitespace-pre-wrap break-all">
                            {(entry.content ?? "").substring(0, 200)}
                            {(entry.content ?? "").length > 200 ? "..." : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {/* ── Character Data ── */}
                <Section title="Character Data">
                  <JsonBlock data={d.character} />
                </Section>
                </>);})()}
              </>
            )}
          </div>

          {/* ── Right panel: summary ───────────── */}
          <div className="flex-[1_1_400px] min-w-[300px]">
            {hasData && (
              <>
                {(() => {
                  const d = demo!;
                  const { settings, persona, loreEntries, provider } = d; return (
                  <>
                {/* ── Snapshot card ── */}
                <Section title="Config Snapshot">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-muted-foreground mb-1">Persona</div>
                      <div className="text-foreground font-semibold text-sm">{persona.name}</div>
                      <div className="text-muted-foreground text-[11px]">
                        {persona.isFallback ? "Using account name" : "From persona"}
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-muted-foreground mb-1">Model</div>
                      {provider ? (
                        <>
                          <div className="text-foreground font-semibold text-sm">{provider.model}</div>
                          <div className="text-muted-foreground text-[11px] break-all">{provider.baseUrl}</div>
                        </>
                      ) : (
                        <div className="text-muted-foreground text-sm italic">None</div>
                      )}
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-muted-foreground mb-1">Lorebooks</div>
                      <div className="text-foreground font-semibold text-sm">
                        {loreEntries.length} active
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-muted-foreground mb-1">Settings</div>
                      <div className="text-foreground font-semibold text-sm">
                        {[
                          settings.systemPrompt && "sysPrompt",
                          settings.postHistoryInstructions && "postHist",
                          settings.impersonationPrompt && "imperPrompt",
                          settings.defaultPresetId && "preset",
                        ]
                          .filter(Boolean)
                          .join(", ") || "All defaults"}
                      </div>
                    </div>
                  </div>
                </Section>

                {/* ── Full JSON dump ── */}
                <Section title="Full ChatConfig (JSON)">
                  <pre className="bg-muted text-foreground p-3 rounded-lg text-xs leading-relaxed overflow-auto max-h-[600px] break-all whitespace-pre-wrap m-0">
                    {JSON.stringify(d, null, 2)}
                  </pre>
                </Section>

                {/* ── Guide ── */}
                <Section title="What This Shows">
                  <ol className="text-sm m-0 pl-5 leading-relaxed text-foreground">
                    <li>
                      <strong>Settings</strong> — all 7 fields from <code>user_settings</code>,
                      read by <code>loadChatConfig</code>. Grayed-out = null/not set.
                    </li>
                    <li>
                      <strong>Persona</strong> — resolved from <code>defaultPersonaId</code>.
                      Falls back to account name if no persona is configured or the persona was deleted.
                    </li>
                    <li>
                      <strong>Provider</strong> — resolved from <code>defaultProviderId</code>.
                      API key is never sent to the client (only <code>hasApiKey</code> boolean).
                    </li>
                    <li>
                      <strong>Lorebooks</strong> — all entries from user-enabled lorebooks,
                      filtered by user-disabled entries and <code>data.disable</code>.
                    </li>
                    <li>
                      <strong>Character overrides</strong> — per-chat copies of character fields,
                      stored on the <code>chats</code> row. These overlay the character card values.
                    </li>
                    <li>
                      The right panel shows a <strong>compact snapshot</strong> and a
                      <strong> full JSON dump</strong> of the complete <code>ChatConfig</code>{" "}
                      object (provider API key masked).
                    </li>
                  </ol>
                </Section>
                </>);})()}
              </>
            )}

            {!hasData && !isFetching && (
              <Section title="Config Snapshot">
                <div className="text-muted-foreground text-sm italic">
                  Select a chat above to see resolved config.
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
