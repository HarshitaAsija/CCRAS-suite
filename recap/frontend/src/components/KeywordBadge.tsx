// KeywordBadge Component
// Clickable badge component for paper keywords that navigates to search page
// Used in PaperCard and PaperDetail pages

"use client";

import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

interface KeywordBadgeProps {
  keyword: string;
  variant?: "default" | "secondary" | "destructive" | "outline-solid";
  size?: "sm" | "md" | "lg";
  clickable?: boolean;
  className?: string;
}

export function KeywordBadge({
  keyword,
  variant = "secondary",
  size = "sm",
  clickable = true,
  className = "",
}: KeywordBadgeProps) {
  const router = useRouter();

  const handleClick = () => {
    if (clickable) {
      router.push(`/search?q=${encodeURIComponent(keyword)}&type=keyword`);
    }
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <Badge
      variant={variant}
      className={`
        ${sizeClasses[size]}
        ${clickable ? "cursor-pointer hover:shadow-md transition-all duration-200" : ""}
        ${variant === "secondary" ? "bg-linear-to-r from-purple-100 to-indigo-100 text-purple-700 hover:from-purple-200 hover:to-indigo-200 border-purple-200" : ""}
        ${className}
      `}
      onClick={handleClick}
    >
      {keyword}
    </Badge>
  );
}