import './globals.css'

export const metadata = {
  title: 'joel hoke design',
  icons: {
    icon: { url: '/favicon-32x32.png', type: 'image/png', sizes: '28x32' },
    apple: { url: '/apple-icon-180x180.png', type: 'image/png', sizes: '161x180' },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
