// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A signed-in Clerk, for the tutorial screenshots only (vite.capture.mjs
// aliases @clerk/clerk-react to this file). The app builds in cloud mode, so
// the screenshots show what an account sees, with no Clerk and no server:
// capture.py answers /api itself.

export const ClerkProvider = ({ children }) => children
export const useAuth = () => ({ isLoaded: true, isSignedIn: true, userId: 'user_tutorial', getToken: async () => 'tutorial' })
export const SignedIn = ({ children }) => children
export const SignedOut = () => null
export const SignIn = () => null

// The avatar, with its menu left out
export function UserButton() {
  return (
    <span aria-hidden="true" style={{
      display: 'inline-grid', placeItems: 'center', width: 32, height: 32, borderRadius: '50%',
      background: '#1e60ff', color: '#fff', font: '600 13px/1 Inter, sans-serif',
    }}>AR</span>
  )
}
UserButton.MenuItems = () => null
UserButton.Action = () => null
