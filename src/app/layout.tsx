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
        <header className="bg-white shadow p-4 flex justify-between items-center relative z-50">
          <div className="font-bold text-gray-800 text-lg">Mappa Idranti</div>
          <TopMenu />
        </header>
        {children}
      </body>
    </html>
  );
}
