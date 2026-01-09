"use client"

import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ContractsViewToggleProps {
  currentView: "active" | "ended"
  currentPath: string
  currentSearchParams: Record<string, string>
}

export function ContractsViewToggle({ currentView, currentPath, currentSearchParams }: ContractsViewToggleProps) {
  const router = useRouter()

  const handleViewChange = (view: string) => {
    const params = new URLSearchParams(currentSearchParams)
    params.set("view", view)
    router.push(`${currentPath}?${params.toString()}`)
  }

  return (
    <Tabs value={currentView} onValueChange={handleViewChange}>
      <TabsList className="h-12">
        <TabsTrigger value="active" className="text-base px-6 h-10">
          Active Contracts
        </TabsTrigger>
        <TabsTrigger value="ended" className="text-base px-6 h-10">
          Ended Contracts
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
