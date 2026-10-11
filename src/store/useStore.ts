import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EdgeChange, NodeChange } from '@xyflow/react'
import type { NodeType, Workflow, WorkflowEdge, WorkflowNode } from '../types/workflow'
import type { Execution } from '../engine/types'
import { createNode } from '../lib/blueprint'
import { TEMPLATES } from '../data/templates'
import { blueprintToWorkflow } from '../lib/blueprint'
import { runWorkflow } from '../engine/orchestrator'
import type { RunEvent } from '../engine/orchestrator'
import { draftWorkflow, type WorkflowBlueprint } from '../lib/ai'
import { getAiSettings, saveAiSettings, type AiSettings } from '../lib/settings'
import { uid } from '../lib/utils'

const MAX_EXECUTIONS = 120

interface AppState {
  workflows: Workflow[]
  executions: Execution[]
  seeded: boolean
  aiSettings: AiSettings

  // --- lifecycle ---------------------------------------------------------
  bootstrap: () => Promise<void>

  // --- workflows ---------------------------------------------------------
  createWorkflow: (name?: string) => Workflow
  createFromTemplate: (templateId: string) => Workflow | null
  createFromBlueprint: (bp: WorkflowBlueprint) => Workflow
  createFromPrompt: (prompt: string) => Workflow
  duplicateWorkflow: (id: string) => Workflow | null
  renameWorkflow: (id: string, name: string) => void
  updateWorkflowMeta: (id: string, patch: Partial<Pick<Workflow, 'name' | 'description' | 'enabled'>>) => void
  deleteWorkflow: (id: string) => void
  toggleWorkflowEnabled: (id: string) => void

  // --- nodes / edges -----------------------------------------------------
  addNode: (workflowId: string, type: NodeType, position: { x: number; y: number }) => WorkflowNode | null
  updateNodeConfig: (workflowId: string, nodeId: string, config: Record<string, any>) => void
  renameNode: (workflowId: string, nodeId: string, name: string) => void
  toggleNodeDisabled: (workflowId: string, nodeId: string) => void
  removeNode: (workflowId: string, nodeId: string) => void
  duplicateNode: (workflowId: string, nodeId: string) => void
  addEdge: (workflowId: string, edge: Omit<WorkflowEdge, 'id'>) => void
  removeEdge: (workflowId: string, edgeId: string) => void
  applyNodeChanges: (workflowId: string, changes: NodeChange[]) => void
  applyEdgeChanges: (workflowId: string, changes: EdgeChange[]) => void

  // --- executions --------------------------------------------------------
  runWorkflowById: (
    id: string,
    trigger: any,
    source?: Execution['source'],
    onEvent?: (event: RunEvent) => void,
  ) => Promise<Execution | null>
  recordExecution: (execution: Execution) => void
  deleteExecution: (id: string) => void
  clearExecutions: () => void

  // --- settings ----------------------------------------------------------
  setAiSettings: (settings: AiSettings) => void
}

