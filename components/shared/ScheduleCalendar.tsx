"use client"

import { useRouter } from "next/navigation"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  url: string
  backgroundColor?: string
  borderColor?: string
}

interface ScheduleCalendarProps {
  events: CalendarEvent[]
}

export function ScheduleCalendar({ events }: ScheduleCalendarProps) {
  const router = useRouter()

  const handleEventClick = (info: any) => {
    info.jsEvent.preventDefault()
    if (info.event.url) {
      router.push(info.event.url)
    }
  }

  return (
    <div className="bg-background p-4 rounded-lg border">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        events={events}
        eventClick={handleEventClick}
        height="auto"
        eventDisplay="block"
        displayEventTime={true}
        eventTimeFormat={{
          hour: "numeric",
          minute: "2-digit",
          meridiem: "short",
        }}
        slotLabelFormat={{
          hour: "numeric",
          minute: "2-digit",
          meridiem: "short",
        }}
      />
    </div>
  )
}
