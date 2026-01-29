This strategy shifts the battleground. You aren't competing on "features"; you are competing on **data sovereignty** and **deployment ease**.

If "Crow" is the Apple walled garden, you are building Android.

Here is the architectural blueprint (Context File) to align your other AI with this new mission. Save this as `PROJECT_SPEC.md` and feed it to your coding assistants.

---

# PROJECT_SPEC.md

## 1. The Mission: Sovereignty & "Zero-UI"

**Project Name:** copilot.sh (Working Title)
**License:** MIT
**Core Philosophy:**

* **Anti-SaaS:** We do not want another subscription. We want a container we own.
* **Anti-UI:** We do not want to build Admin Panels. We want to export an API and have the UI generate itself.
* **Privacy-First:** No customer data leaves the user's infrastructure.
* **Deployment:** "One-Click" stack (Supabase + Vercel/Docker) that any developer can spin up in 5 minutes.

## 2. Core Architecture

The system functions as a **Translation Layer** between natural language and structured API calls.

### The Stack

* **Frontend/Widget:** React (embeddable script tag).
* **Backend:** Next.js / Edge Functions (Vercel).
* **Database & Auth:** Supabase (PostgreSQL + RLS).
* **Model Layer:** Agnostic (User provides API Key: OpenAI, Anthropic, or Local/Ollama).

## 3. Data Model & Primitives

### A. Folders (The Capability Layer)

*Concept: A "Folder" is a secured container for a specific set of tools/APIs.*

* **Input:** Users ingest an `openapi.json` spec OR manually define cURL requests.
* **Function:** Groups related actions (e.g., "Stripe Billing," "AWS Prod," "User Admin").
* **Granularity:** Permissions are set at the Folder level, not the individual tool level.

### B. Agents (The Execution Layer)

*Concept: An "Agent" is the entity that interacts with the end-user.*

* **Configuration:**
* **Identity:** Name, System Prompt, Tone.
* **Brain:** Selectable Model (e.g., GPT-4o for complex tasks, Llama-3-70b for privacy).
* **Access:** Assigned specific **Folders** (e.g., "Support Agent" gets read-only User access; "Admin Agent" gets Billing write access).


* **State:** Can be toggled Active/Inactive.

### C. The Interface (The "Product")

1. **The Embeddable Widget:**
* Authenticated via the host app's session (JWT pass-through).
* User types intent -> Agent verifies permission -> Agent executes Tool -> Agent returns result.


2. **The Admin Console:**
* Upload/Manage OpenAPI specs (into Folders).
* Create/Configure Agents.
* **Audit Logs:** "Who did what?" (Essential for security). See every API call made by an agent on behalf of a user.



## 4. Key Workflows

### 1. Ingestion ("The Setup")

* Admin uploads `swagger.json`.
* System parses endpoints into "Tools."
* Admin groups Tools into a "Folder" (e.g., "Reporting API").

### 2. Execution ("The Magic")

* User (in Host App) asks: "Pull the Q3 sales report."
* Widget passes request + User Context to Backend.
* Agent checks if it has access to the "Reporting API" Folder.
* Agent selects the `GET /reports/sales` tool.
* **Guardrail:** If the tool is `destructive` (POST/DELETE), Agent requests manual confirmation ("Y/n") from user.
* Agent executes and renders JSON response as text/table.

## 5. Security & Guardrails

* **RLS (Row Level Security):** Strict separation of tenant data if multi-tenant, but primarily designed for single-tenant self-hosting.
* **Human-in-the-Loop:** Configurable "Require Confirmation" threshold for sensitive Actions (DELETE/PUT).
* **Credential Proxying:** The Agent uses the *Host Application's* auth headers whenever possible, ensuring it never exceeds the permissions of the actual human user.

---

### Strategic Next Step

To make this "real" for the other AI, you need to initialize the repository structure so it stops hallucinating abstractly and starts coding files.

**Would you like me to generate the `docker-compose.yml` or the Supabase schema (`schema.sql`) to lock in the "Agents & Folders" structure immediately?**