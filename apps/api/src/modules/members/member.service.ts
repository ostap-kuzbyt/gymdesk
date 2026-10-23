import type { Clock } from "../../platform/clock.js";
import type { Db } from "../../platform/db/client.js";
import { withTx } from "../../platform/db/tx.js";
import { ConflictError, DomainError, NotFoundError } from "../../platform/errors.js";
import type { CoachService } from "../coaches/coach.service.js";
import type { TariffService } from "../tariffs/tariff.service.js";
import type { CheckIn } from "./check-in.js";
import { Member, ageOn } from "./member.js";
import type { MemberChanges, MemberSnapshot, NewMember } from "./member.js";
import { memberRepo } from "./member.repo.js";
import { statusOn } from "./subscription.js";
import type { Subscription, SubscriptionStatus } from "./subscription.js";

export interface MemberDetails extends Omit<MemberSnapshot, "subscriptions"> {
  age: number;
  subscriptions: (Subscription & { status: SubscriptionStatus })[];
}

export interface MemberListItem {
  id: string;
  fullName: string;
  age: number;
  email: string;
  phone: string | null;
  activeUntil: string | null;
}

export interface MemberPage {
  items: MemberListItem[];
  total: number;
}

export interface CheckInDetails extends CheckIn {
  checkedInAt: string;
}

export interface VisitItem {
  id: string;
  subscriptionId: string;
  visitDate: string;
  checkedInAt: string;
}

export interface VisitPage {
  items: VisitItem[];
  total: number;
}

export interface PageQuery {
  q?: string | undefined;
  limit: number;
  offset: number;
}

export class MemberService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly tariffs: TariffService,
    private readonly coaches: CoachService,
  ) {}

  register(input: NewMember): Promise<MemberDetails> {
    const today = this.clock.today();
    const member = Member.register(input, today);
    return withTx(this.db, async (tx) => {
      await memberRepo.insert(tx, member);
      return this.details(member, today);
    });
  }

  async get(id: string): Promise<MemberDetails> {
    const member = await memberRepo.findById(this.db, id);
    if (!member) throw new NotFoundError("Member was not found");
    return this.details(member, this.clock.today());
  }

  update(id: string, expectedVersion: number, changes: MemberChanges): Promise<MemberDetails> {
    return this.modify(id, (member, today) => {
      if (member.version !== expectedVersion) {
        throw new ConflictError("The member was changed by someone else, reload and try again");
      }
      member.updateProfile(changes, today);
    });
  }

  async purchaseSubscription(
    memberId: string,
    request: { tariffId: string; startsOn?: string | undefined },
  ): Promise<MemberDetails> {
    const startsOn = request.startsOn ?? this.clock.today();
    if (startsOn < this.clock.today()) {
      throw new DomainError("A subscription cannot start in the past");
    }

    const offer = await this.tariffs.quote(request.tariffId, startsOn);
    return this.modify(memberId, (member) => {
      member.purchase(offer);
    });
  }

  cancelSubscription(memberId: string, subscriptionId: string): Promise<MemberDetails> {
    return this.modify(memberId, (member, today) => {
      member.cancelSubscription(subscriptionId, today);
    });
  }

  async assignCoach(memberId: string, coachId: string | null): Promise<MemberDetails> {
    if (coachId !== null) await this.coaches.requireActive(coachId);
    return this.modify(memberId, (member) => member.assignCoach(coachId));
  }

  async membersOfCoach(coachId: string, page: PageQuery): Promise<MemberPage> {
    await this.coaches.get(coachId);
    return this.search({ ...page, coachId });
  }

  async requireActiveSubscriptionOn(memberId: string, date: string): Promise<void> {
    const member = await memberRepo.findById(this.db, memberId);
    if (!member) throw new NotFoundError("Member was not found");

    const covered = member
      .toSnapshot()
      .subscriptions.some((subscription) => statusOn(subscription, date) === "active");
    if (!covered) {
      throw new DomainError(`The member has no active subscription on ${date}`);
    }
  }

  names(ids: string[]): Promise<Map<string, string>> {
    return memberRepo.namesByIds(this.db, ids);
  }

  checkIn(memberId: string): Promise<CheckInDetails> {
    const today = this.clock.today();
    const checkedInAt = this.clock.now();
    return withTx(this.db, async (tx) => {
      const member = await memberRepo.findById(tx, memberId);
      if (!member) throw new NotFoundError("Member was not found");

      const usage = await memberRepo.visitUsage(tx, memberId, today);
      const visit = member.checkIn(today, usage);
      await memberRepo.insertCheckIn(tx, visit, checkedInAt);

      return { ...visit, checkedInAt: checkedInAt.toISOString() };
    });
  }

  async visits(memberId: string, page: { limit: number; offset: number }): Promise<VisitPage> {
    if (!(await memberRepo.exists(this.db, memberId))) {
      throw new NotFoundError("Member was not found");
    }
    const { rows, total } = await memberRepo.visits(this.db, memberId, page);
    return {
      items: rows.map((row) => ({ ...row, checkedInAt: row.checkedInAt.toISOString() })),
      total,
    };
  }

  async search(options: PageQuery & { coachId?: string | undefined }): Promise<MemberPage> {
    const today = this.clock.today();
    const { rows, total } = await memberRepo.search(this.db, {
      q: options.q,
      coachId: options.coachId,
      limit: options.limit,
      offset: options.offset,
      today,
    });
    return {
      items: rows.map(({ birthDate, ...row }) => ({ ...row, age: ageOn(birthDate, today) })),
      total,
    };
  }

  private modify(
    id: string,
    apply: (member: Member, today: string) => void,
  ): Promise<MemberDetails> {
    const today = this.clock.today();
    return withTx(this.db, async (tx) => {
      const member = await memberRepo.findById(tx, id);
      if (!member) throw new NotFoundError("Member was not found");

      apply(member, today);
      await memberRepo.save(tx, member);

      const saved = await memberRepo.findById(tx, id);
      return this.details(saved ?? member, today);
    });
  }

  private details(member: Member, today: string): MemberDetails {
    const { subscriptions, ...profile } = member.toSnapshot();
    return {
      ...profile,
      age: ageOn(profile.birthDate, today),
      subscriptions: subscriptions.map((subscription) => ({
        ...subscription,
        status: statusOn(subscription, today),
      })),
    };
  }
}
