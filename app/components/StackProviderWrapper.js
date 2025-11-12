'use client'

import { StackProvider } from '@stackframe/stack'

export default function StackProviderWrapper({ children }) {
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID
  const publishableClientKey = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY

  // Always render StackProvider to ensure useStackApp hooks work
  // Only render if we have valid env vars, otherwise render children without provider
  // Components using useStackApp will need to handle the case where provider might not be fully initialized
  if (!projectId || !publishableClientKey) {
    return <>{children}</>
  }

  return (
    <StackProvider
      projectId={projectId}
      publishableClientKey={publishableClientKey}
    >
      {children}
    </StackProvider>
  )
}
