import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Lorebook, LoreEntry } from "@/db/schema";
import type { LoreConfig } from "@/lib/st-core/lorebook";
import {
  createLorebook,
  createLorebookEntry,
  deleteLorebook,
  deleteLorebookEntry,
  getLorebook,
  importLorebook,
  listLorebookEntries,
  listLorebooks,
  updateLorebook,
  updateLorebookEntry,
} from "@/server/fns/lorebooks";
import { setLorebookEnabled, setLoreEntryDisabled } from "@/server/fns/userLorebookSettings";

export const lorebookKeys = {
  all: ["lorebooks"] as const,
  list: () => [...lorebookKeys.all, "list"] as const,
  detail: (id: string) => [...lorebookKeys.all, "detail", id] as const,
  entries: (lorebookId: string) => [...lorebookKeys.all, "entries", lorebookId] as const,
};

export function useLorebooks() {
  return useQuery({
    queryKey: lorebookKeys.list(),
    queryFn: () => listLorebooks(),
  });
}

export function useLorebook(id: string) {
  return useQuery({
    queryKey: lorebookKeys.detail(id),
    queryFn: () => getLorebook({ data: { id } }),
    enabled: id.length > 0,
  });
}

export function useCreateLorebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      description?: string;
    }): Promise<{ id: string; name: string }> => createLorebook({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.all });
    },
  });
}

export function useUpdateLorebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      name?: string;
      description?: string | null;
      config?: LoreConfig;
    }): Promise<Lorebook> => updateLorebook({ data: input }),
    onSuccess: (lorebook) => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.all });
      queryClient.setQueryData<Lorebook>(lorebookKeys.detail(lorebook.id), lorebook);
    },
  });
}

export function useDeleteLorebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }): Promise<{ id: string }> => deleteLorebook({ data: input }),
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.all });
      queryClient.removeQueries({ queryKey: lorebookKeys.detail(id) });
      queryClient.removeQueries({ queryKey: lorebookKeys.entries(id) });
    },
  });
}

export function useImportLorebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      content: string;
    }): Promise<{
      id: string;
      name: string;
      entriesInserted: number;
      entriesSkipped: number;
    }> => importLorebook({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.list() });
    },
  });
}

export function useLorebookEntries(lorebookId: string) {
  return useQuery({
    queryKey: lorebookKeys.entries(lorebookId),
    queryFn: () => listLorebookEntries({ data: { lorebookId } }),
    enabled: lorebookId.length > 0,
  });
}

export function useCreateLorebookEntry(lorebookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      comment: string;
      content: string;
      key: string[];
      keysecondary?: string[];
    }): Promise<{ id: string; uid: number }> =>
      createLorebookEntry({ data: { lorebookId, ...input } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.entries(lorebookId) });
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.list() });
    },
  });
}

export function useUpdateLorebookEntry(lorebookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      entryId: string;
      data: LoreEntry["data"];
      uid?: number;
    }): Promise<LoreEntry> => updateLorebookEntry({ data: { lorebookId, ...input } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.entries(lorebookId) });
    },
  });
}

export function useDeleteLorebookEntry(lorebookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { entryId: string }): Promise<{ id: string }> =>
      deleteLorebookEntry({ data: { lorebookId, entryId: input.entryId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.entries(lorebookId) });
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.list() });
    },
  });
}

export function useToggleLorebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      lorebookId: string;
      enabled: boolean;
    }): Promise<{
      lorebookId: string;
      enabled: boolean;
    }> => setLorebookEnabled({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ["chatConfig"] });
    },
  });
}

export function useToggleLoreEntry(lorebookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      entryId: string;
      disabled: boolean;
    }): Promise<{
      entryId: string;
      disabled: boolean;
    }> => setLoreEntryDisabled({ data: { lorebookId, ...input } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.entries(lorebookId) });
      void queryClient.invalidateQueries({ queryKey: ["chatConfig"] });
    },
  });
}
