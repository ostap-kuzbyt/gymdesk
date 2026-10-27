import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useCoaches } from "@/features/coaches/api";
import { messageOf } from "@/lib/errors";
import { useAssignCoach } from "./api";

export function CoachSelect({
  memberId,
  coachId,
  editable,
}: {
  memberId: string;
  coachId: string | null;
  editable: boolean;
}) {
  const coaches = useCoaches();
  const assign = useAssignCoach(memberId);
  const current = coaches.data?.find((coach) => coach.id === coachId);

  if (!editable) {
    return <span>{coachId === null ? "No coach" : (current?.fullName ?? "Assigned coach")}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="member-coach" className="sr-only">
        Coach
      </Label>
      <NativeSelect
        id="member-coach"
        size="sm"
        value={coachId ?? ""}
        disabled={coaches.isPending || assign.isPending}
        onChange={(event) => {
          const next = event.target.value === "" ? null : event.target.value;
          assign.mutate(next, {
            onSuccess: () => toast.success(next === null ? "Coach removed" : "Coach assigned"),
            onError: (error) =>
              toast.error("Coach was not changed", { description: messageOf(error) }),
          });
        }}
      >
        <NativeSelectOption value="">No coach</NativeSelectOption>
        {coaches.data?.map((coach) => (
          <NativeSelectOption key={coach.id} value={coach.id}>
            {coach.fullName}
          </NativeSelectOption>
        ))}
        {coachId !== null && !current && coaches.data ? (
          <NativeSelectOption value={coachId}>Assigned coach</NativeSelectOption>
        ) : null}
      </NativeSelect>
    </div>
  );
}
