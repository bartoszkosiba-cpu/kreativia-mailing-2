"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import AIHealthIndicator from "./AIHealthIndicator";

export default function Navbar() {
  const pathname = usePathname();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const navItems = [
    { 
      href: "/", 
      label: "Dashboard"
    },
    { 
      label: "Kampanie",
      dropdown: [
        { href: "/campaigns", label: "Kampanie" },
        { href: "/content-planner", label: "Planer treści" },
        { href: "/queue", label: "Kolejka" }
      ]
    },
    { 
      href: "/leads", 
      label: "Leady"
    },
    { 
      label: "Handlowcy",
      dropdown: [
        { href: "/salespeople", label: "Handlowcy" },
        { href: "/warmup", label: "Warmup" },
        { href: "/inbox", label: "Inbox" },
        { href: "/material-decisions", label: "Automatyczne odpowiedzi" }
      ]
    },
    { 
      href: "/archive", 
      label: "Archiwum"
    },
    { 
      href: "/reports", 
      label: "Raporty"
    },
    { 
      label: "Ustawienia",
      dropdown: [
        { href: "/settings", label: "Ustawienia ogólne" },
        { href: "/tags", label: "Zarządzanie tagami" },
        { href: "/ai-chat", label: "AI Chat" }
      ]
    }
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const isDropdownActive = (dropdown: any[]) => {
    return dropdown.some(item => isActive(item.href));
  };

  return (
    <nav style={{
      background: "white",
      borderBottom: `1px solid var(--color-border)`,
      boxShadow: "0 1px 4px rgba(0, 0, 0, 0.08)",
      position: "sticky",
      top: 0,
      zIndex: 1000
    }}>
      <div style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "0 var(--spacing-lg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "64px"
      }}>
        {/* Logo */}
        <Link href="/" style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "var(--spacing-sm)",
          textDecoration: "none"
        }}>
          <div style={{
            width: "40px",
            height: "40px",
            background: "var(--color-primary)",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            fontWeight: "700",
            color: "white",
            fontFamily: "'Montserrat', sans-serif"
          }}>
            K
          </div>
          <div>
            <div style={{ 
              fontSize: "18px", 
              fontWeight: "700", 
              color: "var(--color-text)",
              lineHeight: "1.2",
              fontFamily: "'Montserrat', sans-serif"
            }}>
              Kreativia
            </div>
            <div style={{ 
              fontSize: "10px", 
              color: "#999",
              letterSpacing: "1.5px",
              fontWeight: "500",
              fontFamily: "'Montserrat', sans-serif"
            }}>
              MAILING
            </div>
          </div>
        </Link>

        {/* Navigation */}
        <div style={{ 
          display: "flex", 
          gap: "var(--spacing-md)",
          alignItems: "center"
        }}>
          {/* AI Health Indicator */}
          <AIHealthIndicator />
          
          {/* Menu Items */}
          <div style={{ 
            display: "flex", 
            gap: "var(--spacing-xs)",
            alignItems: "center"
          }}>
            {navItems.map((item, index) => {
              // Simple link (no dropdown)
              if (item.href) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      padding: "var(--spacing-sm) var(--spacing-md)",
                      borderRadius: "4px",
                      fontSize: "14px",
                      fontWeight: "500",
                      fontFamily: "'Montserrat', sans-serif",
                      color: isActive(item.href) ? "var(--color-primary)" : "var(--color-text)",
                      background: isActive(item.href) ? "rgba(216, 30, 66, 0.08)" : "transparent",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive(item.href)) {
                        e.currentTarget.style.background = "var(--color-bg-light)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive(item.href)) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              }

              // Dropdown menu
              if (item.dropdown) {
                const isOpen = openDropdown === item.label;
                const hasActiveChild = isDropdownActive(item.dropdown);

                return (
                  <div 
                    key={index}
                    style={{ position: "relative" }}
                    onMouseEnter={() => setOpenDropdown(item.label)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    <button
                      style={{
                        padding: "var(--spacing-sm) var(--spacing-md)",
                        borderRadius: "4px",
                        fontSize: "14px",
                        fontWeight: "500",
                        fontFamily: "'Montserrat', sans-serif",
                        color: hasActiveChild ? "var(--color-primary)" : "var(--color-text)",
                        background: hasActiveChild ? "rgba(216, 30, 66, 0.08)" : isOpen ? "var(--color-bg-light)" : "transparent",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      <span>{item.label}</span>
                      <span style={{ 
                        fontSize: "10px",
                        transition: "transform 0.2s ease",
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)"
                      }}>▼</span>
                    </button>

                    {/* Dropdown menu */}
                    {isOpen && (
                      <>
                        {/* Niewidzialny "bridge" - zapobiega zamknięciu dropdown przy przesuwaniu myszy */}
                        <div style={{
                          position: "absolute",
                          top: "100%",
                          left: "0",
                          right: "0",
                          height: "8px",
                          background: "transparent",
                          zIndex: 1000
                        }} />
                        
                        <div style={{
                          position: "absolute",
                          top: "calc(100% + 8px)",
                          left: "0",
                          background: "white",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                          minWidth: "200px",
                          padding: "var(--spacing-xs)",
                          zIndex: 1001
                        }}>
                        {item.dropdown.map((subItem) => (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            style={{
                              display: "block",
                              padding: "var(--spacing-sm) var(--spacing-md)",
                              borderRadius: "4px",
                              fontSize: "14px",
                              fontWeight: isActive(subItem.href) ? "600" : "400",
                              color: isActive(subItem.href) ? "var(--color-primary)" : "var(--color-text)",
                              background: isActive(subItem.href) ? "rgba(216, 30, 66, 0.08)" : "transparent",
                              textDecoration: "none",
                              transition: "all 0.2s ease"
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive(subItem.href)) {
                                e.currentTarget.style.background = "var(--color-bg-light)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive(subItem.href)) {
                                e.currentTarget.style.background = "transparent";
                              }
                            }}
                          >
                            {subItem.label}
                          </Link>
                        ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
