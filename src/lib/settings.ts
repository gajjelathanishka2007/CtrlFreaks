/**
 * Local, non-secret application settings.
 *
 * Secrets are never bundled or committed — an optional AI provider key is
 * stored in the browser's localStorage only when the user enters it in
 * Settings, and is sent directly from the browser to the provider.
 */

export interface AiSettings {
  provider: 'demo' | 'openai-compatible'
  apiKey: string
  model: string
  baseUrl: string
}

const STORAGE_KEY = 'ctrl-freaks.ai-settings.v1'

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'demo',
  apiKey: '',
  model: 'gpt-4o-mini',
  baseUrl: 'https://api.openai.com/v1',
}

export function getAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_AI_SETTINGS }
    return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_AI_SETTINGS }
  }
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* storage disabled — settings simply won't persist */
  }
}

export function hasLiveAi(settings: AiSettings): boolean {
  return settings.provider === 'openai-compatible' && settings.apiKey.trim().length > 0
}
