'use client'

import { StackAuth } from '@stackframe/stack'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function SignInPage() {
  const router = useRouter()

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
        width: '100%'
      }}>
        <h1 style={{
          marginBottom: '24px',
          fontSize: '24px',
          fontWeight: '700',
          color: 'var(--text, #e2e8f0)',
          textAlign: 'center'
        }}>
          Sign In
        </h1>
        <StackAuth
          fullPage={false}
          afterSignInUrl="/"
        />
      </div>
    </div>
  )
}

