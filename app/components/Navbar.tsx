"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { trackEvent } from "@/lib/analytics/trackEvent";

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
  const [open, setOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const isMobile = useIsMobile(768);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
        setAdminOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    const checkAdmin = async (token?: string) => {
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

    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const currentSession = data.session;
      setSession(currentSession);
      await checkAdmin(currentSession?.access_token);
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        await checkAdmin(session?.access_token);

        if (_event === "SIGNED_IN") {
          trackEvent({ event_type: "login" });
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setOpen(false);
    window.location.href = "/login";
  };

  const NavSection = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: "grid",
      gap: 4,
      paddingTop: 4,
      paddingBottom: 6,
    }}
  >
    {children}
  </div>
);

  const NavHeading = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      borderTop: "1px solid #f0f0f0",
      paddingTop: 8,
      marginTop: 4,
      marginBottom: 2,
      fontSize: 11,
      fontWeight: 700,
      color: "#9ca3af",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    }}
  >
    {children}
  </div>
);

  const NavItem = ({
    href,
    children,
    disabled = false,
  }: {
    href: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => {
    if (disabled) {
      return (
        <span
          style={{
            ...linkStyle,
            color: "#9ca3af",
            cursor: "not-allowed",
          }}
        >
          {children}
        </span>
      );
    }

    return (
      <a
        href={href}
        onClick={() => setOpen(false)}
        style={linkStyle}
        className="tm-nav-item"
      >
        {children}
      </a>
    );
  };

  const NavLinks = () => (
  <>
    <NavSection>
      <NavItem href="/today">
        Tänään{" "}
        <span
          style={{
            marginLeft: 6,
            padding: "2px 6px",
            borderRadius: 999,
            background: "#dbeafe",
            color: "#1d4ed8",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          BETA
        </span>
      </NavItem>

      <NavItem href="/projects">Hankkeet / Kartta</NavItem>
      <NavItem href="/watchlists">Hakuvahdit</NavItem>
      <NavItem href="/crm">Omat</NavItem>
      <NavItem href="/tasks">Tehtävät</NavItem>
      <NavItem href="/team">Tiiminäkymä</NavItem>
    </NavSection>

    {isAdmin && (
      <div
        style={{ position: isMobile ? "static" : "relative", borderTop: "1px solid #f0f0f0", paddingTop: 8, marginTop: 4 }}
        onMouseEnter={() => !isMobile && setAdminOpen(true)}
        onMouseLeave={() => !isMobile && setAdminOpen(false)}
      >
        <button
          type="button"
          onClick={() => setAdminOpen((v) => !v)}
          style={adminButtonStyle}
          className="tm-nav-item"
        >
          <span>⚙️ Admin</span>
          <span>{isMobile ? (adminOpen ? "▲" : "▼") : "◀"}</span>
        </button>

        {adminOpen && (
          <div
            style={
              isMobile
                ? undefined
                : {
                    position: "absolute",
                    top: 0,
                    right: "100%",
                    marginRight: 0,
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 10,
                    minWidth: 240,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                    display: "grid",
                    gap: 2,
                  }
            }
          >
            <NavSection>
              <NavItem href="/dashboard">Dashboard</NavItem>
              <NavItem href="/dashboard/users">Käyttäjät</NavItem>
              <NavItem href="/dashboard/analytics">Analytiikka</NavItem>
              <NavItem href="/dashboard/messages">Viestit</NavItem>
              <NavItem href="/tic">Työmaat Intelligence Center</NavItem>
            </NavSection>

            <NavHeading>🚧 Tulossa</NavHeading>

            <NavSection>
              <NavItem href="#" disabled>
                CRM
              </NavItem>

              <NavItem href="#" disabled>
                Raportit
              </NavItem>
            </NavSection>
          </div>
        )}
      </div>
    )}

    <button onClick={handleLogout} style={logoutStyle} className="tm-nav-item">
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
      <style jsx global>{`
        .tm-nav-item {
          background: none;
          border-radius: 8px;
          transition: background-color 0.1s ease;
        }
        .tm-nav-item:hover,
        .tm-nav-item:focus-visible {
          background-color: #f3f4f6;
        }
      `}</style>

      <a
        href="/today"
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
          © Sippola Enterprises Oy
        </span>
      </a>

      <div ref={menuRef} style={{ marginLeft: "auto", position: "relative" }}>
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
                  minWidth: 280,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                  display: "grid",
                  gap: 2,
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
  display: "block",
  textDecoration: "none",
  color: "#111827",
  fontWeight: 600,
  fontSize: 15,
  padding: "8px 10px",
};

const adminButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  border: "none",
  padding: "8px 10px",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 700,
  color: "#9ca3af",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const logoutStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  cursor: "pointer",
  border: "none",
  padding: "8px 10px",
  textAlign: "left",
  color: "#b91c1c",
  fontWeight: 700,
  fontSize: 15,
};