CREATE TABLE "studios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"capacity" integer NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "studios_capacity_in_range" CHECK ("studios"."capacity" between 1 and 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "studios_active_name_unique" ON "studios" USING btree (lower("name")) WHERE not "studios"."archived";