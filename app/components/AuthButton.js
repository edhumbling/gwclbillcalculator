'use client'

import { useStackApp } from '@stackframe/stack'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AuthButton() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  
  // useStackApp must be called unconditionally - StackProvider is always rendered
  const app = useStackApp()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) {
      return
    }

    // Check if Stack Auth is configured
    const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID
    if (!projectId || !projectId.trim()) {
      setLoading(false)
      return
    }

    // Check if app is available and has required methods
    if (!app || typeof app.getUser !== 'function') {
      setLoading(false)
      return
    }

    app.getUser().then((u) => {
      setUser(u)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [app, mounted])

  const handleSignOut = async () => {
    if (app && typeof app.signOut === 'function') {
      try {
        await app.signOut()
        router.push('/')
        router.refresh()
      } catch (error) {
        console.error('Sign out error:', error)
      }
    }
  }

  // Don't show auth buttons if Stack Auth isn't configured
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID
  if (!projectId || !projectId.trim()) {
    return null
  }

  if (loading) {
    return (
      <div style={{ padding: '8px 16px', color: 'var(--muted, #64748b)' }}>
        Loading...
      </div>
    )
  }

  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: 'var(--text, #e2e8f0)', fontSize: '14px' }}>
          {user.displayName || user.primaryEmail}
        </span>
        <button
          onClick={handleSignOut}
          className="btn ghost"
          style={{ padding: '6px 12px', fontSize: '14px' }}
        >
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        onClick={() => router.push('/auth/signin')}
        className="btn ghost"
        style={{ padding: '6px 12px', fontSize: '14px' }}
      >
        Sign In
      </button>
      <button
        onClick={() => router.push('/auth/signup')}
        className="btn primary"
        style={{ padding: '6px 12px', fontSize: '14px' }}
      >
        Sign Up
      </button>
    </div>
  )
}
