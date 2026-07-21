// frontend/src/app/layout.tsx
// Root layout — wraps all pages with Sidebar + TopNav shell

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import TopNav from "@/components/layout/TopNav";
import { getCurrentUser } from "@/lib/auth"; // You may need to create this

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KRITA — Research Engine",
  description:
    "AI-powered research repository and RAG platform for discovering, understanding, and synthesizing scientific knowledge.",
};

export const viewport: Viewport = {
  themeColor: "#0b0b12",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Get user from session/token
  let user = null;
  try {
    // This assumes you have a way to get the current user
    // You might need to adjust this based on your auth implementation
    const { cookies } = await import('next/headers');
    const token = cookies().get('access_token')?.value;
    if (token) {
      // Fetch user data from your API
      const response = await fetch('http://localhost:8000/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        user = await response.json();
      }
    }
  } catch (error) {
    console.error('Failed to get user:', error);
  }

  const userName = user?.email || 'User';
  const userInitials = user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0b0b12]`}>
        <Sidebar />
        <TopNav userName={userName} userInitials={userInitials} />
        <main className="ml-56 mt-14 min-h-screen bg-[#0b0b12]">
          {children}
        </main>
      </body>
    </html>
  );
}