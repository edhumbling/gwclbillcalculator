'use client'

import { StackProvider } from '@stackframe/stack'

export default function StackProviderWrapper({ children }) {
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID || ''
  const publishableClientKey = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY || ''

  // ALWAYS render StackProvider to ensure useStackApp hooks work
  // Pass empty strings if env vars are missing - StackProvider should handle this gracefully
  // The dynamic = 'force-dynamic' in layout.js prevents static generation issues
  return (
    <StackProvider
      projectId={projectId}
      publishableClientKey={publishableClientKey}
    >
      {children}
    </StackProvider>
  )
}
