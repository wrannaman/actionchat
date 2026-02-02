import { describe, it, expect, afterAll } from "vitest";
import { z } from "zod";
import { withTestCustomer, stripe } from "../helpers/stripe";

// Import the tool executor and MCP manager from the app
import { executeTool } from "@/lib/tool-executor";
import * as mcpManager from "@/lib/mcp-manager";

// Zod schemas for validating Stripe responses (shape, not exact content)
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
// Stripe MCP Tests
// Uses HTTP MCP if MCP_STRIPE_URL is set, otherwise stdio
// ═══════════════════════════════════════════════════════════════
describe("Stripe MCP", () => {
  afterAll(() => {
    mcpManager.disconnectAll();
  });

  // Determine transport based on env vars
  const useHttpMcp = !!process.env.MCP_STRIPE_URL;

  // MCP config
  const mcpConfig = useHttpMcp
    ? {
        mcp_server_uri: process.env.MCP_STRIPE_URL!,
        mcp_transport: "http" as const,
        mcp_auth_token: process.env.STRIPE_SECRET_KEY,
      }
    : {
        mcp_server_uri: "npx -y @stripe/mcp --tools=all",
        mcp_transport: "stdio" as const,
        mcp_env: { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY },
      };

  const mcpSource = {
    id: "test-stripe-mcp",
    name: "Stripe MCP Test",
    source_type: "mcp" as const,
    ...mcpConfig,
  };

  it("discovers available tools", async () => {
    console.log(`[Test] Using ${useHttpMcp ? "HTTP" : "stdio"} MCP transport`);

    const tools = await mcpManager.listTools("test-stripe-mcp", mcpConfig);

    console.log("[Test] Available Stripe MCP tools:");
    for (const tool of tools.slice(0, 10)) {
      console.log(`  - ${tool.name}`);
    }
    if (tools.length > 10) {
      console.log(`  ... and ${tools.length - 10} more`);
    }

    expect(tools.length).toBeGreaterThan(0);

    // Should have list_customers
    const hasListCustomers = tools.some((t: any) => t.name === "list_customers");
    expect(hasListCustomers).toBe(true);
  });

  it("lists customers via MCP", async () => {
    const tool = {
      name: "stripe_list_customers",
      mcp_tool_name: "list_customers",
      path: "list_customers",
      method: "MCP",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number" },
        },
      },
    };

    const result = await executeTool({
      tool,
      source: mcpSource,
      args: { limit: 3 },
      userCredentials: useHttpMcp ? { token: process.env.STRIPE_SECRET_KEY } : null,
    });

    console.log("[Test] list_customers result:", JSON.stringify(result, null, 2));

    expect(result.response_status).toBe(200);
    expect(result.error_message).toBeNull();
    expect(result.response_body).toBeDefined();
  });

  it("creates a customer via MCP", async () => {
    const testEmail = `mcp-test-${Date.now()}@actionchat-test.example`;

    const tool = {
      name: "stripe_create_customer",
      mcp_tool_name: "create_customer",
      path: "create_customer",
      method: "MCP",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string" },
          name: { type: "string" },
        },
      },
    };

    const result = await executeTool({
      tool,
      source: mcpSource,
      args: { email: testEmail, name: "MCP Test Customer" },
      userCredentials: useHttpMcp ? { token: process.env.STRIPE_SECRET_KEY } : null,
    });

    console.log("[Test] create_customer result:", JSON.stringify(result, null, 2));

    expect(result.response_status).toBe(200);
    expect(result.error_message).toBeNull();

    // Response should contain the customer ID
    const bodyStr = JSON.stringify(result.response_body);
    expect(bodyStr).toContain("cus_");

    // Clean up: delete the customer we just created
    // Extract customer ID from response
    const match = bodyStr.match(/cus_[a-zA-Z0-9]+/);
    if (match) {
      try {
        await stripe.customers.del(match[0]);
        console.log(`[Test] Cleaned up customer: ${match[0]}`);
      } catch (e) {
        console.warn(`[Test] Failed to clean up customer: ${match[0]}`);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Tool Executor Unit Tests (no external calls)
// ═══════════════════════════════════════════════════════════════
describe("Tool Executor Utils", () => {
  it("buildUrl substitutes path params", async () => {
    const { buildUrl } = await import("@/lib/tool-executor");
    const url = buildUrl(
      "https://api.stripe.com/v1",
      "/customers/{customer_id}",
      { customer_id: "cus_123" },
      { properties: { customer_id: { type: "string", in: "path" } } }
    );
    expect(url).toBe("https://api.stripe.com/v1/customers/cus_123");
  });

  it("buildUrl adds query params", async () => {
    const { buildUrl } = await import("@/lib/tool-executor");
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
    const { buildAuthHeaders } = await import("@/lib/tool-executor");
    const headers = buildAuthHeaders(
      { auth_type: "bearer", name: "Test" },
      { token: "sk_test_123" }
    );
    expect(headers.Authorization).toBe("Bearer sk_test_123");
  });
});
