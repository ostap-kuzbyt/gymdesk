import { tariffView } from "@gymdesk/shared";
import type { NewTariffInput, TariffView } from "@gymdesk/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useApi } from "@/lib/api-context";

export const tariffKeys = { all: ["tariffs"] as const };

export function useTariffs(includeArchived: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: [...tariffKeys.all, { includeArchived }],
    queryFn: () => api.get(z.array(tariffView), "/api/tariffs", { includeArchived }),
  });
}

export function useSaveTariff(existing?: TariffView) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NewTariffInput) =>
      existing
        ? api.patch(tariffView, `/api/tariffs/${existing.id}`, {
            ...input,
            version: existing.version,
          })
        : api.post(tariffView, "/api/tariffs", input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: tariffKeys.all }),
  });
}

export function useArchiveTariff() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tariff: TariffView) => api.post(tariffView, `/api/tariffs/${tariff.id}/archive`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: tariffKeys.all }),
  });
}
