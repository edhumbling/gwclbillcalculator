import './globals.css'
import { Inter } from 'next/font/google'
import StackProviderWrapper from './components/StackProviderWrapper'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'GWCL Current Bill Calculator',
  description: 'Calculate Ghana Water Company Limited (GWCL) current bill for Domestic Category 611 using 2025 Q3 tariffs.',
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <StackProviderWrapper>
          {children}
        </StackProviderWrapper>
      </body>
    </html>
  )
}
