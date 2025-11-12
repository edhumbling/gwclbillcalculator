import { StackServerApp } from '@stackframe/stack'

export const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
  urls: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    afterSignIn: '/',
    afterSignOut: '/',
  },
  projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID || '',
  publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY || '',
  secretServerKey: process.env.STACK_SECRET_SERVER_KEY || '',
})

