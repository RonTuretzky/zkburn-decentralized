import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZKBurn",
  description:
    "Empowering Sex Workers with Verifiable, Anonymous Safety — zkPassport identities, mutual-consent interaction records, burns and vouches on Gnosis Chain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-black text-gray-300 antialiased">{children}</body>
    </html>
  );
}
