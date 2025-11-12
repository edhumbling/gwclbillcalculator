'use client'

import { useStackApp } from '@stackframe/stack'
import { useContext, createContext } from 'react'

// Create a context to track if StackProvider is available
const StackProviderContext = createContext(false)

export function useStackProviderAvailable() {
  return useContext(StackProviderContext)
}

// Safe wrapper for useStackApp that returns null if provider isn't available
export function useStackAppSafe() {
  const isProviderAvailable = useStackProviderAvailable()
  
  if (!isProviderAvailable) {
    return null
  }
  
  try {
    return useStackApp()
  } catch (error) {
    return null
  }
}
