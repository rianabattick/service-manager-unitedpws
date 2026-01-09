-- Add google_calendar_id column to track which calendar the event was created on
ALTER TABLE job_technicians 
ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;

COMMENT ON COLUMN job_technicians.google_calendar_id IS 'The calendarId (typically technician email) used to create the event';
COMMENT ON COLUMN job_technicians.google_event_id IS 'The Google Calendar event ID for this technician';
