import type { Clock } from "../../platform/clock.js";
import { addDays, daysBetween } from "../../platform/dates.js";
import type { Db } from "../../platform/db/client.js";
import { withTx } from "../../platform/db/tx.js";
import { ConflictError, DomainError, NotFoundError } from "../../platform/errors.js";
import type { Mailer } from "../../platform/mailer.js";
import type { MemberService } from "../members/member.service.js";
import { Reminder } from "./reminder.js";
import type { ReminderKind, ReminderSnapshot, ReminderStatus } from "./reminder.js";
import { reminderRepo } from "./reminder.repo.js";
import { expiryEmail, promoEmail } from "./reminder.templates.js";
import type { EmailContent } from "./reminder.templates.js";

export interface ReminderSettings {
  clubName: string;
  daysBefore: number;
  discountPercent: number;
}

export interface ReminderDetails extends ReminderSnapshot {
  memberName: string;
}

export interface ReminderPage {
  items: ReminderDetails[];
  total: number;
}

export interface ScanResult {
  date: string;
  considered: number;
  sent: number;
  failed: number;
  skipped: number;
}

export class ReminderService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly mailer: Mailer,
    private readonly members: MemberService,
    private readonly settings: ReminderSettings,
  ) {}

  async scanExpiring(): Promise<ScanResult> {
    const today = this.clock.today();
    const candidates = await this.members.findExpiring(
      today,
      addDays(today, this.settings.daysBefore),
    );
    const result: ScanResult = {
      date: today,
      considered: candidates.length,
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    for (const candidate of candidates) {
      const reminder = await this.claim(candidate);
      if (!reminder) {
        result.skipped += 1;
        continue;
      }

      const content = expiryEmail({
        clubName: this.settings.clubName,
        memberName: candidate.fullName,
        endsOn: candidate.endsOn,
        daysLeft: daysBetween(today, candidate.endsOn),
      });
      const delivered = await this.deliver(reminder, content);
      if (delivered) result.sent += 1;
      else result.failed += 1;
    }

    return result;
  }

  async sendManual(memberId: string, kind: ReminderKind): Promise<ReminderDetails> {
    const today = this.clock.today();
    const context = await this.members.reminderContext(memberId);

    let reminder: Reminder;
    let content: EmailContent;
    if (kind === "promo") {
      reminder = Reminder.promo({ memberId, email: context.email }, this.clock.now().toISOString());
      content = promoEmail({
        clubName: this.settings.clubName,
        memberName: context.fullName,
        discountPercent: this.settings.discountPercent,
      });
    } else {
      const current = context.subscriptions
        .filter((subscription) => subscription.startsOn <= today && subscription.endsOn >= today)
        .sort((a, b) => b.endsOn.localeCompare(a.endsOn))[0];
      if (!current) throw new DomainError("The member has no active subscription to remind about");

      reminder = Reminder.expiry(
        { memberId, subscriptionId: current.id, email: context.email, trigger: "manual" },
        this.clock.now().toISOString(),
      );
      content = expiryEmail({
        clubName: this.settings.clubName,
        memberName: context.fullName,
        endsOn: current.endsOn,
        daysLeft: daysBetween(today, current.endsOn),
      });
    }

    await withTx(this.db, (tx) => reminderRepo.insert(tx, reminder));
    await this.deliver(reminder, content);
    return this.detailsOf(reminder);
  }

  async retry(id: string): Promise<ReminderDetails> {
    const reminder = await reminderRepo.findById(this.db, id);
    if (!reminder) throw new NotFoundError("Reminder was not found");

    const snapshot = reminder.toSnapshot();
    const context = await this.members.reminderContext(snapshot.memberId);
    const today = this.clock.today();

    let content: EmailContent;
    if (snapshot.kind === "promo") {
      content = promoEmail({
        clubName: this.settings.clubName,
        memberName: context.fullName,
        discountPercent: this.settings.discountPercent,
      });
    } else {
      const subscription = context.subscriptions.find(
        (item) => item.id === snapshot.subscriptionId,
      );
      if (!subscription || subscription.endsOn < today) {
        throw new DomainError(
          "The subscription is no longer active, so there is nothing to remind about",
        );
      }
      content = expiryEmail({
        clubName: this.settings.clubName,
        memberName: context.fullName,
        endsOn: subscription.endsOn,
        daysLeft: daysBetween(today, subscription.endsOn),
      });
    }

    reminder.retry();
    await reminderRepo.save(this.db, reminder);
    await this.deliver(reminder, content);
    return this.detailsOf(reminder);
  }

  async list(filter: {
    status?: ReminderStatus | undefined;
    kind?: ReminderKind | undefined;
    memberId?: string | undefined;
    limit: number;
    offset: number;
  }): Promise<ReminderPage> {
    const { reminders, total } = await reminderRepo.list(this.db, filter);
    const names = await this.members.names(reminders.map((item) => item.toSnapshot().memberId));
    return {
      items: reminders.map((item) => {
        const snapshot = item.toSnapshot();
        return { ...snapshot, memberName: names.get(snapshot.memberId) ?? "Unknown member" };
      }),
      total,
    };
  }

  private async claim(candidate: {
    memberId: string;
    subscriptionId: string;
    email: string;
  }): Promise<Reminder | undefined> {
    const existing = await reminderRepo.findScanExpiry(this.db, candidate.subscriptionId);
    if (existing) {
      if (existing.status !== "failed") return undefined;
      existing.retry();
      await reminderRepo.save(this.db, existing);
      return existing;
    }

    try {
      const reminder = Reminder.expiry(
        {
          memberId: candidate.memberId,
          subscriptionId: candidate.subscriptionId,
          email: candidate.email,
          trigger: "scan",
        },
        this.clock.now().toISOString(),
      );
      await withTx(this.db, (tx) => reminderRepo.insert(tx, reminder));
      return reminder;
    } catch (error) {
      if (error instanceof ConflictError || error instanceof DomainError) return undefined;
      throw error;
    }
  }

  private async deliver(reminder: Reminder, content: EmailContent): Promise<boolean> {
    let delivered = false;
    try {
      await this.mailer.send({ to: reminder.toSnapshot().email, ...content });
      reminder.markSent(this.clock.now().toISOString());
      delivered = true;
    } catch (error) {
      reminder.markFailed(error instanceof Error ? error.message : "Unknown delivery error");
    }
    await reminderRepo.save(this.db, reminder);
    return delivered;
  }

  private async detailsOf(reminder: Reminder): Promise<ReminderDetails> {
    const snapshot = reminder.toSnapshot();
    const names = await this.members.names([snapshot.memberId]);
    return { ...snapshot, memberName: names.get(snapshot.memberId) ?? "Unknown member" };
  }
}
