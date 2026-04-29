import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import LeftSidebar from "@/components/LeftSidebar";
import MobileTopBar from "@/components/MobileTopBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tribe - Decentralized Social Protocol",
  description:
    "Own your identity, your data, and your social graph. Built on Solana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-gray-50 text-gray-900">
        <Providers>
          <div className="flex min-h-screen">
            <LeftSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <MobileTopBar />
              <main className="flex-1 pb-20 md:pb-0">{children}</main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
