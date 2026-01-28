# Google Calendar Integration Setup

This document explains how to set up Google Calendar integration for sending job invites to technicians.

## Quick Start

To enable Google Calendar invites, you need to complete a one-time OAuth2 authorization:

1. **Visit the authorization page**: Navigate to `/admin/google-auth` in your app
2. **Authorize with Google**: Click the authorization button and sign in with your Google account
3. **Copy the refresh token**: After successful authorization, you'll receive a refresh token
4. **Add to environment variables**: Add the token as `GOOGLE_REFRESH_TOKEN` in your Vercel project settings
5. **Redeploy**: Redeploy your application for the changes to take effect

## Environment Variables

Add the following environment variables to your Vercel project in the **Vars section** of the in-chat sidebar:

\`\`\`bash
# Google Calendar OAuth Credentials (already configured)
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>

# Refresh Token (obtained from /admin/google-auth)
GOOGLE_REFRESH_TOKEN=<your-refresh-token>
\`\`\`

**Note:** The `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are already configured in your Vercel environment variables. You only need to add the `GOOGLE_REFRESH_TOKEN` after completing the authorization flow.

## How It Works

When a manager creates a job and assigns technicians:

1. The system automatically sends a Google Calendar invite to each assigned technician's email
2. The calendar event includes:
   - Job number and title
   - Customer name and service location
   - Scheduled start and end times
   - PO number (if applicable)
   - Job notes
   - Service type
3. Technicians receive the invite via email and it appears in their Google Calendar
4. The Google event ID is stored in the database for future reference

## OAuth2 Authorization Flow

### Step 1: Initiate Authorization

Visit `/admin/google-auth` in your app to begin the authorization process. You'll be redirected to Google to sign in.

### Step 2: Grant Permissions

Sign in with the Google account that will be used to send calendar invites (typically the manager or service account email). Grant the following permission:
- Create calendar events and send invites

### Step 3: Receive Refresh Token

After successful authorization, you'll be redirected to a success page with your refresh token. **Copy this token immediately** - you won't be able to see it again.

### Step 4: Configure Environment Variable

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to your project → Settings → Environment Variables
3. Add a new variable:
   - **Name**: `GOOGLE_REFRESH_TOKEN`
   - **Value**: (paste the token from step 3)
4. Save the variable

### Step 5: Redeploy

Redeploy your application from the Vercel dashboard for the changes to take effect.

## API Setup Requirements

Before starting the OAuth flow, ensure:

1. ✅ Google Calendar API is enabled in Google Cloud Console
2. ✅ OAuth 2.0 consent screen is configured
3. ✅ Authorized redirect URIs include your app's callback URL:
   - `http://localhost:3000/api/google/auth/callback` (development)
   - `https://your-app.vercel.app/api/google/auth/callback` (production)
4. ✅ OAuth scope includes: `https://www.googleapis.com/auth/calendar.events`

## Fallback Behavior

If the Google Calendar API fails (network issues, quota limits, authentication errors, etc.), the system:
- Still creates the job successfully
- Stores a placeholder event ID
- Shows a warning message to manually notify technicians
- Logs the error for debugging

## Testing

To test the integration:
1. Complete the OAuth2 authorization flow at `/admin/google-auth`
2. Add the refresh token to Vercel environment variables
3. Redeploy the application
4. Create a job in `/manager/schedule-job`
5. Assign a technician with a valid email address
6. Click "Create Job"
7. Check the technician's email for the calendar invite
8. Verify the event appears in their Google Calendar

## Troubleshooting

**Authorization fails:**
- Ensure redirect URIs are correctly configured in Google Cloud Console
- Verify the Google account has permission to access Calendar API
- Check that OAuth consent screen is published (not in testing mode)

**Calendar invites not sending:**
- Verify `GOOGLE_REFRESH_TOKEN` is set correctly in Vercel environment variables
- Check that you've redeployed after adding the token
- Ensure Google Calendar API is enabled in Google Cloud Console
- Review server logs for specific error messages

**Token expired or invalid:**
- Refresh tokens can expire if not used for 6 months
- Tokens can be revoked if you change Google account password
- Re-run the authorization flow at `/admin/google-auth` to get a new token

**Technicians not receiving emails:**
- Verify technician email addresses are correct in the database
- Check spam/junk folders
- Ensure the authorized Google account has email sending permissions
- Verify the Google Workspace account allows external invites

## Security Notes

- Never commit the refresh token to version control
- Store it only in Vercel environment variables
- Refresh tokens grant access to create calendar events - keep them secure
- Consider rotating tokens periodically for enhanced security
