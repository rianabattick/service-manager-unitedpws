import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Added utility functions for status badge colors
export function getStatusColor(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
    case "confirmed":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    case "completed":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
    case "cancelled":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    case "on_hold":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
    case "overdue":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
  }
}

export function getTechnicianStatusColor(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
    case "accepted":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
    case "declined":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    case "cancelled":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
  }
}
