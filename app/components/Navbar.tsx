"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}

export default function Navbar() {
  const [session, setSession] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile(768);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setOpen(false);
    window.location.href = "/login";
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      <Link href="/watchlists" style={{ textDecoration: "none" }} onClick={onClick}>
        Hakuvahdit
      </Link>
      <Link href="/crm" style={{ textDecoration: "none" }} onClick={onClick}>
        Omat
      </Link>
      <Link href="/tasks" style={{ textDecoration: "none" }} onClick={onClick}>
        Tehtävät
      </Link>
      <button
        onClick={() => {
          onClick?.();
          handleLogout();
        }}
        style={{ cursor: "pointer" }}
      >
        Kirjaudu ulos
      </button>
    </>
  );

  return (
    <nav
      style={{
        display: "flex",
        padding: "12px 16px",
        borderBottom: "1px solid #eee",
        alignItems: "center",
        gap: 12,
        position: "sticky",
        top: 0,
        background: "#fff",
        zIndex: 20,
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
          minWidth: 0,
        }}
        onClick={() => setOpen(false)}
      >
        <Image
          src="/logo_ilman_taustaa.png"
          alt="Tyomaat.fi logo"
          width={150}
          height={45}
          style={{ height: "32px", width: "auto" }}
          priority
        />
        {!isMobile && (
          <span style={{ color: "#666", fontSize: "14px", whiteSpace: "nowrap" }}>
            © Sippola Enterprises
          </span>
        )}
      </Link>

      <div style={{ marginLeft: "auto" }}>
        {!session ? (
          <Link href="/login" onClick={() => setOpen(false)} style={{ textDecoration: "none" }}>
            Kirjaudu
          </Link>
        ) : isMobile ? (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setOpen((v) => !v)}
              style={{
                cursor: "pointer",
                border: "1px solid #e5e7eb",
                background: "#fff",
                borderRadius: 10,
                padding: "8px 10px",
                fontWeight: 700,
              }}
            >
              Valikko
            </button>

            {open && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 10,
                  minWidth: 180,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <NavLinks onClick={() => setOpen(false)} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <NavLinks />
          </div>
        )}
      </div>
    </nav>
  );
}