'use client'

import { StackProvider } from '@stackframe/stack'
import { useEffect, useState } from 'react'

export default function StackProviderWrapper({ children }) {
  const [mounted, setMounted] = useState(false)
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID
  const publishableClientKey = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY

  useEffect(() => {
    setMounted(true)
  }, [])

  // During SSR or before mount, don't render StackProvider
  // This prevents the initialization error
  if (!mounted) {
    return <>{children}</>
  }

  // If env vars are missing, render without provider
  if (!projectId || !publishableClientKey) {
    return <>{children}</>
  }

  // On client with valid config, render with StackProvider synchronously
  // This ensures useStackApp hooks work correctly
  return (
    <StackProvider
      projectId={projectId}
      publishableClientKey={publishableClientKey}
    >
      {children}
    </StackProvider>
  )
}
