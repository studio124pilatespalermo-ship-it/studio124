CREATE TYPE "public"."locale_code" AS ENUM('es', 'en', 'pt');--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "locale" "locale_code" DEFAULT 'es' NOT NULL;