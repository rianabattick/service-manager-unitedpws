# Service Manager Application

A comprehensive service management system built with Next.js, Supabase, and Google Calendar integration.

## Features

- Job scheduling and management
- Technician assignment and tracking
- Contract management
- Equipment tracking
- Customer and vendor management
- Real-time notifications
- Google Calendar integration for job invites
- Report generation and storage

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Supabase account and project
- Google Cloud Project with Calendar API enabled (optional, for calendar invites)

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Supabase Configuration (automatically provided by Vercel integration)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Calendar API (optional - for sending job invites to technicians)
GOOGLE_API_KEY=your_google_api_key
GOOGLE_OAUTH_CLIENT_ID=your_google_oauth_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_google_oauth_client_secret
NEXT_PUBLIC_APP_URL=https://your-app-url.vercel.app
```

### Installation

```bash
# Install dependencies
npm install
# or
bun install

# Run development server
npm run dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database Setup

1. Run the SQL scripts in the `scripts/` folder in numerical order
2. These will create all necessary tables, RLS policies, and seed data

### Google Calendar Setup (Optional)

For automatic calendar invites to technicians:

1. Create a project in Google Cloud Console
2. Enable the Google Calendar API
3. Create an API key or OAuth 2.0 credentials
4. Add the credentials to your environment variables
5. See `docs/GOOGLE_CALENDAR_SETUP.md` for detailed instructions

## Project Structure

- `/app` - Next.js app directory with routes
  - `/manager` - Manager-specific pages
  - `/technician` - Technician-specific pages
  - `/api` - API routes
- `/components` - Reusable React components
- `/lib` - Utility functions and helpers
- `/scripts` - Database migration scripts
- `/docs` - Documentation

## Key Features

### Job Management
- Create, edit, and delete jobs
- Assign multiple technicians with lead designation
- Link to service agreements/contracts
- Track equipment and customer contacts
- Real-time status updates

### Contracts Module
- Create and manage service agreements
- Track multiple services per contract
- Automatic renewal reminders
- Job creation notifications
- Contract-based job scheduling

### Google Calendar Integration
- Automatically sends calendar invites to assigned technicians
- Includes job details, customer info, and location
- Stores event IDs for future reference
- Graceful fallback if API is unavailable

### Notifications
- Real-time job assignments
- Contract renewal reminders
- Status change notifications
- In-app notification center

## Deployment

The easiest way to deploy is using [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import the project in Vercel
3. Connect your Supabase integration
4. Add Google Calendar environment variables (optional)
5. Deploy!

## Documentation

- [Google Calendar Setup](./docs/GOOGLE_CALENDAR_SETUP.md)
- [Database Schema Updates](./docs/SCHEMA_UPDATES.md)

## Support

For issues or questions, please create an issue in the repository.
