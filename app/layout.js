import './globals.css'

export const metadata = {
  title: 'Nova — Reserve Your Evening',
  description: 'Fine dining reservations at Nova Restaurant',
  icons: {
    icon: '/menu.png',
    shortcut: '/menu.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Montserrat:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/menu.png" type="image/png" />
        <link rel="shortcut icon" href="/menu.png" type="image/png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
