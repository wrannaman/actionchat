# Embedding Configuration

Embeddings are **required** for ActionChat to work properly. They power the RAG search that matches natural language queries like "refund the customer" to the right API endpoint. Without embeddings, tool matching falls back to basic keyword search which is much less accurate.

## Supported Providers

| Provider | Model | Dimensions | API Key |
|----------|-------|------------|---------|
| **OpenAI** (default) | `text-embedding-3-small` | 1536 | `OPENAI_API_KEY` |
| **Google (Gemini)** | `text-embedding-004` | 768 | `GOOGLE_GENERATIVE_AI_API_KEY` |
| **Ollama** | `nomic-embed-text` | 768 | none (local) |

## Configuration

Set these environment variables at the platform level:

```bash
# Provider: openai (default), gemini, or ollama
EMBEDDING_PROVIDER=openai

# Model (optional - defaults based on provider)
EMBEDDING_MODEL=text-embedding-3-small

# API key (falls back to OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY)
EMBEDDING_API_KEY=sk-...

# Base URL (only needed for Ollama)
EMBEDDING_BASE_URL=http://localhost:11434/v1
```

### OpenAI (default)

```bash
OPENAI_API_KEY=sk-...
# That's it - OpenAI is the default
```

### Google (Gemini)

```bash
EMBEDDING_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key
```

### Ollama (local)

```bash
EMBEDDING_PROVIDER=ollama
EMBEDDING_BASE_URL=http://localhost:11434/v1
EMBEDDING_MODEL=nomic-embed-text
```

Make sure Ollama is running with the model pulled:
```bash
ollama pull nomic-embed-text
```

## Dual-Column Architecture

ActionChat stores embeddings in separate columns based on dimension:
- `embedding_1536` - OpenAI embeddings
- `embedding_768` - Google/Ollama embeddings

This means you can **switch providers without losing data**. When you switch:
1. The old embeddings remain in their column
2. New syncs populate the new provider's column
3. Search uses whichever column matches your current provider

## Switching Providers

### First-time setup (fresh database)

1. Run the migration:
   ```bash
   # Apply to your Supabase project
   psql $DATABASE_URL < sql/migrations/002_dual_embeddings.sql
   ```

2. Set your provider in `.env`

3. Sync your sources - embeddings will be generated

### Switching from OpenAI to Google

1. Update `.env`:
   ```bash
   EMBEDDING_PROVIDER=google
   GOOGLE_GENERATIVE_AI_API_KEY=your-key
   ```

2. Re-sync all sources to generate Gemini embeddings:
   - Go to Settings > Sources
   - Click "Sync" on each source
   - Or use the API: `POST /api/sources/{id}/sync`

Your OpenAI embeddings remain intact in `embedding_1536` if you ever want to switch back.

### Switching back to OpenAI

1. Update `.env`:
   ```bash
   EMBEDDING_PROVIDER=openai
   # GOOGLE_GENERATIVE_AI_API_KEY can remain - it won't be used
   ```

2. If you previously synced with OpenAI, no re-sync needed - the embeddings are still there
3. If not, re-sync your sources

## Cost Comparison

| Provider | Price | Notes |
|----------|-------|-------|
| OpenAI | ~$0.02/1M tokens | Most widely used |
| Gemini | Free tier available | Good for experiments |
| Ollama | Free (local) | Requires GPU for speed |

## Debugging

Check your current embedding config:

```javascript
// Can import from either location
import { getEmbeddingConfig } from '@/lib/ai';
// or: import { getEmbeddingConfig } from '@/lib/tools';

console.log(getEmbeddingConfig());
// {
//   provider: 'openai',
//   model: 'text-embedding-3-small',
//   dimension: 1536,
//   column: 'embedding_1536',
//   hasApiKey: true
// }
```

## Troubleshooting

### "Embedding search returning no results"

1. Check if tools have embeddings:
   ```sql
   SELECT COUNT(*) FROM tools WHERE embedding_768 IS NOT NULL;
   -- or embedding_1536 for OpenAI
   ```

2. Make sure you synced sources AFTER setting up the provider

3. Check the embedding config matches what you synced with

### "Embedding generation failing during sync"

1. Check your API key is valid
2. For Ollama, ensure the server is running and model is pulled
3. Check logs for specific error messages

### "Switched providers but search isn't working"

You need to re-sync sources after switching providers. The old embeddings are in a different column.
