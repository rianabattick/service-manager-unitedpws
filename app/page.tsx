import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/db"

export default async function HomePage() {
  const user = await getCurrentUser()

  // If the user is already logged in, send them to their dashboard
  if (user) {
    if (user.role === "technician") {
      redirect("/technician")
    } else {
      redirect("/manager")
    }
  }

  // Otherwise, force them to the login page immediately
  redirect("/login")
}
