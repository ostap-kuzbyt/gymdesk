CREATE TABLE "tariffs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"visit_limit" integer,
	"archived" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tariffs_price_non_negative" CHECK ("tariffs"."price_cents" >= 0),
	CONSTRAINT "tariffs_duration_in_range" CHECK ("tariffs"."duration_days" between 1 and 732),
	CONSTRAINT "tariffs_visit_limit_positive" CHECK ("tariffs"."visit_limit" is null or "tariffs"."visit_limit" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tariffs_active_name_unique" ON "tariffs" USING btree (lower("name")) WHERE not "tariffs"."archived";