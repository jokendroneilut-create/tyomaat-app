"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Navbar() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // Hae nykyinen sessio
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    // Kuuntele auth-muutoksia
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <nav
      style={{
        display: "flex",
        gap: "20px",
        padding: "16px",
        borderBottom: "1px solid #eee",
        alignItems: "center",
      }}
    >
      <Link href="/projects">Tyomaat.fi PRO © Sippola Enterprises</Link>

      <div style={{ marginLeft: "auto" }}>
        {!session ? (
          <Link href="/login">Login</Link>
        ) : (
          <button onClick={handleLogout} style={{ cursor: "pointer" }}>
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}