'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import StackProvider to avoid SSR/build issues
const StackProvider = dynamic(
  () => import('@stackframe/stack').then(mod => mod.StackProvider),
  { ssr: false }
)

export default function StackProviderWrapper({ children }) {
  const [mounted, setMounted] = useState(false)
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID
  const publishableClientKey = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY

  useEffect(() => {
    setMounted(true)
  }, [])

  // During SSR/build, render children without StackProvider to avoid serialization errors
  if (!mounted || typeof window === 'undefined') {
    return <>{children}</>
  }

  // Only render StackProvider on client side after mount
  return (
    <StackProvider
      projectId={projectId || ''}
      publishableClientKey={publishableClientKey || ''}
    >
      {children}
    </StackProvider>
  )
}
