import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZKBurn",
  description:
    "Verifiable, anonymous safety for sex workers — zkPassport identities, mutual-consent interaction records, burns and vouches on Gnosis Chain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper-main font-breadBody text-surface-ink antialiased">
        {children}
      </body>
    </html>
  );
}
