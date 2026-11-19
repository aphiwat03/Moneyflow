CREATE TABLE "salary_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"bucket_type" varchar(20) NOT NULL,
	"mode" varchar(10) NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"target_total" numeric(12, 2),
	"target_months" integer,
	"linked_wallet_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_alloc_bucket_type" CHECK ("salary_allocations"."bucket_type" IN ('cold_money', 'dca', 'wishlist', 'other')),
	CONSTRAINT "chk_alloc_mode" CHECK ("salary_allocations"."mode" IN ('fixed', 'percent')),
	CONSTRAINT "chk_alloc_value_positive" CHECK ("salary_allocations"."value" > 0),
	CONSTRAINT "chk_alloc_percent_max" CHECK ("salary_allocations"."mode" <> 'percent' OR "salary_allocations"."value" <= 100),
	CONSTRAINT "chk_alloc_target_total" CHECK ("salary_allocations"."target_total" IS NULL OR "salary_allocations"."target_total" > 0),
	CONSTRAINT "chk_alloc_target_months" CHECK ("salary_allocations"."target_months" IS NULL OR ("salary_allocations"."target_months" >= 1 AND "salary_allocations"."target_months" <= 600))
);
--> statement-breakpoint
CREATE TABLE "salary_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"monthly_salary" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"payday" integer DEFAULT 1 NOT NULL,
	"salary_wallet_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_salary_settings_nonnegative" CHECK ("salary_settings"."monthly_salary" >= 0),
	CONSTRAINT "chk_salary_settings_payday" CHECK ("salary_settings"."payday" >= 1 AND "salary_settings"."payday" <= 31)
);
--> statement-breakpoint
ALTER TABLE "salary_allocations" ADD CONSTRAINT "salary_allocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_allocations" ADD CONSTRAINT "salary_allocations_linked_wallet_id_wallets_id_fk" FOREIGN KEY ("linked_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_settings" ADD CONSTRAINT "salary_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_settings" ADD CONSTRAINT "salary_settings_salary_wallet_id_wallets_id_fk" FOREIGN KEY ("salary_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_salary_allocations_user_sort" ON "salary_allocations" USING btree ("user_id","sort_order","created_at");--> statement-breakpoint
CREATE TRIGGER trg_salary_settings_updated_at
    BEFORE UPDATE ON salary_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_salary_allocations_updated_at
    BEFORE UPDATE ON salary_allocations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();