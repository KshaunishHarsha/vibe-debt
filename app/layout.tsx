import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ConvexClientProvider from "./ConvexClientProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "How Cooked Is Your Repo?",
  description: "Paste a public GitHub repo, get a deterministic Cooked Score and a roast.",
};

const datafastWebsiteId = process.env.NEXT_PUBLIC_DATAFAST_WEBSITE_ID;
const datafastDomain = process.env.NEXT_PUBLIC_DATAFAST_DOMAIN;

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
      <body className="min-h-full flex flex-col">
        {datafastWebsiteId && datafastDomain && (
          <Script
            defer
            data-website-id={datafastWebsiteId}
            data-domain={datafastDomain}
            src="https://datafa.st/js/script.js"
            strategy="afterInteractive"
          />
        )}
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
