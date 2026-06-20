"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSession, SESSION_EVENT } from "@/lib/auth";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function checkSession() {
      if (!getSession()) {
        setReady(false);
        router.replace("/login");
        return;
      }
      setReady(true);
    }

    checkSession();
    window.addEventListener(SESSION_EVENT, checkSession);
    window.addEventListener("storage", checkSession);
    return () => {
      window.removeEventListener(SESSION_EVENT, checkSession);
      window.removeEventListener("storage", checkSession);
    };
  }, [router]);

  if (!ready) {
    return <main className="session-loading" aria-live="polite"><span className="session-spinner" /><strong>Opening workspace</strong></main>;
  }

  return children;
}
