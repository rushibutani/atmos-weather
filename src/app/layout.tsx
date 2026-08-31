import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: { default: "Atmos — Weather, clearly", template: "%s · Atmos" }, description: "A fast, modern weather application with hourly forecasts and a 10-day outlook.", applicationName: "Atmos", manifest: "/manifest.webmanifest", openGraph: { title: "Atmos — Weather, clearly", description: "Hourly forecasts and a calm 10-day outlook.", type: "website" }, twitter: { card: "summary_large_image", title: "Atmos — Weather, clearly", description: "A calm, modern view of your weather." }, robots: { index: true, follow: true } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f4f3ef" }, { media: "(prefers-color-scheme: dark)", color: "#111716" }] };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" suppressHydrationWarning><body suppressHydrationWarning style={{ "--font-inter": "Inter, ui-sans-serif, system-ui" } as React.CSSProperties}>{children}</body></html>; }
