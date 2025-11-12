'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

// Dynamically import StackProvider with SSR disabled to prevent initialization errors
const StackProvider = dynamic(
  () => import('@stackframe/stack').then(mod => mod.StackProvider),
  { 
    ssr: false,
    loading: () => null
  }
)

export default function StackProviderWrapper({ children }) {
  const [mounted, setMounted] = useState(false)
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID
  const publishableClientKey = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY

  useEffect(() => {
    setMounted(true)
  }, [])

  // Only render StackProvider on client side after mount
  // This prevents SSR/hydration issues with Stack Auth internals
  if (!mounted) {
    // During SSR, render children without provider
    return <>{children}</>
  }

  // If env vars are missing, render without provider
  if (!projectId || !publishableClientKey) {
    return <>{children}</>
  }

  // On client with valid config, render with StackProvider
  // StackProvider MUST be rendered for useStackApp hooks to work
  return (
    <StackProvider
      projectId={projectId}
      publishableClientKey={publishableClientKey}
    >
      {children}
    </StackProvider>
  )
}
