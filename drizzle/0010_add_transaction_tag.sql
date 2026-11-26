ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "tag" varchar(80);
CREATE INDEX IF NOT EXISTS "idx_tx_user_tag" ON "transactions" USING btree ("user_id","tag") WHERE "tag" IS NOT NULL;
