import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { WorkflowsProvider } from './context/WorkflowsContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Workflows from './pages/Workflows.jsx'
import WorkflowEditor from './pages/WorkflowEditor.jsx'
import ExecutionHistory from './pages/ExecutionHistory.jsx'
import Teams from './pages/Teams.jsx'
import Settings from './pages/Settings.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <ToastProvider>
      <WorkflowsProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/workflows/:id" element={<WorkflowEditor />} />
            <Route path="/history" element={<ExecutionHistory />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </WorkflowsProvider>
    </ToastProvider>
  )
}
