import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TopMenu } from "@/components/top-menu";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "IDRANTYA – Mappa Idranti",
  description: "Catasto operativo idranti antincendio sul territorio comunale.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "IDRANTYA",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "theme-color": "#2563eb",
  },
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
        <header className="bg-white shadow p-4 flex justify-between items-center relative z-50">
          <div className="font-bold text-gray-800 text-lg">Mappa Idranti</div>
          <TopMenu />
        </header>
        {children}
      </body>
    </html>
  );
}
