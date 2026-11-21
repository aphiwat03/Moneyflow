ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "recipient_name" varchar(120);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "recipient_bank" varchar(60);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "recipient_account" varchar(64);
