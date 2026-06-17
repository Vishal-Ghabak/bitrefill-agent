import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bitrefill Agent',
  description: 'Your AI agent can buy anything',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
