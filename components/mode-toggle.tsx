"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ModeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Wait until mounted to avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="w-10 h-10" /> // Placeholder to prevent layout shift
  }

  return (
    <button
      // Use 'resolvedTheme' to handle "system" preference correctly
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
      title="Toggle Theme"
    >
      <Sun className="h-5 w-5 transition-all scale-100 rotate-0 dark:scale-0 dark:-rotate-90 text-black dark:text-white" />
      <Moon className="absolute h-5 w-5 transition-all scale-0 rotate-90 dark:scale-100 dark:rotate-0 text-black dark:text-white" />
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}