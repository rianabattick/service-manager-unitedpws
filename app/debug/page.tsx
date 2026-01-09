import { getCurrentUser, listManagerDashboardJobs, listTechnicianJobs, listNotificationsForUser } from '@/lib/db'
import type { UserRole } from '@/lib/types'

export default async function DebugPage() {
  // Get current user (in production, this would come from auth session)
  const user = await getCurrentUser()

  // For demo purposes, if no user is logged in, show a message
  if (!user) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Debug Dashboard</h1>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200">
              No user is currently authenticated. Please sign in to view debug data.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isManager = ['owner', 'admin', 'manager', 'dispatcher'].includes(user.role as string)
  const isTechnician = user.role === 'technician'

  // Fetch data based on role
  const managerJobs = isManager ? await listManagerDashboardJobs(user.organization_id) : []
  const technicianJobs = isTechnician ? await listTechnicianJobs(user.id) : []
  const notifications = await listNotificationsForUser(user.id)

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Debug Dashboard</h1>
          <p className="text-muted-foreground">Database query validation and relationship testing</p>
        </div>

        {/* Current User Section */}
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Current User</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">ID:</span>
              <p className="font-mono text-xs">{user.id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Email:</span>
              <p>{user.email}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Role:</span>
              <p className="font-semibold capitalize">{user.role}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Login Code:</span>
              <p className="font-mono">{user.login_code || 'Not set'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Name:</span>
              <p>{user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Not set'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Organization ID:</span>
              <p className="font-mono text-xs">{user.organization_id}</p>
            </div>
          </div>
        </section>

        {/* Manager Dashboard Section */}
        {isManager && (
          <section className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Manager Dashboard Jobs</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Showing jobs with aggregated technician assignments and report progress
            </p>
            
            {managerJobs.length === 0 ? (
              <p className="text-muted-foreground italic">No jobs found. Create some test jobs to see data here.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr className="text-left">
                      <th className="pb-2 font-semibold">Job #</th>
                      <th className="pb-2 font-semibold">Status</th>
                      <th className="pb-2 font-semibold">Scheduled</th>
                      <th className="pb-2 font-semibold">Customer</th>
                      <th className="pb-2 font-semibold">Location</th>
                      <th className="pb-2 font-semibold text-center">Technicians</th>
                      <th className="pb-2 font-semibold text-center">Reports</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {managerJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-muted/50">
                        <td className="py-3 font-mono text-xs">{job.job_number}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {/* FIX: Use helper function to display EST/EDT time */}
                          {formatToLocalTime(job.scheduled_start)}
                        </td>
                        <td className="py-3">{job.customer_name}</td>
                        <td className="py-3 text-muted-foreground">{job.location_name || '—'}</td>
                        <td className="py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-semibold">{job.accepted_technicians} / {job.total_technicians}</span>
                            {job.pending_technicians > 0 && (
                              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                {job.pending_technicians} pending
                              </span>
                            )}
                            {job.declined_technicians > 0 && (
                              <span className="text-xs text-red-600 dark:text-red-400">
                                {job.declined_technicians} declined
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-semibold">{job.total_reports_uploaded} / {job.total_expected_reports}</span>
                            {job.total_expected_reports > 0 && (
                              <div className="w-full max-w-[80px] bg-muted rounded-full h-1.5 mt-1">
                                <div 
                                  className="bg-primary h-1.5 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, (job.total_reports_uploaded / job.total_expected_reports) * 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Technician Jobs Section */}
        {isTechnician && (
          <section className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">My Assigned Jobs</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Jobs assigned to you with your assignment status and progress
            </p>
            
            {technicianJobs.length === 0 ? (
              <p className="text-muted-foreground italic">No jobs assigned yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr className="text-left">
                      <th className="pb-2 font-semibold">Job #</th>
                      <th className="pb-2 font-semibold">Status</th>
                      <th className="pb-2 font-semibold">My Status</th>
                      <th className="pb-2 font-semibold">Scheduled</th>
                      <th className="pb-2 font-semibold">Customer</th>
                      <th className="pb-2 font-semibold">Location</th>
                      <th className="pb-2 font-semibold text-center">Reports</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {technicianJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-muted/50">
                        <td className="py-3 font-mono text-xs">{job.job_number}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAssignmentStatusColor(job.assignment_status)}`}>
                            {job.assignment_status}
                          </span>
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {/* FIX: Use helper function to display EST/EDT time */}
                          {formatToLocalTime(job.scheduled_start)}
                        </td>
                        <td className="py-3">{job.customer_name}</td>
                        <td className="py-3 text-muted-foreground">{job.location_name || '—'}</td>
                        <td className="py-3 text-center">
                          <span className="font-semibold">{job.total_reports_uploaded} / {job.total_expected_reports}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Notifications Section */}
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Notifications</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Last 10 notifications (read and unread)
          </p>
          
          {notifications.length === 0 ? (
            <p className="text-muted-foreground italic">No notifications yet.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`p-4 rounded-lg border ${notif.is_read ? 'bg-muted/30 border-border' : 'bg-primary/5 border-primary/20'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{notif.type}</span>
                        {!notif.is_read && (
                          <span className="w-2 h-2 bg-primary rounded-full" />
                        )}
                      </div>
                      <p className="text-sm">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// Helper to fix timezone display issues
function formatToLocalTime(dateString: string | null) {
  if (!dateString) return "Not scheduled";
  
  return new Date(dateString).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric", 
    month: "short", 
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    case 'scheduled':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    case 'accepted':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    case 'dispatched':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'completed':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    case 'cancelled':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    case 'on_hold':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  }
}

function getAssignmentStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'accepted':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    case 'declined':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    case 'cancelled':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  }
}
