import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

/**
 * Create an AI SDK model instance for the given agent config + org settings.
 *
 * @param {object} agent - Agent row from DB (model_provider, model_name)
 * @param {object} orgSettings - org.settings JSONB (contains LLM API keys)
 * @returns AI SDK model instance
 */
export function getModelForAgent(agent, orgSettings = {}) {
  const { model_provider, model_name } = agent;

  if (!model_name) {
    throw new Error('Agent has no model_name configured.');
  }

  switch (model_provider) {
    case 'openai': {
      const apiKey = orgSettings.openai_api_key;
      if (!apiKey) {
        throw new Error(
          'OpenAI API key not configured. Add it in your organization settings.'
        );
      }
      const provider = createOpenAI({ apiKey });
      return provider(model_name);
    }

    case 'anthropic': {
      const apiKey = orgSettings.anthropic_api_key;
      if (!apiKey) {
        throw new Error(
          'Anthropic API key not configured. Add it in your organization settings.'
        );
      }
      const provider = createAnthropic({ apiKey });
      return provider(model_name);
    }

    case 'ollama': {
      const baseURL =
        orgSettings.ollama_base_url || 'http://localhost:11434/v1';
      const provider = createOpenAI({ baseURL, apiKey: 'ollama' });
      return provider(model_name);
    }

    default:
      throw new Error(`Unsupported model provider: "${model_provider}"`);
  }
}
