import { keepPreviousData, useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import type { Character } from "@/db/schema";
import type { CharacterDataV2 } from "@/lib/st-core/character";
import {
  deleteCharacter,
  getCharacter,
  importCharacter,
  searchCharacters,
  characterTagCounts,
  updateCharacter,
  updateCharacterData,
  type ImportResult,
} from "@/server/fns/characters";

export const characterKeys = {
  all: ["characters"] as const,
  search: (params: { q?: string; tags?: string[]; sort?: string }) =>
    [...characterKeys.all, "search", params] as const,
  tagCounts: () => [...characterKeys.all, "tagCounts"] as const,
  detail: (id: string) => [...characterKeys.all, "detail", id] as const,
};

const PAGE_SIZE = 60;

export function useCharacterSearch(params: {
  q?: string;
  tags?: string[];
  sort?: "name-asc" | "chats-desc" | "updatedAt-desc";
}) {
  return useInfiniteQuery({
    queryKey: characterKeys.search(params),
    queryFn: ({ pageParam }) =>
      searchCharacters({
        data: {
          q: params.q,
          tags: params.tags?.join(","),
          sort: params.sort,
          offset: String(pageParam),
          limit: String(PAGE_SIZE),
        },
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

export function useCharacterTagCounts() {
  return useQuery({
    queryKey: characterKeys.tagCounts(),
    queryFn: () => characterTagCounts(),
    staleTime: 60_000,
  });
}

export function useCharacter(id: string) {
  return useQuery({
    queryKey: characterKeys.detail(id),
    queryFn: () => getCharacter({ data: { id } }),
    enabled: id.length > 0,
  });
}

export function useImportCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { pngBase64: string }): Promise<ImportResult> =>
      importCharacter({ data: input }),
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: characterKeys.all });
      }
    },
  });
}

export function useUpdateCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }): Promise<Character> =>
      updateCharacter({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.all });
      // Refetch the detail to get fresh stats (chatCount, messageCount)
      void queryClient.invalidateQueries({ queryKey: characterKeys.detail(variables.id) });
    },
  });
}

export function useUpdateCharacterData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      data: CharacterDataV2;
      tagline?: string | null;
    }): Promise<Character> => updateCharacterData({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.all });
      void queryClient.invalidateQueries({ queryKey: characterKeys.detail(variables.id) });
    },
  });
}

export function useDeleteCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }): Promise<{ id: string }> =>
      deleteCharacter({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.all });
    },
  });
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}
