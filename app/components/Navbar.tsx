"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Navbar() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

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
        padding: "16px",
        borderBottom: "1px solid #eee",
        alignItems: "center",
      }}
    >
      <Link
        href="/projects"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        {/* Logo */}
        <Image
          src="/logo_ilman_taustaa.png"
          alt="Tyomaat.fi logo"
          width={150}
          height={45}
          style={{ height: "32px", width: "auto" }}
          priority
        />
        <span style={{ color: "#666", fontSize: "14px" }}>
          © Sippola Enterprises
        </span>
      </Link>

      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {!session ? (
          <Link href="/login"></Link>
        ) : (
          <>
            <Link href="/watchlists" style={{ textDecoration: "none" }}>
              Hakuvahdit
            </Link>
            <button onClick={handleLogout} style={{ cursor: "pointer" }}>
              Kirjaudu ulos
            </button>
          </>
        )}
      </div>
    </nav>
  );
}