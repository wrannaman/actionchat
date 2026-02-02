import Stripe from "stripe";

// Initialize Stripe with test key
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

/**
 * Create a test customer, run the test, then clean up.
 * Ensures test isolation - no hardcoded fixture IDs.
 */
export async function withTestCustomer<T>(
  fn: (customerId: string, customer: Stripe.Customer) => Promise<T>
): Promise<T> {
  const customer = await stripe.customers.create({
    email: `test-${Date.now()}@actionchat-test.example`,
    metadata: {
      test: "true",
      created_by: "actionchat-vitest",
    },
  });

  console.log(`[Stripe Helper] Created test customer: ${customer.id}`);

  try {
    return await fn(customer.id, customer);
  } finally {
    // Best-effort cleanup
    try {
      await stripe.customers.del(customer.id);
      console.log(`[Stripe Helper] Deleted test customer: ${customer.id}`);
    } catch (err) {
      console.warn(`[Stripe Helper] Failed to delete customer ${customer.id}:`, err);
    }
  }
}

/**
 * Create a test product + price, run the test, then clean up.
 */
export async function withTestProduct<T>(
  fn: (productId: string, priceId: string) => Promise<T>
): Promise<T> {
  const product = await stripe.products.create({
    name: `Test Product ${Date.now()}`,
    metadata: {
      test: "true",
      created_by: "actionchat-vitest",
    },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 1000, // $10.00
    currency: "usd",
    metadata: {
      test: "true",
    },
  });

  console.log(`[Stripe Helper] Created test product: ${product.id}, price: ${price.id}`);

  try {
    return await fn(product.id, price.id);
  } finally {
    // Archive the product (can't delete products with prices)
    try {
      await stripe.products.update(product.id, { active: false });
      console.log(`[Stripe Helper] Archived test product: ${product.id}`);
    } catch (err) {
      console.warn(`[Stripe Helper] Failed to archive product ${product.id}:`, err);
    }
  }
}

/**
 * List recent test customers (for debugging/cleanup).
 */
export async function listTestCustomers(limit = 10): Promise<Stripe.Customer[]> {
  const result = await stripe.customers.list({
    limit,
    // Could filter by metadata but Stripe doesn't support that in list
  });

  return result.data.filter(
    (c) => c.metadata?.test === "true" || c.email?.includes("actionchat-test")
  );
}

/**
 * Clean up all test customers (use sparingly, mainly for manual cleanup).
 */
export async function cleanupTestCustomers(): Promise<number> {
  const customers = await listTestCustomers(100);
  let deleted = 0;

  for (const customer of customers) {
    try {
      await stripe.customers.del(customer.id);
      deleted++;
    } catch {
      // Ignore errors
    }
  }

  return deleted;
}
