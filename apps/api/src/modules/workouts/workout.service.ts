import type { Clock } from "../../platform/clock.js";
import type { Db } from "../../platform/db/client.js";
import { withTx } from "../../platform/db/tx.js";
import { DomainError, NotFoundError } from "../../platform/errors.js";
import type { CoachService } from "../coaches/coach.service.js";
import type { MemberService } from "../members/member.service.js";
import type { StudioService } from "../studios/studio.service.js";
import { Workout } from "./workout.js";
import type { NewWorkout, Reservation, WorkoutSnapshot } from "./workout.js";
import { workoutRepo } from "./workout.repo.js";
import type { WorkoutFilter, WorkoutListRow } from "./workout.repo.js";

export interface ReservationDetails extends Reservation {
  memberName: string;
}

export interface WorkoutDetails extends Omit<WorkoutSnapshot, "reservations"> {
  reserved: number;
  spotsLeft: number;
  reservations: ReservationDetails[];
}

export class WorkoutService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly studios: StudioService,
    private readonly coaches: CoachService,
    private readonly members: MemberService,
  ) {}

  list(filter: WorkoutFilter): Promise<WorkoutListRow[]> {
    return workoutRepo.list(this.db, filter);
  }

  async get(id: string): Promise<WorkoutDetails> {
    const workout = await workoutRepo.findById(this.db, id);
    if (!workout) throw new NotFoundError("Workout was not found");
    return this.details(workout);
  }

  async schedule(input: NewWorkout): Promise<WorkoutDetails> {
    const studio = await this.studios.requireActive(input.studioId);
    const workout = Workout.schedule(input, studio.capacity, this.clock.moment());
    await this.coaches.requireAvailable(input.coachId, input.date, input.startTime, input.endTime);

    await withTx(this.db, async (tx) => {
      const clash = await workoutRepo.findClash(tx, input);
      if (clash === "studio") throw new DomainError("The studio is already booked at that time");
      if (clash === "coach") throw new DomainError("The coach already has a workout at that time");
      await workoutRepo.insert(tx, workout);
    });
    return this.details(workout);
  }

  cancel(id: string): Promise<WorkoutDetails> {
    return this.modify(id, (workout, now) => workout.cancel(now));
  }

  async reserve(workoutId: string, memberId: string): Promise<WorkoutDetails> {
    const current = await this.get(workoutId);
    await this.members.requireActiveSubscriptionOn(memberId, current.date);
    return this.modify(workoutId, (workout, now) => {
      workout.reserve(memberId, now);
    });
  }

  cancelReservation(workoutId: string, reservationId: string): Promise<WorkoutDetails> {
    return this.modify(workoutId, (workout, now) => workout.cancelReservation(reservationId, now));
  }

  private modify(
    id: string,
    apply: (workout: Workout, now: ReturnType<Clock["moment"]>) => void,
  ): Promise<WorkoutDetails> {
    const now = this.clock.moment();
    return withTx(this.db, async (tx) => {
      const workout = await workoutRepo.findById(tx, id);
      if (!workout) throw new NotFoundError("Workout was not found");

      apply(workout, now);
      await workoutRepo.save(tx, workout);

      return (await workoutRepo.findById(tx, id)) ?? workout;
    }).then((workout) => this.details(workout));
  }

  private async details(workout: Workout): Promise<WorkoutDetails> {
    const { reservations, ...rest } = workout.toSnapshot();
    const names = await this.members.names(reservations.map((item) => item.memberId));
    return {
      ...rest,
      reserved: reservations.filter((item) => item.cancelledAt === null).length,
      spotsLeft: workout.spotsLeft,
      reservations: reservations.map((item) => ({
        ...item,
        memberName: names.get(item.memberId) ?? "Unknown member",
      })),
    };
  }
}
