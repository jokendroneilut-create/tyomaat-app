"use client";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasTeam, setHasTeam] = useState(false);
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile(768);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const currentSession = data.session;
      setSession(currentSession);

      const userId = currentSession?.user?.id;
      const token = currentSession?.access_token;

      if (userId) {
        const { data: memberRow } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", userId)
          .maybeSingle();

        setHasTeam(!!memberRow);
      } else {
        setHasTeam(false);
      }

      if (!token) {
        setIsAdmin(false);
        return;
      }

      try {
        const res = await fetch("/api/admin/is-admin", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const json = await res.json();
        setIsAdmin(json.isAdmin === true);
      } catch {
        setIsAdmin(false);
      }
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      const userId = session?.user?.id;
      const token = session?.access_token;

      if (userId) {
        const { data: memberRow } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", userId)
          .maybeSingle();

        setHasTeam(!!memberRow);
      } else {
        setHasTeam(false);
      }

      if (!token) {
        setIsAdmin(false);
        return;
      }

      try {
        const res = await fetch("/api/admin/is-admin", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const json = await res.json();
        setIsAdmin(json.isAdmin === true);
      } catch {
        setIsAdmin(false);
      }
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

  const NavItem = ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a
      href={href}
      onClick={() => setOpen(false)}
      style={linkStyle}
    >
      {children}
    </a>
  );

  const NavLinks = () => (
    <>
      {isAdmin && <NavItem href="/dashboard">Dashboard</NavItem>}

      <NavItem href="/projects">Kartta</NavItem>
      <NavItem href="/watchlists">Hakuvahdit</NavItem>
      <NavItem href="/crm">Omat</NavItem>
      <NavItem href="/tasks">Tehtävät</NavItem>

      {hasTeam ? (
        <NavItem href="/team">Tiiminäkymä</NavItem>
      ) : (
        <NavItem href="/team">Luo tiimi</NavItem>
      )}

      {isAdmin && <NavItem href="/dashboard/messages">Viestit</NavItem>}

      <button
        onClick={handleLogout}
        style={logoutStyle}
      >
        Kirjaudu ulos
      </button>

      <div
        style={{
          borderTop: "1px solid #e5e7eb",
          paddingTop: 10,
          marginTop: 4,
          fontSize: 12,
          color: "#6b7280",
          wordBreak: "break-word",
        }}
      >
        Kirjautunut:
        <br />
        <strong>{session?.user?.email || "-"}</strong>
      </div>
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
      <a
        href="/projects"
        onClick={() => setOpen(false)}
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          gap: isMobile ? "4px" : "12px",
          textDecoration: "none",
          color: "inherit",
          minWidth: 0,
        }}
      >
        <Image
          src="/logo_ilman_taustaa.png"
          alt="Tyomaat.fi logo"
          width={150}
          height={45}
          style={{ height: "32px", width: "auto" }}
          priority
        />

        <span
          style={{
            color: "#666",
            fontSize: isMobile ? "12px" : "14px",
            lineHeight: "1.2",
            whiteSpace: "nowrap",
          }}
        >
          © Sippola Enterprises
        </span>
      </a>

      <div style={{ marginLeft: "auto", position: "relative" }}>
        {!session ? (
          <a
            href="/login"
            onClick={() => setOpen(false)}
            style={{ textDecoration: "none", color: "#111827", fontWeight: 700 }}
          >
            Kirjaudu
          </a>
        ) : (
          <>
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
                  minWidth: 220,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <NavLinks />
              </div>
            )}
          </>
        )}
      </div>
    </nav>
  );
}

const linkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "#111827",
  fontWeight: 600,
};

const logoutStyle: React.CSSProperties = {
  cursor: "pointer",
  border: "none",
  background: "transparent",
  padding: 0,
  textAlign: "left",
  color: "#b91c1c",
  fontWeight: 700,
};