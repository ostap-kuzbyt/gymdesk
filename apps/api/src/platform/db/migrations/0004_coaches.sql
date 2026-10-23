CREATE TABLE "coaches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"specialization" text NOT NULL,
	"weekly_hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "coach_id" uuid;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "members_coach_idx" ON "members" USING btree ("coach_id");