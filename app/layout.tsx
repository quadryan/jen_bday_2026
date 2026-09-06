import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Jen's 23rd Birthday Wish Compilation | 이채은",
  description: "A hidden-until-reveal polaroid wall of birthday wishes for Jennifer Lee, 이채은.",
  openGraph: {
    title: "Jen's 23rd Birthday Wish Compilation | 이채은",
    description: "Leave a little birthday note for Jennifer.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1536,
        height: 864,
        alt: "Jen's 23rd Birthday Wish Compilation"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Jen's 23rd Birthday Wish Compilation | 이채은",
    description: "Leave a little birthday note for Jennifer.",
    images: ["/og.png"]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
