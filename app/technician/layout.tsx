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
        <div className="mb-6 bg-white p-4 rounded-lg flex flex-col items-center">
          <Image
            src="/images/powerlink-logo.svg"
            alt="Power Link"
            width={240}
            height={72}
            className="mb-4 w-48 h-auto"
            priority
          />
          <h1 className="text-xs uppercase tracking-wide text-slate-400 font-semibold w-full text-center border-t border-slate-100 pt-2">Technician</h1>
        </div>

        {/* Navigation */}
        <TechnicianNav />

        {/* 👇 NEW: Bottom Sidebar Footer */}
        <div className="mt-auto pt-6 pb-2 text-center border-t border-slate-800/50">
          <p className="text-[9px] uppercase tracking-widest text-slate-500">
            Powered by<br/>
            <span className="text-slate-400 font-semibold mt-1 inline-block">United Power System</span>
          </p>
        </div>
        {/* ☝️ End Footer */}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 px-8 py-6">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  )
}