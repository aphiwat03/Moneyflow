CREATE TABLE "investment_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"target_goal_amount" numeric(14, 2) DEFAULT '2000000.00' NOT NULL,
	"starting_principal" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"monthly_dca" numeric(12, 2) DEFAULT '3000.00' NOT NULL,
	"expected_annual_return_pct" numeric(5, 2) DEFAULT '8.00' NOT NULL,
	"horizon_years" integer DEFAULT 15 NOT NULL,
	"annual_dca_step_up_pct" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"reinvest_dividends" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_inv_settings_goal_nonneg" CHECK ("investment_settings"."target_goal_amount" >= 0),
	CONSTRAINT "chk_inv_settings_principal_nonneg" CHECK ("investment_settings"."starting_principal" >= 0),
	CONSTRAINT "chk_inv_settings_dca_nonneg" CHECK ("investment_settings"."monthly_dca" >= 0),
	CONSTRAINT "chk_inv_settings_return_range" CHECK ("investment_settings"."expected_annual_return_pct" >= 0 AND "investment_settings"."expected_annual_return_pct" <= 50),
	CONSTRAINT "chk_inv_settings_horizon_range" CHECK ("investment_settings"."horizon_years" >= 1 AND "investment_settings"."horizon_years" <= 50),
	CONSTRAINT "chk_inv_settings_stepup_range" CHECK ("investment_settings"."annual_dca_step_up_pct" >= 0 AND "investment_settings"."annual_dca_step_up_pct" <= 30)
);
--> statement-breakpoint
CREATE TABLE "investment_holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" varchar(30) NOT NULL,
	"name" varchar(120) NOT NULL,
	"asset_type" varchar(20) NOT NULL,
	"target_allocation_pct" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"expected_annual_return_pct" numeric(5, 2) DEFAULT '8.00' NOT NULL,
	"invested_cost" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"current_value" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"dividends_received" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"units" numeric(18, 6),
	"currency" varchar(10) DEFAULT 'THB' NOT NULL,
	"broker" varchar(60),
	"note" text,
	"color" varchar(20) DEFAULT '#0f766e' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_inv_holding_asset_type" CHECK ("investment_holdings"."asset_type" IN ('etf', 'stock', 'mutual_fund', 'gold_bond', 'other')),
	CONSTRAINT "chk_inv_holding_currency" CHECK ("investment_holdings"."currency" IN ('THB', 'USD')),
	CONSTRAINT "chk_inv_holding_alloc_range" CHECK ("investment_holdings"."target_allocation_pct" >= 0 AND "investment_holdings"."target_allocation_pct" <= 100),
	CONSTRAINT "chk_inv_holding_return_range" CHECK ("investment_holdings"."expected_annual_return_pct" >= 0 AND "investment_holdings"."expected_annual_return_pct" <= 50),
	CONSTRAINT "chk_inv_holding_cost_nonneg" CHECK ("investment_holdings"."invested_cost" >= 0),
	CONSTRAINT "chk_inv_holding_value_nonneg" CHECK ("investment_holdings"."current_value" >= 0),
	CONSTRAINT "chk_inv_holding_div_nonneg" CHECK ("investment_holdings"."dividends_received" >= 0),
	CONSTRAINT "chk_inv_holding_units_nonneg" CHECK ("investment_holdings"."units" IS NULL OR "investment_holdings"."units" >= 0)
);
--> statement-breakpoint
CREATE TABLE "investment_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month_key" varchar(7) NOT NULL,
	"invested_cost" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"market_value" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"dividends" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_inv_snapshots_user_month" UNIQUE("user_id","month_key"),
	CONSTRAINT "chk_inv_snap_cost_nonneg" CHECK ("investment_snapshots"."invested_cost" >= 0),
	CONSTRAINT "chk_inv_snap_val_nonneg" CHECK ("investment_snapshots"."market_value" >= 0),
	CONSTRAINT "chk_inv_snap_div_nonneg" CHECK ("investment_snapshots"."dividends" >= 0)
);
--> statement-breakpoint
CREATE TABLE "investment_dca_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"holding_id" uuid NOT NULL,
	"transaction_id" uuid,
	"executed_date" date NOT NULL,
	"amount_thb" numeric(12, 2) NOT NULL,
	"units_bought" numeric(18, 6),
	"price_per_unit" numeric(14, 4),
	"fee_thb" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_inv_dca_amount_positive" CHECK ("investment_dca_logs"."amount_thb" > 0),
	CONSTRAINT "chk_inv_dca_fee_nonneg" CHECK ("investment_dca_logs"."fee_thb" >= 0),
	CONSTRAINT "chk_inv_dca_units_nonneg" CHECK ("investment_dca_logs"."units_bought" IS NULL OR "investment_dca_logs"."units_bought" >= 0),
	CONSTRAINT "chk_inv_dca_price_nonneg" CHECK ("investment_dca_logs"."price_per_unit" IS NULL OR "investment_dca_logs"."price_per_unit" >= 0)
);
--> statement-breakpoint
ALTER TABLE "investment_settings" ADD CONSTRAINT "investment_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "investment_snapshots" ADD CONSTRAINT "investment_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "investment_dca_logs" ADD CONSTRAINT "investment_dca_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "investment_dca_logs" ADD CONSTRAINT "investment_dca_logs_holding_id_investment_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."investment_holdings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "investment_dca_logs" ADD CONSTRAINT "investment_dca_logs_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_inv_holdings_user_sort" ON "investment_holdings" USING btree ("user_id","sort_order","created_at");
--> statement-breakpoint
CREATE INDEX "idx_inv_snapshots_user_month" ON "investment_snapshots" USING btree ("user_id","month_key");
--> statement-breakpoint
CREATE INDEX "idx_inv_dca_logs_user_date" ON "investment_dca_logs" USING btree ("user_id","executed_date");
--> statement-breakpoint
CREATE INDEX "idx_inv_dca_logs_holding" ON "investment_dca_logs" USING btree ("holding_id");
--> statement-breakpoint
CREATE TRIGGER trg_investment_settings_updated_at
    BEFORE UPDATE ON investment_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_investment_holdings_updated_at
    BEFORE UPDATE ON investment_holdings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_investment_snapshots_updated_at
    BEFORE UPDATE ON investment_snapshots
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
