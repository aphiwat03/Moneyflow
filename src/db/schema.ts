import type { AdapterAccountType } from "@auth/core/adapters";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
  passwordHash: text("password_hash"),
  tokenVersion: integer("token_version").default(1).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Named auth_accounts in PostgreSQL so it never collides with financial wallets.
export const authAccounts = pgTable(
  "auth_accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
);

export const authSessions = pgTable("auth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 30 })
      .$type<
        "cash" | "bank" | "credit_card" | "ewallet" | "savings_goal" | "investment"
      >()
      .notNull(),
    initialBalance: numeric("initial_balance", { precision: 12, scale: 2 })
      .default("0.00")
      .notNull(),
    color: varchar("color", { length: 20 }),
    icon: varchar("icon", { length: 50 }),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique("wallets_id_user_id_unique").on(t.id, t.userId),
    check(
      "chk_wallets_type",
      sql`${t.type} IN ('cash', 'bank', 'credit_card', 'ewallet', 'savings_goal', 'investment')`
    ),
    index("idx_wallets_user_archived").on(t.userId, t.isArchived),
  ]
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 10 }).$type<"income" | "expense">().notNull(),
    monthlyBudget: numeric("monthly_budget", { precision: 12, scale: 2 }),
    color: varchar("color", { length: 20 }),
    icon: varchar("icon", { length: 50 }),
    isDefault: boolean("is_default").default(false).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique("categories_id_user_id_type_unique").on(t.id, t.userId, t.type),
    check("chk_categories_type", sql`${t.type} IN ('income', 'expense')`),
    check(
      "chk_categories_budget_positive",
      sql`${t.monthlyBudget} IS NULL OR ${t.monthlyBudget} > 0`
    ),
    index("idx_categories_user_type_archived").on(t.userId, t.type, t.isArchived),
  ]
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletId: uuid("wallet_id").notNull(),
    toWalletId: uuid("to_wallet_id"),
    categoryId: uuid("category_id"),
    type: varchar("type", { length: 10 })
      .$type<"income" | "expense" | "transfer">()
      .notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    transactionDate: date("transaction_date", { mode: "string" }).notNull(),
    transactionTime: varchar("transaction_time", { length: 5 }),
    note: text("note"),
    tag: varchar("tag", { length: 80 }),
    recipientName: varchar("recipient_name", { length: 120 }),
    recipientBank: varchar("recipient_bank", { length: 60 }),
    recipientAccount: varchar("recipient_account", { length: 64 }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.walletId, t.userId],
      foreignColumns: [wallets.id, wallets.userId],
      name: "fk_tx_wallet",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.toWalletId, t.userId],
      foreignColumns: [wallets.id, wallets.userId],
      name: "fk_tx_to_wallet",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.categoryId, t.userId, t.type],
      foreignColumns: [categories.id, categories.userId, categories.type],
      name: "fk_tx_category",
    }).onDelete("restrict"),
    check("chk_tx_type", sql`${t.type} IN ('income', 'expense', 'transfer')`),
    check("chk_tx_amount_positive", sql`${t.amount} > 0`),
    check(
      "chk_tx_type_fields",
      sql`(${t.type} IN ('income', 'expense') AND ${t.categoryId} IS NOT NULL AND ${t.toWalletId} IS NULL) OR (${t.type} = 'transfer' AND ${t.categoryId} IS NULL AND ${t.toWalletId} IS NOT NULL AND ${t.toWalletId} <> ${t.walletId})`
    ),
    index("idx_tx_user_date").on(t.userId, t.transactionDate.desc()),
    index("idx_tx_user_type_date").on(t.userId, t.type, t.transactionDate.desc()),
    index("idx_tx_user_wallet").on(t.userId, t.walletId),
    index("idx_tx_user_to_wallet")
      .on(t.userId, t.toWalletId)
      .where(sql`${t.toWalletId} IS NOT NULL`),
    index("idx_tx_user_category")
      .on(t.userId, t.categoryId)
      .where(sql`${t.categoryId} IS NOT NULL`),
    index("idx_tx_user_tag")
      .on(t.userId, t.tag)
      .where(sql`${t.tag} IS NOT NULL`),
  ]
);

export const salarySettings = pgTable(
  "salary_settings",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    monthlySalary: numeric("monthly_salary", { precision: 12, scale: 2 })
      .default("0.00")
      .notNull(),
    extraIncome: numeric("extra_income", { precision: 12, scale: 2 })
      .default("0.00")
      .notNull(),
    payday: integer("payday").default(1).notNull(),
    salaryWalletId: uuid("salary_wallet_id").references(() => wallets.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    check("chk_salary_settings_nonnegative", sql`${t.monthlySalary} >= 0`),
    check(
      "chk_salary_settings_extra_nonnegative",
      sql`${t.extraIncome} >= 0`
    ),
    check(
      "chk_salary_settings_payday",
      sql`${t.payday} >= 1 AND ${t.payday} <= 31`
    ),
  ]
);

