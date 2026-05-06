import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "QC Vision — AI-Powered Quality Control Platform",
  description:
    "Enterprise carton-printing quality control: pre-print artwork validation and post-print inspection, powered by AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 font-sans text-slate-900">
        {children}
      </body>
    </html>
  );
}
