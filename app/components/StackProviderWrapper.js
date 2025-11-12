'use client'

import { StackProvider } from '@stackframe/stack'
import { useEffect, useState } from 'react'

export default function StackProviderWrapper({ children }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // During SSR/build, just render children without StackProvider
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <StackProvider
      projectId={process.env.NEXT_PUBLIC_STACK_PROJECT_ID}
      publishableClientKey={process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY}
    >
      {children}
    </StackProvider>
  )
}

