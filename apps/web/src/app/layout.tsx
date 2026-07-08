import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Consilience",
    template: "%s · Consilience",
  },
  description:
    "Multi-agent research that converges on verified claims. Independent agents gather sources, cross-check each other, and report with per-claim confidence and full attribution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#0e7569",
          borderRadius: "0.625rem",
          fontFamily: "var(--font-inter), sans-serif",
        },
      }}
    >
      <html
        lang="en"
        suppressHydrationWarning
        className={`${inter.variable} ${newsreader.variable} ${jetbrainsMono.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col font-sans">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
