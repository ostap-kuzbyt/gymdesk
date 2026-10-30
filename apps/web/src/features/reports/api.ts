import { attendanceReport, loadReport, revenueReport } from "@gymdesk/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api-context";

export const reportKeys = { all: ["reports"] as const };

export function useAttendance(options: {
  from: string;
  to: string;
  limit: number;
  offset: number;
}) {
  const api = useApi();
  return useQuery({
    queryKey: [...reportKeys.all, "attendance", options],
    queryFn: () => api.get(attendanceReport, "/api/reports/attendance", options),
    placeholderData: keepPreviousData,
  });
}

export function useRevenue(options: {
  from: string;
  to: string;
  granularity: "month" | "year";
  enabled: boolean;
}) {
  const api = useApi();
  const { enabled, ...query } = options;
  return useQuery({
    queryKey: [...reportKeys.all, "revenue", query],
    queryFn: () => api.get(revenueReport, "/api/reports/revenue", query),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useLoad(options: { from: string; to: string }) {
  const api = useApi();
  return useQuery({
    queryKey: [...reportKeys.all, "load", options],
    queryFn: () => api.get(loadReport, "/api/reports/load", options),
    placeholderData: keepPreviousData,
  });
}
