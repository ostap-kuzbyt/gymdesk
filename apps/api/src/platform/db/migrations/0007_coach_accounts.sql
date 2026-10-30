ALTER TABLE "coaches" ADD COLUMN "auth_subject" text;--> statement-breakpoint
CREATE UNIQUE INDEX "coaches_auth_subject_unique" ON "coaches" USING btree ("auth_subject");