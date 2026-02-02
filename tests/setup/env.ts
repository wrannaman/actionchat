import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

// Load .env.test if it exists, otherwise fall back to .env
const testEnvPath = resolve(process.cwd(), ".env.test");
const defaultEnvPath = resolve(process.cwd(), ".env");

if (existsSync(testEnvPath)) {
  config({ path: testEnvPath });
  console.log("[Test Setup] Loaded .env.test");
} else if (existsSync(defaultEnvPath)) {
  config({ path: defaultEnvPath });
  console.log("[Test Setup] Loaded .env (no .env.test found)");
} else {
  console.log("[Test Setup] No .env file found, using environment variables");
}

// Required env vars - fail early if missing
const required = ["STRIPE_SECRET_KEY"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(
      `Missing required env var: ${key}\n` +
        `Create a .env.test file with your Stripe test key.\n` +
        `Get it from https://dashboard.stripe.com/test/apikeys`
    );
  }
}

// Validate Stripe key is test mode
const stripeKey = process.env.STRIPE_SECRET_KEY!;
if (!stripeKey.startsWith("sk_test_") && !stripeKey.startsWith("rk_test_")) {
  throw new Error(
    "STRIPE_SECRET_KEY must be a test mode key (sk_test_... or rk_test_...)\n" +
      "Never use production keys in tests!"
  );
}

console.log("[Test Setup] Environment validated");
console.log("[Test Setup] Stripe key:", stripeKey.slice(0, 12) + "...");
