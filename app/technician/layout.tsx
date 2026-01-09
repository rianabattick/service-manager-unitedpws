import type React from "react"
import { TechnicianNav } from "./technician-nav"
import Image from "next/image"

export default function TechnicianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 text-slate-100 p-4 flex flex-col">
        <div className="mb-6 bg-white p-4 rounded-lg">
          <Image
            src="/images/united-power-logo.png"
            alt="United Power System"
            width={200}
            height={40}
            className="mb-4"
            priority
          />
          {/* App Title */}
          <h1 className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Technician</h1>
        </div>

        {/* Navigation */}
        <TechnicianNav />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 px-8 py-6">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
