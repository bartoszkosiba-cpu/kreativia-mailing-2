import './globals.css';
import Navbar from './components/Navbar';
import '@/services/startCron'; // Uruchom cron jobs

export const metadata = {
  title: "Kreativia Mailing",
  description: "Wewnętrzne narzędzie do wysyłki maili B2B"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Navbar />
        <main style={{ minHeight: "calc(100vh - 64px)", maxWidth: "1400px", margin: "0 auto", padding: "0 1rem" }}>
          {children}
        </main>
      </body>
    </html>
  );
}



