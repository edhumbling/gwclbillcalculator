'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function SignInPage() {
  const router = useRouter()

  useEffect(() => {
    // Stack Auth middleware will handle the redirect
    // But we can also construct the URL client-side
    const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID
    if (projectId) {
      window.location.href = `https://stack-auth.com/sign-in?projectId=${projectId}&redirectUrl=${encodeURIComponent(window.location.origin + '/')}`
    }
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg, #0b1020)',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--card, #0e1430)',
        border: '1px solid var(--border, #1a1f3a)',
        borderRadius: '14px',
        padding: '32px',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center'
      }}>
        <h1 style={{
          marginBottom: '24px',
          fontSize: '24px',
          fontWeight: '700',
          color: 'var(--text, #e2e8f0)'
        }}>
          Redirecting to sign in...
        </h1>
        <p style={{ color: 'var(--muted, #64748b)' }}>
          Please wait while we redirect you.
        </p>
      </div>
    </div>
  )
}
