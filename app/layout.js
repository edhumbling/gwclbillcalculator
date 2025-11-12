import './globals.css'
import { Inter } from 'next/font/google'
import { StackProvider } from '@stackframe/stack'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'GWCL Current Bill Calculator',
  description: 'Calculate Ghana Water Company Limited (GWCL) current bill for Domestic Category 611 using 2025 Q3 tariffs.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <StackProvider
          projectId={process.env.NEXT_PUBLIC_STACK_PROJECT_ID}
          publishableClientKey={process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY}
        >
          {children}
        </StackProvider>
      </body>
    </html>
  )
}
