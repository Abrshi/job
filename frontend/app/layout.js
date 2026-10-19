import "./globals.css";
import { AuthProvider } from "@/context/auth-context";

export const metadata = {
  title: "Job Platform — Unified Job Search & Aggregation",
  description: "Find and manage jobs across multiple platforms in one seamless workspace.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-stormy-canvas text-stormy-main">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
