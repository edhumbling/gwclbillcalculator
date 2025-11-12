'use client'

import { StackProvider } from '@stackframe/stack'

export default function StackProviderWrapper({ children }) {
  // Get env vars - these should be set in Vercel
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID
  const publishableClientKey = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY

  // According to Neon Auth docs, StackProvider should always be rendered
  // Only render if we have valid env vars (don't pass empty strings)
  if (!projectId || !publishableClientKey) {
    // If env vars are missing, render children without provider
    // Components will handle missing auth gracefully
    return <>{children}</>
  }

  // Always render StackProvider when env vars are present
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
