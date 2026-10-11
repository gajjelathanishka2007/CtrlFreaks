import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button, EmptyState } from '../components/ui/index.js'

export default function NotFound() {
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-edge bg-card">
        <EmptyState
          icon={Compass}
          title="Page not found"
          description="The page you're looking for doesn't exist or may have been moved."
          action={
            <Link to="/">
              <Button variant="primary" size="sm">
                Back to dashboard
              </Button>
            </Link>
          }
        />
      </div>
    </div>
  )
}