export const salaryAllocations = pgTable(
  "salary_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    bucketType: varchar("bucket_type", { length: 20 })
      .$type<"cold_money" | "dca" | "wishlist" | "other">()
      .notNull(),
    mode: varchar("mode", { length: 10 })
      .$type<"fixed" | "percent">()
      .notNull(),
    value: numeric("value", { precision: 12, scale: 2 }).notNull(),
    targetTotal: numeric("target_total", { precision: 12, scale: 2 }),
    targetMonths: integer("target_months"),
    linkedWalletId: uuid("linked_wallet_id").references(() => wallets.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    check(
      "chk_alloc_bucket_type",
      sql`${t.bucketType} IN ('cold_money', 'dca', 'wishlist', 'other')`
    ),
    check("chk_alloc_mode", sql`${t.mode} IN ('fixed', 'percent')`),
    check("chk_alloc_value_positive", sql`${t.value} > 0`),
    check(
      "chk_alloc_percent_max",
      sql`${t.mode} <> 'percent' OR ${t.value} <= 100`
    ),
    check(
      "chk_alloc_target_total",
      sql`${t.targetTotal} IS NULL OR ${t.targetTotal} > 0`
    ),
    check(
      "chk_alloc_target_months",
      sql`${t.targetMonths} IS NULL OR (${t.targetMonths} >= 1 AND ${t.targetMonths} <= 600)`
    ),
    index("idx_salary_allocations_user_sort").on(
      t.userId,
      t.sortOrder,
      t.createdAt
    ),
  ]
);

export const investmentSettings = pgTable(
  "investment_settings",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    targetGoalAmount: numeric("target_goal_amount", {
      precision: 14,
      scale: 2,
    })
      .default("2000000.00")
      .notNull(),
    startingPrincipal: numeric("starting_principal", {
      precision: 14,
      scale: 2,
    })
      .default("0.00")
      .notNull(),
    monthlyDca: numeric("monthly_dca", { precision: 12, scale: 2 })
      .default("3000.00")
      .notNull(),
    expectedAnnualReturnPct: numeric("expected_annual_return_pct", {
      precision: 5,
      scale: 2,
    })
      .default("8.00")
      .notNull(),
    horizonYears: integer("horizon_years").default(15).notNull(),
    annualDcaStepUpPct: numeric("annual_dca_step_up_pct", {
      precision: 5,
      scale: 2,
    })
      .default("0.00")
      .notNull(),
    reinvestDividends: boolean("reinvest_dividends").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    check("chk_inv_settings_goal_nonneg", sql`${t.targetGoalAmount} >= 0`),
    check("chk_inv_settings_principal_nonneg", sql`${t.startingPrincipal} >= 0`),
    check("chk_inv_settings_dca_nonneg", sql`${t.monthlyDca} >= 0`),
    check(
      "chk_inv_settings_return_range",
      sql`${t.expectedAnnualReturnPct} >= 0 AND ${t.expectedAnnualReturnPct} <= 50`
    ),
    check(
      "chk_inv_settings_horizon_range",
      sql`${t.horizonYears} >= 1 AND ${t.horizonYears} <= 50`
    ),
    check(
      "chk_inv_settings_stepup_range",
      sql`${t.annualDcaStepUpPct} >= 0 AND ${t.annualDcaStepUpPct} <= 30`
    ),
  ]
);

