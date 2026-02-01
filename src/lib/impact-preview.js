/**
 * Generate human-readable impact summaries for tool confirmations.
 * Detects entity types and formats them appropriately.
 */

// Format currency values
export function formatCurrency(amount, currency = "USD") {
  if (typeof amount !== "number") return String(amount);
  // Handle cents (Stripe-style - amounts > 100 that are integers)
  const value = amount > 100 && Number.isInteger(amount) ? amount / 100 : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value);
}

// Detect entity type from tool name
export function detectEntityType(toolName) {
  const nameLower = (toolName || "").toLowerCase();

  if (/customer|user|member|person|contact/.test(nameLower)) return "customer";
  if (/payment|charge|transaction|refund/.test(nameLower)) return "payment";
  if (/order|purchase|checkout/.test(nameLower)) return "order";
  if (/subscription|plan|billing/.test(nameLower)) return "subscription";
  if (/invoice|receipt/.test(nameLower)) return "invoice";
  if (/product|item|sku/.test(nameLower)) return "product";
  if (/webhook|event/.test(nameLower)) return "webhook";
  if (/key|token|secret/.test(nameLower)) return "credential";

  return "resource";
}

// Extract entity details from input args
export function extractEntityDetails(input, entityType) {
  if (!input || typeof input !== "object") return null;

  const details = {
    type: entityType,
    id: null,
    name: null,
    email: null,
    amount: null,
    currency: null,
    status: null,
    description: null,
  };

  // Extract common fields
  details.id = input.id || input.customer_id || input.payment_id ||
               input.order_id || input.subscription_id || input.userId ||
               input.customerId || input.paymentId;

  details.name = input.name || input.customer_name || input.full_name ||
                 input.firstName && input.lastName
                   ? `${input.firstName} ${input.lastName}`
                   : null;

  details.email = input.email || input.customer_email;

  details.amount = input.amount || input.total || input.price || input.value;
  details.currency = input.currency || "USD";

  details.status = input.status;
  details.description = input.description || input.reason || input.note;

  return details;
}

// Generate warnings based on operation type
export function generateWarnings(method, entityType, input) {
  const warnings = [];

  if (method === "DELETE") {
    warnings.push({
      type: "destructive",
      message: "This action cannot be undone.",
    });

    if (entityType === "customer") {
      warnings.push({
        type: "cascade",
        message: "Associated data (orders, payments) may also be affected.",
      });
    }
  }

  if (method === "POST" && entityType === "payment") {
    warnings.push({
      type: "financial",
      message: "This will create a real charge.",
    });
  }

  if (entityType === "credential") {
    warnings.push({
      type: "security",
      message: "Credential operations are sensitive.",
    });
  }

  return warnings;
}

// Format entity display name based on type
export function getEntityDisplayName(entityType) {
  const names = {
    customer: "Customer",
    payment: "Payment",
    order: "Order",
    subscription: "Subscription",
    invoice: "Invoice",
    product: "Product",
    webhook: "Webhook",
    credential: "Credential",
    resource: "Resource",
  };
  return names[entityType] || "Resource";
}

// Get icon name for entity type (for use with lucide-react)
export function getEntityIcon(entityType) {
  const icons = {
    customer: "User",
    payment: "CreditCard",
    order: "ShoppingCart",
    subscription: "RefreshCw",
    invoice: "FileText",
    product: "Package",
    webhook: "Webhook",
    credential: "Key",
    resource: "Box",
  };
  return icons[entityType] || "Box";
}

// Main function to generate impact preview
export function generateImpactPreview(toolName, method, input) {
  const entityType = detectEntityType(toolName);
  const details = extractEntityDetails(input, entityType);
  const warnings = generateWarnings(method, entityType, input);

  // Format the action description
  let actionVerb;
  switch (method) {
    case "DELETE": actionVerb = "delete"; break;
    case "POST": actionVerb = "create"; break;
    case "PUT": actionVerb = "replace"; break;
    case "PATCH": actionVerb = "update"; break;
    default: actionVerb = "modify";
  }

  const entityName = getEntityDisplayName(entityType);
  const summary = `This will ${actionVerb} ${entityName.toLowerCase()}`;

  return {
    entityType,
    entityName,
    icon: getEntityIcon(entityType),
    details,
    warnings,
    summary,
    method,
  };
}
