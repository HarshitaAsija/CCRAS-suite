"use client";

// frontend/src/components/layout/TopNav.tsx
// Top navigation bar — sign in only

import UserMenu from "../../components/layout/UserMenu";

interface TopNavProps {
  userName?: string;
  userInitials?: string;
}

export default function TopNav({ userName = "User", userInitials = "AR" }: TopNavProps) {
  return (
    <header className="fixed top-0 left-56 right-0 h-14 bg-white/90 backdrop-blur border-b border-violet-100 flex items-center justify-end px-6 z-30 gap-3">
      <UserMenu />
    </header>
  );
}
