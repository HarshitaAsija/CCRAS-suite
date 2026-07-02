// Shared types for the RISHI-AI Discover frontend.
// Keep this in sync with the FastAPI backend's response shapes once it exists.

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResult {
  user: User;
}

export interface AuthError {
  message: string;
  field?: 'name' | 'email' | 'password' | 'confirmPassword' | 'form';
}

// Placeholder shape for a "research gap" card on the dashboard.
// This mirrors the eventual /api/gaps response so swapping in real data
// later is a matter of replacing the mock array, not the component props.
export interface GapCard {
  id: string;
  title: string;
  domain: string;
  noveltyScore: number; // 0–1
  feasibilityScore: number; // 0–1
  summary: string;
  evidenceCount: number;
}
