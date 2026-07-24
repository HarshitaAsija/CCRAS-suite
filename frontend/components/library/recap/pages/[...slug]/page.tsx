// @ts-nocheck
// This handles all routes inside /recap/*
// File: components/library/recap/pages/[...slug]/page.tsx

"use client";

import { usePathname } from 'next/navigation';
import RagPage from '../rag/page';
import LibraryPage from '../library/page';
import SnowballingPage from '../snowballing/page';

export default function RecapCatchAllPage() {
  const pathname = usePathname();
  
  // Check if the route is for RAG
  if (pathname?.includes('/recap/rag')) {
    return <RagPage />;
  }
  
  // Check if the route is for Library
  if (pathname?.includes('/recap/library')) {
    return <LibraryPage />;
  }
  
  // Check if the route is for Snowballing
  if (pathname?.includes('/recap/snowballing')) {
    return <SnowballingPage />;
  }
  
  // Add more routes as you create them
  // if (pathname?.includes('/recap/search')) {
  //   return <SearchPage />;
  // }
  // if (pathname?.includes('/recap/upload')) {
  //   return <UploadPage />;
  // }
  
  // Default fallback for routes that don't match
  return (
    <div className="flex items-center justify-center h-full bg-white text-[#2c2540] p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Recap</h1>
        <p className="text-[#8b849c]">Page not found: {pathname}</p>
      </div>
    </div>
  );
}