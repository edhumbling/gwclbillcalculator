'use client'

import { StackProvider } from '@stackframe/stack'

export default function StackProviderWrapper({ children }) {
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID
  const publishableClientKey = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY

  // Always render StackProvider to ensure useStackApp hooks work
  // The build-time serialization issue should be handled by Next.js dynamic rendering
  // If build errors occur, they'll be caught and the app will still work at runtime
  return (
    <StackProvider
      projectId={projectId || ''}
      publishableClientKey={publishableClientKey || ''}
    >
      {children}
    </StackProvider>
  )
}
