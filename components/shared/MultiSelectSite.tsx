"use client"

import { useState } from "react"
import { X, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface Site {
  id: string
  name: string
  city: string | null
  state: string | null
}

interface MultiSelectSiteProps {
  sites: Site[]
  selectedSiteIds: string[]
  onChange: (siteIds: string[]) => void
  disabled?: boolean
  onEditSite?: (siteId: string) => void
  onDeleteSite?: (siteId: string) => void
  siteNotes?: Record<string, string>
  onSiteNotesChange?: (siteId: string, notes: string) => void
}

export function MultiSelectSite({
  sites,
  selectedSiteIds,
  onChange,
  disabled,
  onEditSite,
  onDeleteSite,
  siteNotes = {},
  onSiteNotesChange,
}: MultiSelectSiteProps) {
  const [isOpen, setIsOpen] = useState(false)

  const selectedSites = sites.filter((site) => selectedSiteIds.includes(site.id))
  const availableSites = sites.filter((site) => !selectedSiteIds.includes(site.id))

  const handleAddSite = (siteId: string) => {
    onChange([...selectedSiteIds, siteId])
    setIsOpen(false)
  }

  const handleRemoveSite = (siteId: string) => {
    onChange(selectedSiteIds.filter((id) => id !== siteId))
    if (onSiteNotesChange) {
      onSiteNotesChange(siteId, "")
    }
  }

  return (
    <div className="space-y-2">
      {/* Selected sites */}
      {selectedSites.length > 0 && (
        <div className="space-y-3">
          {selectedSites.map((site) => (
            <div key={site.id} className="border border-border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="gap-1 pr-1">
                  <span>
                    {site.name} - {site.city}, {site.state}
                  </span>
                  <div className="flex items-center gap-0.5 ml-1">
                    {onEditSite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditSite(site.id)
                        }}
                        className="hover:bg-muted rounded-full p-0.5"
                        disabled={disabled}
                        title="Edit site"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    {onDeleteSite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Delete site "${site.name}"? This will remove it from the database.`)) {
                            onDeleteSite(site.id)
                          }
                        }}
                        className="hover:bg-destructive/20 rounded-full p-0.5"
                        disabled={disabled}
                        title="Delete site from database"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveSite(site.id)}
                      className="hover:bg-muted rounded-full p-0.5"
                      disabled={disabled}
                      title="Remove from this job"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </Badge>
              </div>

              {onSiteNotesChange && (
                <div className="ml-4 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Site Notes (optional)</label>
                  <textarea
                    value={siteNotes[site.id] || ""}
                    onChange={(e) => onSiteNotesChange(site.id, e.target.value)}
                    placeholder="Example: Roof access through stairwell, unit under stairs, call security..."
                    className="w-full px-2 py-1.5 text-sm border border-border rounded resize-y min-h-[60px]"
                    disabled={disabled}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dropdown to add more sites */}
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled || availableSites.length === 0}
          className="w-full justify-start"
        >
          {selectedSites.length === 0
            ? "Select site addresses..."
            : `${selectedSites.length} site${selectedSites.length > 1 ? "s" : ""} selected`}
        </Button>

        {isOpen && availableSites.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {availableSites.map((site) => (
              <button
                key={site.id}
                type="button"
                onClick={() => handleAddSite(site.id)}
                className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
              >
                {site.name} - {site.city}, {site.state}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
