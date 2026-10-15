import { create } from 'zustand';
import type { Profile, Role } from '@/db/types';

interface SessionState {
  profile: Profile | null;
  unlock: (profile: Profile) => void;
  lock: () => void;
  isOwner: () => boolean;
  role: () => Role | null;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  profile: null,
  unlock: (profile) => set({ profile }),
  lock: () => set({ profile: null }),
  isOwner: () => get().profile?.role === 'owner',
  role: () => get().profile?.role ?? null,
}));
