"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase-client"

interface JobNotesCardProps {
  jobId: string
  managerNotes: string | null
  initialTechNotes: string | null
  userRole: "manager" | "technician" | "owner" | "admin" | "dispatcher"
}

export function JobNotesCard({ jobId, managerNotes, initialTechNotes, userRole }: JobNotesCardProps) {
  const [techNotes, setTechNotes] = useState(initialTechNotes || "")
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const isManagerOrAdmin = ["owner", "admin", "manager", "dispatcher"].includes(userRole)

  async function handleSaveTechNotes() {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("jobs")
        .update({ tech_notes: techNotes })
        .eq("id", jobId)

      if (error) throw error
      
      setSaveMessage("Notes saved successfully!")
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err: any) {
      console.error("Failed to save tech notes:", err)
      setSaveMessage("Failed to save. Try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <Tabs defaultValue="manager" className="w-full">
        
        {/* TAB BUTTONS INSIDE THE CARD HEADER */}
        <CardHeader className="pb-2">
          <TabsList className="h-12 w-fit">
            <TabsTrigger value="manager" className="text-base px-6 h-10">
              Manager Notes
            </TabsTrigger>
            <TabsTrigger value="tech" className="text-base px-6 h-10">
              Tech Notes
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        {/* TAB CONTENT TIGHTLY HUGGING THE HEADER */}
        <CardContent className="pt-2">
          <TabsContent value="manager" className="m-0">
            {managerNotes ? (
              <p className="text-sm whitespace-pre-wrap">{managerNotes}</p>
            ) : (
              <p className="text-muted-foreground text-sm italic">No manager notes added for this job.</p>
            )}
          </TabsContent>

          <TabsContent value="tech" className="m-0">
            <div className="space-y-4">
              {isManagerOrAdmin ? (
                // READ-ONLY VIEW FOR MANAGERS
                <div>
                  {techNotes ? (
                    <p className="text-sm whitespace-pre-wrap">{techNotes}</p>
                  ) : (
                    <p className="text-muted-foreground text-sm italic">No technician notes added yet.</p>
                  )}
                </div>
              ) : (
                // EDITABLE VIEW FOR TECHNICIANS
                <div className="space-y-3">
                  <Textarea 
                    placeholder="Type any on-site observations or notes here..." 
                    value={techNotes}
                    onChange={(e) => setTechNotes(e.target.value)}
                    className="min-h-[120px] text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${saveMessage?.includes("Failed") ? "text-red-500" : "text-green-600"}`}>
                      {saveMessage}
                    </span>
                    <Button 
                      onClick={handleSaveTechNotes} 
                      disabled={isSaving || techNotes === initialTechNotes}
                      size="sm"
                    >
                      {isSaving ? "Saving..." : "Save Notes"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}