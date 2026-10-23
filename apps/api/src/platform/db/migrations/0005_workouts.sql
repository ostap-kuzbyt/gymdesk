CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workout_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"reserved_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"studio_id" uuid NOT NULL,
	"coach_id" uuid NOT NULL,
	"workout_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"capacity" integer NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workouts_kind_known" CHECK ("workouts"."kind" in ('group', 'individual')),
	CONSTRAINT "workouts_capacity_positive" CHECK ("workouts"."capacity" >= 1),
	CONSTRAINT "workouts_time_ordered" CHECK ("workouts"."end_time" > "workouts"."start_time")
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_active_member_unique" ON "reservations" USING btree ("workout_id","member_id") WHERE "reservations"."cancelled_at" is null;--> statement-breakpoint
CREATE INDEX "reservations_member_idx" ON "reservations" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "workouts_date_idx" ON "workouts" USING btree ("workout_date");--> statement-breakpoint
CREATE INDEX "workouts_coach_idx" ON "workouts" USING btree ("coach_id");--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_studio_no_overlap" EXCLUDE USING gist ("studio_id" WITH =, tsrange("workout_date" + "start_time", "workout_date" + "end_time") WITH &&) WHERE (NOT "cancelled");--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_coach_no_overlap" EXCLUDE USING gist ("coach_id" WITH =, tsrange("workout_date" + "start_time", "workout_date" + "end_time") WITH &&) WHERE (NOT "cancelled");
