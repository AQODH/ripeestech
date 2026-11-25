import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { default: "RIPEES", template: "%s · RIPEES" },
  description: "Ecommerce, custom software and business integrations, built in Kampala, Uganda.",
  applicationName: "RIPEES",
  authors: [{ name: "RIPEES" }],
  icons: {
    icon: [
      { url: "/favicon.svg?v=ripees-mark-2", type: "image/svg+xml" },
      { url: "/assets/favicon-32.png?v=ripees-mark-2", sizes: "32x32", type: "image/png" },
    ],
    apple: "/assets/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ecf1f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1328" },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
