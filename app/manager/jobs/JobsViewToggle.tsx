"use client"

import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface JobsViewToggleProps {
  currentView: string
  currentPath: string
  currentSearchParams: Record<string, string>
}

export function JobsViewToggle({ currentView, currentPath, currentSearchParams }: JobsViewToggleProps) {
  const router = useRouter()

  const handleViewChange = (view: string) => {
    const params = new URLSearchParams(currentSearchParams)
    params.set("view", view)
    router.push(`${currentPath}?${params.toString()}`)
  }

  return (
    <Tabs value={currentView} onValueChange={handleViewChange}>
      <TabsList className="h-12 p-1">
        <TabsTrigger value="active" className="text-base px-6 h-10">
          Active Jobs
        </TabsTrigger>
        <TabsTrigger value="completed" className="text-base px-6 h-10">
          Completed Jobs
        </TabsTrigger>
        <TabsTrigger value="overdue" className="text-base px-6 h-10">
          Overdue Jobs
        </TabsTrigger>
        <TabsTrigger value="return-trip" className="text-base px-6 h-10">
          Return Trip Needed
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
