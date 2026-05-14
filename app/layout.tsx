import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SessionProvider from "@/components/shell/SessionProvider";
import "@/styles/globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  // Object form lets sub-pages set their own title without losing the
  // brand suffix. A page that sets `title: "Settings"` will render as
  // "Settings — PublishOS by Design Value" in the browser tab.
  title: {
    default: "PublishOS by Design Value",
    template: "%s — PublishOS by Design Value",
  },
  description: "Your folders, files, and sites — on the web in seconds.",
  applicationName: "PublishOS by Design Value",
  // Icons are auto-discovered by Next.js from app/favicon.ico,
  // app/icon.png, and app/apple-icon.png — no explicit `icons` metadata
  // needed. Drop replacements in those files to update them.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
