import { attendanceReport } from "@gymdesk/shared";
import { useQuery } from "@tanstack/react-query";
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
  });
}
