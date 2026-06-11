import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LogoutButton } from "@/components/logout-button";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Mappa Idranti",
  description: "Dashboard comunale per censire e monitorare idranti sul territorio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="bg-white shadow p-4 flex justify-end">
          <LogoutButton />
        </header>
        {children}
      </body>
    </html>
  );
}
