ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "chk_wallets_type";--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "chk_wallets_type" CHECK ("wallets"."type" IN ('cash', 'bank', 'credit_card', 'ewallet', 'savings_goal', 'investment'));
