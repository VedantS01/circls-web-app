import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from '@/components/Header'
import { MSWComponent } from "@/mocks/MSWComponent";
import ThemeRegistry from '@/components/ThemeRegistry';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Circls - Event & Booking Management",
  description: "Modern event and booking management platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MSWComponent />
        <ThemeRegistry>
          <Header />
          <main className="min-h-screen">{children}</main>
        </ThemeRegistry>
      </body>
    </html>
  );
}
