export default function GoogleAuthPage() {
  const authUrl = `/api/google/auth/initiate`

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Google Calendar Setup</h1>
          <p className="text-muted-foreground">Authorize Service Manager to send calendar invites to technicians</p>
        </div>

        <div className="bg-card border rounded-lg p-6 space-y-4">
          <div className="space-y-2">
            <h2 className="font-semibold">What you'll authorize:</h2>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Create calendar events</li>
              <li>Send invites to technicians</li>
              <li>Manage job-related events</li>
            </ul>
          </div>

          <a
            href={authUrl}
            className="block w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-2 px-4 rounded-md text-center transition-colors"
          >
            Authorize with Google
          </a>

          <p className="text-xs text-muted-foreground text-center">
            You'll be redirected to Google to sign in and grant permissions
          </p>
        </div>

        <div className="bg-muted/50 border rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">After Authorization:</h3>
          <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
            <li>You'll receive a refresh token</li>
            <li>Copy the refresh token</li>
            <li>
              Add it to your Vercel environment variables as{" "}
              <code className="bg-background px-1 py-0.5 rounded">GOOGLE_REFRESH_TOKEN</code>
            </li>
            <li>Redeploy your application</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
