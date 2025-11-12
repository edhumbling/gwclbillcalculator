'use client'

import { StackProvider } from '@stackframe/stack'
import { useEffect, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

function StackProviderErrorFallback({ children }) {
  // If StackProvider fails, render children without provider
  // App will work but auth features won't be available
  return <>{children}</>
}

function StackProviderInner({ children, projectId, publishableClientKey }) {
  return (
    <StackProvider
      projectId={projectId}
      publishableClientKey={publishableClientKey}
    >
      {children}
    </StackProvider>
  )
}

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
    return <>{children}</>
  }

  // If env vars are missing, render without provider
  if (!projectId || !publishableClientKey) {
    return <>{children}</>
  }

  // On client with valid config, render with StackProvider wrapped in error boundary
  // This catches any initialization errors and allows the app to continue working
  return (
    <ErrorBoundary FallbackComponent={() => <StackProviderErrorFallback>{children}</StackProviderErrorFallback>}>
      <StackProviderInner
        projectId={projectId}
        publishableClientKey={publishableClientKey}
      >
        {children}
      </StackProviderInner>
    </ErrorBoundary>
  )
}
