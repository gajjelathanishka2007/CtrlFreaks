import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as workflowService from '../services/workflowService.js'

const WorkflowsContext = createContext(null)

export function WorkflowsProvider({ children }) {
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [demo, setDemo] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, demo } = await workflowService.listWorkflows()
      setWorkflows(data || [])
      setDemo(!!demo)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(async (opts) => {
    const { data, demo } = await workflowService.createWorkflow(opts)
    setWorkflows((list) => [data, ...list])
    return { workflow: data, demo }
  }, [])

  const rename = useCallback(async (id, name) => {
    const { data, demo } = await workflowService.updateWorkflow(id, { name })
    setWorkflows((list) => list.map((w) => (w.id === id ? { ...w, ...(data || { name }) } : w)))
    return { workflow: data, demo }
  }, [])

  const update = useCallback(async (id, patch) => {
    const { data, demo } = await workflowService.updateWorkflow(id, patch)
    if (data) setWorkflows((list) => list.map((w) => (w.id === id ? { ...w, ...data } : w)))
    return { workflow: data, demo }
  }, [])

  const saveGraph = useCallback(async (id, graph) => {
    const { data, demo } = await workflowService.saveGraph(id, graph)
    if (data) setWorkflows((list) => list.map((w) => (w.id === id ? { ...w, ...data } : w)))
    return { workflow: data, demo }
  }, [])

  const publish = useCallback(async (id) => {
    const { data, demo } = await workflowService.publishWorkflow(id)
    if (data) setWorkflows((list) => list.map((w) => (w.id === id ? { ...w, ...data } : w)))
    return { workflow: data, demo }
  }, [])

  const remove = useCallback(async (id) => {
    await workflowService.deleteWorkflow(id)
    setWorkflows((list) => list.filter((w) => w.id !== id))
  }, [])

  const getById = useCallback((id) => workflows.find((w) => w.id === id), [workflows])

  const value = useMemo(
    () => ({ workflows, loading, error, demo, refresh, create, rename, update, saveGraph, publish, remove, getById }),
    [workflows, loading, error, demo, refresh, create, rename, update, saveGraph, publish, remove, getById],
  )

  return <WorkflowsContext.Provider value={value}>{children}</WorkflowsContext.Provider>
}

export function useWorkflows() {
  const ctx = useContext(WorkflowsContext)
  if (!ctx) throw new Error('useWorkflows must be used within WorkflowsProvider')
  return ctx
}
