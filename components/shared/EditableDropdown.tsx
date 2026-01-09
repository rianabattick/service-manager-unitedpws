"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface EditableDropdownProps {
  id: string
  value: string
  onChange: (value: string) => void
  options: Array<{ id: string; label: string }>
  onAdd: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  label: string
  addButtonText?: string
}

export function EditableDropdown({
  id,
  value,
  onChange,
  options,
  onAdd,
  onEdit,
  onDelete,
  placeholder = "Select an option...",
  required = false,
  disabled = false,
  label,
  addButtonText = "+ Add",
}: EditableDropdownProps) {
  const [isHovered, setIsHovered] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex gap-2">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
          required={required}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="button" onClick={onAdd} variant="outline">
          {addButtonText}
        </Button>
        {value && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon">
                <Pencil className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(value)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(value)} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
