CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"member_id" uuid NOT NULL,
	"subscription_id" uuid,
	"kind" text NOT NULL,
	"trigger" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "reminders_kind_known" CHECK ("reminders"."kind" in ('expiry', 'promo')),
	CONSTRAINT "reminders_trigger_known" CHECK ("reminders"."trigger" in ('scan', 'manual')),
	CONSTRAINT "reminders_status_known" CHECK ("reminders"."status" in ('pending', 'sent', 'failed')),
	CONSTRAINT "reminders_expiry_has_subscription" CHECK ("reminders"."kind" <> 'expiry' or "reminders"."subscription_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reminders_scan_expiry_unique" ON "reminders" USING btree ("subscription_id") WHERE "reminders"."kind" = 'expiry' and "reminders"."trigger" = 'scan';--> statement-breakpoint
CREATE INDEX "reminders_member_idx" ON "reminders" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "reminders_created_idx" ON "reminders" USING btree ("created_at");