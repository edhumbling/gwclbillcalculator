'use client'

import { StackProvider } from '@stackframe/stack'

export default function StackProviderWrapper({ children }) {
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID
  const publishableClientKey = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY

  // Always render StackProvider, even if env vars are missing
  // This prevents "useStackApp must be used within a StackProvider" errors
  // Components should handle missing configuration gracefully
  return (
    <StackProvider
      projectId={projectId || ''}
      publishableClientKey={publishableClientKey || ''}
    >
      {children}
    </StackProvider>
  )
}

