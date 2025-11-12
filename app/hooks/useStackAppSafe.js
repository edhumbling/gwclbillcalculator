'use client'

import { useStackApp } from '@stackframe/stack'
import { useEffect, useState } from 'react'

/**
 * Safe wrapper for useStackApp that handles cases where StackProvider isn't available yet
 */
export function useStackAppSafe() {
  const [mounted, setMounted] = useState(false)
  const [app, setApp] = useState(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    try {
      const stackApp = useStackApp()
      setApp(stackApp)
    } catch (error) {
      // StackProvider not available yet, set app to null
      setApp(null)
    }
  }, [mounted])

  return app
}

