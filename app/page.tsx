import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-4xl font-bold">Service Manager 1.0</h1>
        <p className="text-muted-foreground">
          Field service management application with multi-technician coordination and real-time reporting.
        </p>
        <div className="pt-4 flex gap-3 justify-center">
          <Link 
            href="/login" 
            className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Sign In
          </Link>
          <Link 
            href="/debug" 
            className="inline-flex items-center justify-center px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/90 transition-colors"
          >
            View Debug Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
