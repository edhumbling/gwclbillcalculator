'use client'

import { StackProvider, StackTheme } from '@stackframe/stack'

export default function StackProviderWrapper({ children }) {
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID
  const publishableClientKey = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY

  // If env vars are missing, render without provider
  if (!projectId || !publishableClientKey) {
    return <>{children}</>
  }

  // Always render StackProvider and StackTheme as per Stack Auth docs
  // StackProvider handles SSR gracefully
  return (
    <StackProvider
      projectId={projectId}
      publishableClientKey={publishableClientKey}
    >
      <StackTheme>
        {children}
      </StackTheme>
    </StackProvider>
  )
}
