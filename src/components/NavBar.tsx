import type { Session } from "@supabase/supabase-js";
import { LoginModalButton } from "./LoginModalButton";
import rolandLogo from "../assets/images/Roland_Logo_White.png";

export interface NavBarProps {
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
  authLoading: boolean;
}

export function NavBar({
  session,
  signInWithGoogle,
  signInWithGithub,
  signOut,
  authLoading,
}: NavBarProps) {
  return (
    <nav className="fixed top-0 right-0 left-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-neutral-800">
      {/* LEFT SIDE - Roland Logo */}
      <div className="flex items-center pl-10">
        <img
          src={rolandLogo}
          alt="Roland Logo"
          className="h-10"
          draggable={false}
        />
      </div>
      {/* RIGHT SIDE - Auth + Navigation */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-widest text-amber-100/80 uppercase">
          {session ? "Signed In" : "Log In"}
        </span>
        {authLoading ? (
          <div className="text-sm text-neutral-400">...</div>
        ) : (
          <LoginModalButton
            session={session}
            signInWithGoogle={signInWithGoogle}
            signInWithGithub={signInWithGithub}
            signOut={signOut}
            loading={authLoading}
          />
        )}
      </div>
      <div className="flex items-center gap-3 pr-10">
        <a
          href="#/about"
          className="eurostile text-lg font-semibold tracking-widest text-amber-100/80 uppercase transition-colors hover:text-amber-200"
        >
          ABOUT
        </a>
        <a
          href="#/beats"
          className="eurostile text-lg font-semibold tracking-widest text-amber-100/80 uppercase transition-colors hover:text-amber-200"
        >
          BEATS
        </a>
        <a
          href="#/community"
          className="eurostile text-lg font-semibold tracking-widest text-amber-100/80 uppercase transition-colors hover:text-amber-200"
        >
          COMMUNITY
        </a>
      </div>
    </nav>
  );
}
