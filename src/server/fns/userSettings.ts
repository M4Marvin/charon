import { Schema } from "effect";
import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/server/session";
import {
  getUserSettings as repoGetUserSettings,
  upsertUserSettings as repoUpsertUserSettings,
  type UserSettingsPatch,
} from "@/db/repositories/userSettings";
import { UpdateUserSettings } from "@/server/schemas/chat";

export type UserSettingsView = {
  defaultProviderId: string | null;
  defaultPresetId: string | null;
  defaultSelectedModel: string | null;
  defaultPersonaId: string | null;
  systemPrompt: string | null;
  postHistoryInstructions: string | null;
  impersonationPrompt: string | null;
  updatedAt: Date;
};

function toView(
  row: {
    defaultProviderId: string | null;
    defaultPresetId: string | null;
    defaultSelectedModel: string | null;
    defaultPersonaId: string | null;
    systemPrompt: string | null;
    postHistoryInstructions: string | null;
    impersonationPrompt: string | null;
    updatedAt: Date;
  } | null,
): UserSettingsView {
  return {
    defaultProviderId: row?.defaultProviderId ?? null,
    defaultPresetId: row?.defaultPresetId ?? null,
    defaultSelectedModel: row?.defaultSelectedModel ?? null,
    defaultPersonaId: row?.defaultPersonaId ?? null,
    systemPrompt: row?.systemPrompt ?? null,
    postHistoryInstructions: row?.postHistoryInstructions ?? null,
    impersonationPrompt: row?.impersonationPrompt ?? null,
    updatedAt: row?.updatedAt ?? new Date(0),
  };
}

export const getUserSettings = createServerFn({ method: "GET", strict: { output: false } }).handler(
  async (): Promise<UserSettingsView> => {
    const { user } = await getSession();
    return toView(repoGetUserSettings(user.id));
  },
);

export const updateUserSettings = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(UpdateUserSettings)(data))
  .handler(async ({ data }): Promise<UserSettingsView> => {
    const { user } = await getSession();
    const patch: UserSettingsPatch = {};
    if (data.defaultProviderId !== undefined) patch.defaultProviderId = data.defaultProviderId;
    if (data.defaultPresetId !== undefined) patch.defaultPresetId = data.defaultPresetId;
    if (data.defaultSelectedModel !== undefined) patch.defaultSelectedModel = data.defaultSelectedModel;
    if (data.defaultPersonaId !== undefined) patch.defaultPersonaId = data.defaultPersonaId;
    if (data.systemPrompt !== undefined) patch.systemPrompt = data.systemPrompt;
    if (data.postHistoryInstructions !== undefined) patch.postHistoryInstructions = data.postHistoryInstructions;
    if (data.impersonationPrompt !== undefined) patch.impersonationPrompt = data.impersonationPrompt;
    const row = repoUpsertUserSettings(user.id, patch);
    return toView(row);
  });
