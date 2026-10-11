import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Dashboard } from './pages/Dashboard'
import { Templates } from './pages/Templates'
import { Executions } from './pages/Executions'
import { ExecutionDetail } from './pages/ExecutionDetail'
import { Settings } from './pages/Settings'
import { Builder } from './pages/Builder'
import { useStore } from './store/useStore'
import { Button, Card, EmptyState } from './components/ui'
import { Link } from 'react-router-dom'

export default function App() {
  const bootstrap = useStore((s) => s.bootstrap)

  useEffect(() => {
    // Seed starter templates and run them once so the app is never empty.
    void bootstrap()
  }, [bootstrap])

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/executions" element={<Executions />} />
        <Route path="/executions/:executionId" element={<ExecutionDetail />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* The builder is a full-screen workspace without the sidebar. */}
      <Route path="/builder/:workflowId" element={<Builder />} />

      <Route
        path="*"
        element={
          <div className="flex h-full items-center justify-center p-6">
            <Card className="max-w-md">
              <EmptyState
                icon="Crosshair"
                title="Page not found"
                description="The page you were looking for does not exist."
                action={
                  <Link to="/">
                    <Button variant="primary">Back to dashboard</Button>
                  </Link>
                }
              />
            </Card>
          </div>
        }
      />
    </Routes>
  )
}
