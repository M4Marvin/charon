import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPersona,
  deletePersona,
  getPersona,
  listPersonas,
  updatePersona,
  type PersonaListItem,
} from "@/server/fns/personas";

export const personaKeys = {
  all: ["personas"] as const,
  list: () => [...personaKeys.all, "list"] as const,
  detail: (id: string) => [...personaKeys.all, "detail", id] as const,
};

export function usePersonas() {
  return useQuery({
    queryKey: personaKeys.list(),
    queryFn: () => listPersonas(),
  });
}

export function usePersona(id: string) {
  return useQuery({
    queryKey: personaKeys.detail(id),
    queryFn: () => getPersona({ data: { id } }),
    enabled: id.length > 0,
  });
}

export function useCreatePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      description?: string;
      iconPath?: string;
    }): Promise<{ id: string }> => createPersona({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: personaKeys.all });
    },
  });
}

export function useUpdatePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      name?: string;
      description?: string | null;
      iconPath?: string | null;
    }): Promise<{ id: string }> => updatePersona({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: personaKeys.all });
      queryClient.removeQueries({ queryKey: personaKeys.detail(variables.id) });
    },
  });
}

export function useDeletePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }): Promise<{ id: string }> =>
      deletePersona({ data: input }),
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: personaKeys.all });
      queryClient.removeQueries({ queryKey: personaKeys.detail(id) });
    },
  });
}

export type { PersonaListItem };