function touch(workflow: Workflow): Workflow {
  return { ...workflow, updatedAt: Date.now() }
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      workflows: [],
      executions: [],
      seeded: false,
      aiSettings: getAiSettings(),

      // -------------------------------------------------------------------
      bootstrap: async () => {
        if (get().seeded) return
        // Seed the three starter templates so the app is never empty on first run.
        const templates = TEMPLATES.map((t) => t.build())
        set({ workflows: templates, seeded: true })

        // Run each template once through the real engine so the dashboard and
        // history are populated with genuine (not faked) execution data.
        for (const workflow of templates) {
          try {
            const trigger = defaultTriggerFor(workflow)
            const execution = await runWorkflow(workflow, { trigger, source: 'manual' })
            get().recordExecution(execution)
          } catch {
            /* a failed bootstrap run must never break startup */
          }
        }
      },

      // -------------------------------------------------------------------
      createWorkflow: (name) => {
        const now = Date.now()
        const workflow: Workflow = {
          id: uid('wf'),
          name: name?.trim() || 'Untitled workflow',
          description: '',
          version: 1,
          enabled: true,
          nodes: [createNode('manual_trigger', { x: 80, y: 140 })],
          edges: [],
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({ workflows: [workflow, ...state.workflows] }))
        return workflow
      },

      createFromTemplate: (templateId) => {
        const template = TEMPLATES.find((t) => t.id === templateId)
        if (!template) return null
        const built = template.build()
        // Fresh ids so multiple copies of a template never collide.
        const workflow: Workflow = {
          ...built,
          id: uid('wf'),
          name: `${built.name}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({ workflows: [workflow, ...state.workflows] }))
        return workflow
      },

      createFromBlueprint: (bp) => {
        const workflow = blueprintToWorkflow(bp)
        set((state) => ({ workflows: [workflow, ...state.workflows] }))
        return workflow
      },

      createFromPrompt: (prompt) => {
        const bp = draftWorkflow(prompt)
        return get().createFromBlueprint(bp)
      },

      duplicateWorkflow: (id) => {
        const source = get().workflows.find((w) => w.id === id)
        if (!source) return null
        const idMap = new Map<string, string>()
        const clone: Workflow = {
          ...source,
          id: uid('wf'),
          name: `${source.name} (copy)`,
          nodes: source.nodes.map((n) => {
            const newId = uid('node')
            idMap.set(n.id, newId)
            return { ...n, id: newId, config: structuredClone(n.config), position: { ...n.position } }
          }),
          edges: source.edges.map((e) => ({
            ...e,
            id: uid('edge'),
            source: idMap.get(e.source) ?? e.source,
            target: idMap.get(e.target) ?? e.target,
          })),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({ workflows: [clone, ...state.workflows] }))
        return clone
      },

      renameWorkflow: (id, name) =>
        set((state) => ({
          workflows: state.workflows.map((w) => (w.id === id ? touch({ ...w, name }) : w)),
        })),

      updateWorkflowMeta: (id, patch) =>
        set((state) => ({
          workflows: state.workflows.map((w) => (w.id === id ? touch({ ...w, ...patch }) : w)),
        })),

      deleteWorkflow: (id) =>
        set((state) => ({
          workflows: state.workflows.filter((w) => w.id !== id),
          executions: state.executions.filter((e) => e.workflowId !== id),
        })),

      toggleWorkflowEnabled: (id) =>
        set((state) => ({
          workflows: state.workflows.map((w) => (w.id === id ? touch({ ...w, enabled: !w.enabled }) : w)),
        })),

      // -------------------------------------------------------------------
      addNode: (workflowId, type, position) => {
        const node = createNode(type, position)
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === workflowId ? touch({ ...w, nodes: [...w.nodes, node] }) : w,
          ),
        }))
        return node
      },

      updateNodeConfig: (workflowId, nodeId, config) =>
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === workflowId
              ? touch({
                  ...w,
                  nodes: w.nodes.map((n) => (n.id === nodeId ? { ...n, config } : n)),
                })
              : w,
          ),
        })),

      renameNode: (workflowId, nodeId, name) =>
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === workflowId
              ? touch({ ...w, nodes: w.nodes.map((n) => (n.id === nodeId ? { ...n, name } : n)) })
              : w,
          ),
        })),

      toggleNodeDisabled: (workflowId, nodeId) =>
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === workflowId
              ? touch({
                  ...w,
                  nodes: w.nodes.map((n) => (n.id === nodeId ? { ...n, disabled: !n.disabled } : n)),
                })
              : w,
          ),
        })),

      removeNode: (workflowId, nodeId) =>
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === workflowId
              ? touch({
                  ...w,
                  nodes: w.nodes.filter((n) => n.id !== nodeId),
                  edges: w.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
                })
              : w,
          ),
        })),

      duplicateNode: (workflowId, nodeId) =>
        set((state) => ({
          workflows: state.workflows.map((w) => {
            if (w.id !== workflowId) return w
            const source = w.nodes.find((n) => n.id === nodeId)
            if (!source) return w
            const copy: WorkflowNode = {
              ...source,
              id: uid('node'),
              name: `${source.name} (copy)`,
              config: structuredClone(source.config),
              position: { x: source.position.x + 40, y: source.position.y + 60 },
            }
            return touch({ ...w, nodes: [...w.nodes, copy] })
          }),
        })),

      addEdge: (workflowId, edge) =>
        set((state) => ({
          workflows: state.workflows.map((w) => {
            if (w.id !== workflowId) return w
            const duplicate = w.edges.some(
              (e) =>
                e.source === edge.source &&
                e.target === edge.target &&
                (e.sourceHandle ?? 'out') === (edge.sourceHandle ?? 'out'),
            )
            if (duplicate) return w
            return touch({ ...w, edges: [...w.edges, { ...edge, id: uid('edge') }] })
          }),
        })),

      removeEdge: (workflowId, edgeId) =>
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === workflowId ? touch({ ...w, edges: w.edges.filter((e) => e.id !== edgeId) }) : w,
          ),
        })),

      applyNodeChanges: (workflowId, changes) =>
        set((state) => ({
          workflows: state.workflows.map((w) => {
            if (w.id !== workflowId) return w
            let nodes = w.nodes
            let edges = w.edges
            let dirty = false
            for (const change of changes) {
              if (change.type === 'position' && change.position) {
                nodes = nodes.map((n) => (n.id === change.id ? { ...n, position: change.position! } : n))
                dirty = true
              } else if (change.type === 'remove') {
                nodes = nodes.filter((n) => n.id !== change.id)
                edges = edges.filter((e) => e.source !== change.id && e.target !== change.id)
                dirty = true
              }
            }
            return dirty ? { ...w, nodes, edges } : w
          }),
        })),

      applyEdgeChanges: (workflowId, changes) =>
        set((state) => ({
          workflows: state.workflows.map((w) => {
            if (w.id !== workflowId) return w
            let edges = w.edges
            let dirty = false
            for (const change of changes) {
              if (change.type === 'remove') {
                edges = edges.filter((e) => e.id !== change.id)
                dirty = true
              }
            }
            return dirty ? { ...w, edges } : w
          }),
        })),

      // -------------------------------------------------------------------
      runWorkflowById: async (id, trigger, source = 'manual', onEvent) => {
        const workflow = get().workflows.find((w) => w.id === id)
        if (!workflow) return null
        const execution = await runWorkflow(workflow, { trigger, source, onEvent })
        get().recordExecution(execution)
        return execution
      },

      recordExecution: (execution) =>
        set((state) => ({
          executions: [execution, ...state.executions].slice(0, MAX_EXECUTIONS),
        })),

      deleteExecution: (id) =>
        set((state) => ({ executions: state.executions.filter((e) => e.id !== id) })),

      clearExecutions: () => set({ executions: [] }),

      setAiSettings: (settings) => {
        saveAiSettings(settings)
        set({ aiSettings: settings })
      },
    }),
    {
      name: 'ctrl-freaks.store.v1',
      partialize: (state) => ({
        workflows: state.workflows,
        executions: state.executions,
        seeded: state.seeded,
      }),
    },
  ),
)

/** Best-effort default trigger payload from a workflow's trigger node config. */
export function defaultTriggerFor(workflow: Workflow): any {
  const trigger = workflow.nodes.find((n) => n.type === 'manual_trigger' || n.type === 'webhook_trigger')
  const raw = trigger?.config?.samplePayloadJson
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return {}
}

// Selector helpers (use with useStore(selector)).
export const selectWorkflow = (id: string | undefined) => (state: AppState) =>
  state.workflows.find((w) => w.id === id)
