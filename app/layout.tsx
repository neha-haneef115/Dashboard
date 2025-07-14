import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/context/AppContext'
import { PaymentProvider } from '@/context/PaymentContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BillBuzz - Payment Reminder App',
  description: 'Track and manage your payment reminders',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <PaymentProvider>
            {children}
          </PaymentProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
