CREATE TABLE "check_ins" (
	"id" uuid PRIMARY KEY NOT NULL,
	"member_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"visit_date" date NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"birth_date" date NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"member_id" uuid NOT NULL,
	"tariff_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"price_cents" integer NOT NULL,
	"visit_limit" integer,
	"cancelled_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_dates_ordered" CHECK ("subscriptions"."ends_on" >= "subscriptions"."starts_on"),
	CONSTRAINT "subscriptions_price_non_negative" CHECK ("subscriptions"."price_cents" >= 0),
	CONSTRAINT "subscriptions_visit_limit_positive" CHECK ("subscriptions"."visit_limit" is null or "subscriptions"."visit_limit" >= 1)
);
--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "check_ins_member_day_unique" ON "check_ins" USING btree ("member_id","visit_date");--> statement-breakpoint
CREATE INDEX "check_ins_subscription_idx" ON "check_ins" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "check_ins_visit_date_idx" ON "check_ins" USING btree ("visit_date");--> statement-breakpoint
CREATE UNIQUE INDEX "members_email_unique" ON "members" USING btree ("email");--> statement-breakpoint
CREATE INDEX "subscriptions_member_idx" ON "subscriptions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "subscriptions_ends_on_idx" ON "subscriptions" USING btree ("ends_on");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_no_overlap" EXCLUDE USING gist ("member_id" WITH =, daterange("starts_on", "ends_on", '[]') WITH &&) WHERE ("cancelled_on" IS NULL);
