import { eq } from "drizzle-orm";
import type { Database } from "./index";
import { categories, wallets } from "./schema";
import { DEFAULT_CATEGORIES, DEFAULT_WALLETS } from "./seed-data";

type DbOrTx = Pick<Database, "select" | "insert">;

/**
 * Seeds default wallets and categories for a newly created user idempotently.
 */
export async function seedDefaultDataForUser(
  executor: DbOrTx,
  userId: string
): Promise<{ walletsCreated: number; categoriesCreated: number }> {
  const existingWallets = await executor
    .select({ id: wallets.id })
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);

  const existingCategories = await executor
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.userId, userId))
    .limit(1);

  let walletsCreated = 0;
  let categoriesCreated = 0;

  if (existingWallets.length === 0) {
    await executor.insert(wallets).values(
      DEFAULT_WALLETS.map((w) => ({
        ...w,
        userId,
      }))
    );
    walletsCreated = DEFAULT_WALLETS.length;
  }

  if (existingCategories.length === 0) {
    await executor.insert(categories).values(
      DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        userId,
      }))
    );
    categoriesCreated = DEFAULT_CATEGORIES.length;
  }

  return { walletsCreated, categoriesCreated };
}
