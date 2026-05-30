DELETE FROM "magic_link_tokens";--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD COLUMN "lookup_hash" text NOT NULL;--> statement-breakpoint
CREATE INDEX "magic_link_tokens_lookup_hash_idx" ON "magic_link_tokens" USING btree ("lookup_hash");
