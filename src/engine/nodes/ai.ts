import { runAiTransform } from '../../lib/ai'
import { registerNode } from '../registry'
import type { NodeDefinition } from '../types'
import { line } from './helpers'

const aiTransform: NodeDefinition = {
  type: 'ai_transform',
  label: 'AI Transform',
  category: 'ai',
  icon: 'Sparkles',
  description:
    'Runs an instruction (summarise, classify, extract, sentiment…) over the incoming data. Uses a demo adapter unless a live provider is configured in Settings.',
  hasInput: true,
  defaultConfig: {
    instruction: 'Summarise the input in one sentence and return JSON with a "summary" field.',
    payload: '{{input}}',
  },
  fields: [
    {
      key: 'instruction',
      label: 'Instruction',
      type: 'textarea',
      wide: true,
      help: 'What should the model do with the payload?',
    },
    {
      key: 'payload',
      label: 'Payload',
      type: 'text',
      wide: true,
      help: 'Defaults to {{input}}. Templates are supported.',
    },
  ],
  outputs: [{ id: 'out', label: 'AI result' }],
  execute: async ({ config, input, resolve, context }) => {
    if (context.aiCalls >= 10) {
      throw new Error('AI call limit reached for this execution (max 10).')
    }
    context.aiCalls += 1

    const payload = config?.payload ? resolve(config.payload) : input
    const { result, model, transport } = await runAiTransform(String(config?.instruction ?? ''), payload)

    return {
      output: { ...(result && typeof result === 'object' && !Array.isArray(result) ? result : { result }), _ai: { model, transport } },
      logs: [
        line('info', `AI Transform ran with "${model}" (${transport}).`),
        transport === 'demo'
          ? line('warn', 'Demo AI adapter in use — add a provider key in Settings for live output.')
          : line('success', 'Live AI provider responded.'),
      ],
    }
  },
  validateConfig: (config) => (config?.instruction ? [] : ['An instruction is required.']),
}

registerNode(aiTransform)
