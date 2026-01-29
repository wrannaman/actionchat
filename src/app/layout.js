import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://actionchat.io'),
  title: {
    default: "ActionChat — The API is the Admin Panel",
    template: "%s | ActionChat"
  },
  description: "Not another chatbot that links to KB articles. ActionChat turns your openapi.json into an Ops Dashboard that actually executes actions. Self-hosted & open source.",
  authors: [{ name: "ActionChat" }],
  creator: "ActionChat",
  publisher: "ActionChat",
  keywords: ["API", "OpenAPI", "internal tools", "admin panel", "self-hosted", "open source", "docker", "chat", "automation", "ops"],
  openGraph: {
    title: "ActionChat — The API is the Admin Panel",
    description: "Stop building internal tools. Turn your openapi.json into a secure Ops Dashboard in 30 seconds.",
    type: "website",
    locale: "en_US",
    siteName: "ActionChat",
  },
  twitter: {
    card: "summary_large_image",
    title: "ActionChat — The API is the Admin Panel",
    description: "Stop building internal tools. Turn your openapi.json into a secure Ops Dashboard in 30 seconds.",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
            <Toaster />
          </ToastProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
