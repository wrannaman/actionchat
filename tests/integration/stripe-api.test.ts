import { describe, it, expect } from "vitest";
import { z } from "zod";
import { withTestCustomer, stripe } from "../helpers/stripe";

// Import the tool executor from the app
import { executeTool } from "@/lib/tools";

// Zod schemas for validating Stripe responses
const CustomerSchema = z.object({
  id: z.string().startsWith("cus_"),
  object: z.literal("customer"),
  email: z.string().nullable(),
});

const CustomerListSchema = z.object({
  object: z.literal("list"),
  data: z.array(CustomerSchema),
});

// ═══════════════════════════════════════════════════════════════
// Direct Stripe SDK Tests (validates our test helpers work)
// ═══════════════════════════════════════════════════════════════
describe("Stripe SDK (direct)", () => {
  it("creates and retrieves a customer", async () => {
    await withTestCustomer(async (customerId, customer) => {
      const retrieved = await stripe.customers.retrieve(customerId);
      const parsed = CustomerSchema.parse(retrieved);
      expect(parsed.id).toBe(customerId);
      expect(parsed.email).toContain("actionchat-test");
    });
  });

  it("lists customers", async () => {
    const result = await stripe.customers.list({ limit: 3 });
    const parsed = CustomerListSchema.parse(result);
    expect(parsed.object).toBe("list");
    expect(Array.isArray(parsed.data)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Stripe OpenAPI Tests (via tool-executor)
// Uses actual Stripe API with OpenAPI-style tool definitions
// ═══════════════════════════════════════════════════════════════
describe("Stripe OpenAPI", () => {
  // OpenAPI source config (simulating what comes from DB)
  const openApiSource = {
    id: "test-stripe-openapi",
    name: "Stripe API Test",
    source_type: "openapi" as const,
    base_url: "https://api.stripe.com",
    auth_type: "bearer" as const,
  };

  // Credentials
  const credentials = {
    token: process.env.STRIPE_SECRET_KEY,
  };

  it("lists customers via OpenAPI", async () => {
    const tool = {
      name: "GetCustomers",
      path: "/v1/customers",
      method: "GET",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", in: "query" },
        },
      },
    };

    const result = await executeTool({
      tool,
      source: openApiSource,
      args: { limit: 3 },
      userCredentials: credentials,
    });

    console.log("[Test] list customers result:", JSON.stringify(result, null, 2).slice(0, 500));

    expect(result.response_status).toBe(200);
    expect(result.error_message).toBeNull();
    expect(result.response_body).toBeDefined();
    
    // Verify we get full customer objects with email field
    const body = result.response_body;
    expect(body.object).toBe("list");
    expect(Array.isArray(body.data)).toBe(true);
    
    // Each customer should have full data (email field present, even if null)
    if (body.data.length > 0) {
      const firstCustomer = body.data[0];
      expect(firstCustomer).toHaveProperty("email");
      expect(firstCustomer).toHaveProperty("id");
      expect(firstCustomer.id).toMatch(/^cus_/);
    }
  });

  it("retrieves a specific customer with full data", async () => {
    await withTestCustomer(async (customerId) => {
      const tool = {
        name: "GetCustomer",
        path: "/v1/customers/{customer}",
        method: "GET",
        parameters: {
          type: "object",
          properties: {
            customer: { type: "string", in: "path" },
          },
          required: ["customer"],
        },
      };

      const result = await executeTool({
        tool,
        source: openApiSource,
        args: { customer: customerId },
        userCredentials: credentials,
      });

      console.log("[Test] get customer result:", JSON.stringify(result, null, 2).slice(0, 500));

      expect(result.response_status).toBe(200);
      expect(result.error_message).toBeNull();
      
      const customer = result.response_body;
      expect(customer.id).toBe(customerId);
      expect(customer.object).toBe("customer");
      // Full data includes email
      expect(customer).toHaveProperty("email");
      expect(customer.email).toContain("actionchat-test");
    });
  });

  it("creates a customer via OpenAPI", async () => {
    const testEmail = `openapi-test-${Date.now()}@actionchat-test.example`;

    const tool = {
      name: "CreateCustomer",
      path: "/v1/customers",
      method: "POST",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", in: "body" },
          name: { type: "string", in: "body" },
        },
      },
    };

    const result = await executeTool({
      tool,
      source: openApiSource,
      args: { email: testEmail, name: "OpenAPI Test Customer" },
      userCredentials: credentials,
    });

    console.log("[Test] create customer result:", JSON.stringify(result, null, 2).slice(0, 500));

    expect(result.response_status).toBe(200);
    expect(result.error_message).toBeNull();
    
    const customer = result.response_body;
    expect(customer.id).toMatch(/^cus_/);
    expect(customer.email).toBe(testEmail);
    expect(customer.name).toBe("OpenAPI Test Customer");

    // Clean up
    try {
      await stripe.customers.del(customer.id);
      console.log(`[Test] Cleaned up customer: ${customer.id}`);
    } catch (e) {
      console.warn(`[Test] Failed to clean up customer: ${customer.id}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Tool Executor Unit Tests (no external calls)
// ═══════════════════════════════════════════════════════════════
describe("Tool Executor Utils", () => {
  it("buildUrl substitutes path params", async () => {
    const { buildUrl } = await import("@/lib/tools");
    const url = buildUrl(
      "https://api.stripe.com/v1",
      "/customers/{customer_id}",
      { customer_id: "cus_123" },
      { properties: { customer_id: { type: "string", in: "path" } } }
    );
    expect(url).toBe("https://api.stripe.com/v1/customers/cus_123");
  });

  it("buildUrl adds query params", async () => {
    const { buildUrl } = await import("@/lib/tools");
    const url = buildUrl(
      "https://api.stripe.com/v1",
      "/customers",
      { limit: 10, starting_after: "cus_abc" },
      {
        properties: {
          limit: { type: "number", in: "query" },
          starting_after: { type: "string", in: "query" },
        },
      }
    );
    expect(url).toBe("https://api.stripe.com/v1/customers?limit=10&starting_after=cus_abc");
  });

  it("buildAuthHeaders creates bearer token", async () => {
    const { buildAuthHeaders } = await import("@/lib/tools");
    const headers = buildAuthHeaders(
      { auth_type: "bearer", name: "Test" },
      { token: "sk_test_123" }
    );
    expect(headers.Authorization).toBe("Bearer sk_test_123");
  });
});
