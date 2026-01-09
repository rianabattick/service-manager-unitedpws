"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { logout } from "@/app/actions/auth"

const navItems = [
  { label: "Dashboard", href: "/manager" },
  { label: "Contracts", href: "/manager/contracts" },
  { label: "Jobs", href: "/manager/jobs" },
  { label: "Schedule", href: "/manager/schedule" },
  { label: "Field Engineers", href: "/manager/technicians" }, // Changed from "Technicians" to "Field Engineers"
]

export function ManagerNav() {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)
  const [userName, setUserName] = useState<string>("")

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await fetch("/api/notifications/unread-count")
        if (response.ok) {
          const data = await response.json()
          setUnreadCount(data.count || 0)
        }
      } catch (error) {
        console.error("[v0] Error fetching unread count:", error)
      }
    }

    const fetchUserName = async () => {
      try {
        const response = await fetch("/api/user/current")
        if (response.ok) {
          const data = await response.json()
          const firstName = data.full_name ? data.full_name.split(" ")[0] : ""
          setUserName(firstName)
        }
      } catch (error) {
        console.error("[v0] Error fetching user name:", error)
      }
    }

    fetchUnreadCount()
    fetchUserName()

    // Refresh count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000)

    return () => clearInterval(interval)
  }, [])

  return (
    <nav className="flex flex-col h-full">
      <div className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block w-full px-3 py-2 rounded-md text-sm transition-colors ${
                isActive ? "bg-slate-800 font-semibold text-slate-100" : "text-slate-200 hover:bg-slate-800"
              }`}
            >
              {item.label}
            </Link>
          )
        })}

        <div className="mt-6 pt-4 border-t border-slate-800">
          <Link
            href="/manager/notifications"
            className={`block w-full px-3 py-2 rounded-md text-sm transition-colors relative ${
              pathname === "/manager/notifications"
                ? "bg-slate-800 font-semibold text-slate-100"
                : "text-slate-200 hover:bg-slate-800"
            }`}
          >
            <span className="flex items-center justify-between">
              Notifications
              {unreadCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                </span>
              )}
            </span>
          </Link>
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-slate-800 space-y-2">
        {userName && <div className="px-3 py-2 text-sm text-slate-300">Welcome, {userName}</div>}
        <button
          onClick={() => logout()}
          className="block w-full px-3 py-2 rounded-md text-sm transition-colors text-slate-200 hover:bg-slate-800 text-left"
        >
          Logout
        </button>
      </div>
    </nav>
  )
}