export const investmentHoldings = pgTable(
  "investment_holdings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 30 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    assetType: varchar("asset_type", { length: 20 })
      .$type<"etf" | "stock" | "mutual_fund" | "gold_bond" | "other">()
      .notNull(),
    targetAllocationPct: numeric("target_allocation_pct", {
      precision: 5,
      scale: 2,
    })
      .default("0.00")
      .notNull(),
    expectedAnnualReturnPct: numeric("expected_annual_return_pct", {
      precision: 5,
      scale: 2,
    })
      .default("8.00")
      .notNull(),
    investedCost: numeric("invested_cost", { precision: 14, scale: 2 })
      .default("0.00")
      .notNull(),
    currentValue: numeric("current_value", { precision: 14, scale: 2 })
      .default("0.00")
      .notNull(),
    dividendsReceived: numeric("dividends_received", {
      precision: 14,
      scale: 2,
    })
      .default("0.00")
      .notNull(),
    units: numeric("units", { precision: 18, scale: 6 }),
    currency: varchar("currency", { length: 10 })
      .$type<"THB" | "USD">()
      .default("THB")
      .notNull(),
    broker: varchar("broker", { length: 60 }),
    note: text("note"),
    color: varchar("color", { length: 20 }).default("#0f766e").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    check(
      "chk_inv_holding_asset_type",
      sql`${t.assetType} IN ('etf', 'stock', 'mutual_fund', 'gold_bond', 'other')`
    ),
    check("chk_inv_holding_currency", sql`${t.currency} IN ('THB', 'USD')`),
    check(
      "chk_inv_holding_alloc_range",
      sql`${t.targetAllocationPct} >= 0 AND ${t.targetAllocationPct} <= 100`
    ),
    check(
      "chk_inv_holding_return_range",
      sql`${t.expectedAnnualReturnPct} >= 0 AND ${t.expectedAnnualReturnPct} <= 50`
    ),
    check("chk_inv_holding_cost_nonneg", sql`${t.investedCost} >= 0`),
    check("chk_inv_holding_value_nonneg", sql`${t.currentValue} >= 0`),
    check("chk_inv_holding_div_nonneg", sql`${t.dividendsReceived} >= 0`),
    check(
      "chk_inv_holding_units_nonneg",
      sql`${t.units} IS NULL OR ${t.units} >= 0`
    ),
    index("idx_inv_holdings_user_sort").on(t.userId, t.sortOrder, t.createdAt),
  ]
);

export const investmentSnapshots = pgTable(
  "investment_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    monthKey: varchar("month_key", { length: 7 }).notNull(),
    investedCost: numeric("invested_cost", { precision: 14, scale: 2 })
      .default("0.00")
      .notNull(),
    marketValue: numeric("market_value", { precision: 14, scale: 2 })
      .default("0.00")
      .notNull(),
    dividends: numeric("dividends", { precision: 14, scale: 2 })
      .default("0.00")
      .notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique("uq_inv_snapshots_user_month").on(t.userId, t.monthKey),
    check("chk_inv_snap_cost_nonneg", sql`${t.investedCost} >= 0`),
    check("chk_inv_snap_val_nonneg", sql`${t.marketValue} >= 0`),
    check("chk_inv_snap_div_nonneg", sql`${t.dividends} >= 0`),
    index("idx_inv_snapshots_user_month").on(t.userId, t.monthKey),
  ]
);

export const investmentDcaLogs = pgTable(
  "investment_dca_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    holdingId: uuid("holding_id")
      .notNull()
      .references(() => investmentHoldings.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    executedDate: date("executed_date", { mode: "string" }).notNull(),
    amountThb: numeric("amount_thb", { precision: 12, scale: 2 }).notNull(),
    unitsBought: numeric("units_bought", { precision: 18, scale: 6 }),
    pricePerUnit: numeric("price_per_unit", { precision: 14, scale: 4 }),
    feeThb: numeric("fee_thb", { precision: 12, scale: 2 })
      .default("0.00")
      .notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check("chk_inv_dca_amount_positive", sql`${t.amountThb} > 0`),
    check("chk_inv_dca_fee_nonneg", sql`${t.feeThb} >= 0`),
    check(
      "chk_inv_dca_units_nonneg",
      sql`${t.unitsBought} IS NULL OR ${t.unitsBought} >= 0`
    ),
    check(
      "chk_inv_dca_price_nonneg",
      sql`${t.pricePerUnit} IS NULL OR ${t.pricePerUnit} >= 0`
    ),
    index("idx_inv_dca_logs_user_date").on(t.userId, t.executedDate),
    index("idx_inv_dca_logs_holding").on(t.holdingId),
  ]
);

export const authRateLimits = pgTable(
  "auth_rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").default(1).notNull(),
    resetAt: timestamp("reset_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [index("idx_auth_rate_limits_reset_at").on(t.resetAt)]
);

export type UserRecord = typeof users.$inferSelect;
export type WalletRecord = typeof wallets.$inferSelect;
export type CategoryRecord = typeof categories.$inferSelect;
export type TransactionRecord = typeof transactions.$inferSelect;
export type SalarySettingsRecord = typeof salarySettings.$inferSelect;
export type SalaryAllocationRecord = typeof salaryAllocations.$inferSelect;
export type InvestmentSettingsRecord = typeof investmentSettings.$inferSelect;
export type InvestmentHoldingRecord = typeof investmentHoldings.$inferSelect;
export type InvestmentSnapshotRecord = typeof investmentSnapshots.$inferSelect;
export type InvestmentDcaLogRecord = typeof investmentDcaLogs.$inferSelect;
