"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import AIHealthIndicator from "./AIHealthIndicator";

type NavSubItem = {
  href: string;
  label: string;
};

type NavItem =
  | {
      href: string;
      label: string;
      dropdown?: undefined;
    }
  | {
      label: string;
      dropdown: NavSubItem[];
      href?: undefined;
    };

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  
  // Określ aktualny moduł na podstawie ścieżki
  const getCurrentModule = () => {
    if (pathname.startsWith('/crm')) return 'CRM';
    if (pathname.startsWith('/company-selection')) return 'LEAD_SELECTION';
    return 'MAILING';
  };
  const currentModule = getCurrentModule();
  const [selectedModule, setSelectedModule] = useState<'MAILING' | 'CRM' | 'LEAD_SELECTION'>(currentModule);

  // Synchronizuj wybór modułu ze ścieżką
  useEffect(() => {
    if (pathname.startsWith('/crm')) {
      setSelectedModule('CRM');
    } else if (pathname.startsWith('/company-selection')) {
      setSelectedModule('LEAD_SELECTION');
    } else {
      setSelectedModule('MAILING');
    }
  }, [pathname]);

  // Menu dla modułu Mailing
  const mailingNavItems: NavItem[] = [
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

  // Menu dla modułu CRM
  const crmNavItems: NavItem[] = [
    { 
      href: "/crm", 
      label: "Dashboard"
    },
    { 
      href: "/crm/leads", 
      label: "Leady"
    },
    { 
      href: "/crm/sequences", 
      label: "Sekwencje"
    },
    { 
      href: "/crm/responses", 
      label: "Odpowiedzi AI"
    },
    { 
      href: "/crm/reports", 
      label: "Raporty"
    }
  ];

  // Menu dla modułu Wyboru Leadów
  const leadSelectionNavItems: NavItem[] = [
    { 
      href: "/company-selection", 
      label: "Dashboard"
    },
    { 
      href: "/company-selection/import", 
      label: "Import CSV"
    },
    { 
      href: "/company-selection/verify", 
      label: "Weryfikacja"
    },
    { 
      href: "/company-selection/selections", 
      label: "Nowa baza firm"
    },
    { 
      href: "/company-selection/blocked", 
      label: "Zablokowane firmy"
    },
    { 
      href: "/company-selection/segments", 
      label: "Segmenty i branże"
    },
    { 
      href: "/company-selection/logs", 
      label: "Logi"
    }
  ];

  const navItems: NavItem[] = selectedModule === 'CRM' 
    ? crmNavItems 
    : selectedModule === 'LEAD_SELECTION'
    ? leadSelectionNavItems
    : mailingNavItems;

  const handleModuleSwitch = (module: 'MAILING' | 'CRM' | 'LEAD_SELECTION') => {
    setSelectedModule(module);
    if (module === 'CRM') {
      router.push('/crm');
    } else if (module === 'LEAD_SELECTION') {
      router.push('/company-selection');
    } else {
      router.push('/');
    }
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const isDropdownActive = (dropdown: NavSubItem[]) => {
    return dropdown.some((item) => isActive(item.href));
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
        {/* Logo + Module Switcher */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "var(--spacing-md)"
        }}>
          <Link href={selectedModule === 'CRM' ? "/crm" : selectedModule === 'LEAD_SELECTION' ? "/company-selection" : "/"} style={{ 
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
                {selectedModule === 'LEAD_SELECTION' ? 'WYBÓR LEADÓW' : selectedModule}
              </div>
            </div>
          </Link>

          {/* Module Switcher */}
          <div style={{
            display: "flex",
            gap: "4px",
            background: "var(--color-bg-light)",
            borderRadius: "6px",
            padding: "4px",
            border: "1px solid var(--color-border)"
          }}>
            <button
              onClick={() => handleModuleSwitch('MAILING')}
              style={{
                padding: "6px 12px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: "600",
                fontFamily: "'Montserrat', sans-serif",
                letterSpacing: "0.5px",
                border: "none",
                cursor: "pointer",
                background: selectedModule === 'MAILING' ? "var(--color-primary)" : "transparent",
                color: selectedModule === 'MAILING' ? "white" : "var(--color-text)",
                transition: "all 0.2s ease"
              }}
            >
              MAILING
            </button>
            <button
              onClick={() => handleModuleSwitch('CRM')}
              style={{
                padding: "6px 12px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: "600",
                fontFamily: "'Montserrat', sans-serif",
                letterSpacing: "0.5px",
                border: "none",
                cursor: "pointer",
                background: selectedModule === 'CRM' ? "var(--color-primary)" : "transparent",
                color: selectedModule === 'CRM' ? "white" : "var(--color-text)",
                transition: "all 0.2s ease"
              }}
            >
              CRM
            </button>
            <button
              onClick={() => handleModuleSwitch('LEAD_SELECTION')}
              style={{
                padding: "6px 12px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: "600",
                fontFamily: "'Montserrat', sans-serif",
                letterSpacing: "0.5px",
                border: "none",
                cursor: "pointer",
                background: selectedModule === 'LEAD_SELECTION' ? "var(--color-primary)" : "transparent",
                color: selectedModule === 'LEAD_SELECTION' ? "white" : "var(--color-text)",
                transition: "all 0.2s ease"
              }}
            >
              WYBÓR LEADÓW
            </button>
          </div>
        </div>

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
              if ("href" in item && item.href) {
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

              const dropdownItem = item as Extract<NavItem, { dropdown: NavSubItem[] }>;
              const { dropdown } = dropdownItem;
              const isOpen = openDropdown === dropdownItem.label;
              const hasActiveChild = isDropdownActive(dropdown);

              return (
                <div 
                  key={index}
                  style={{ position: "relative" }}
                  onMouseEnter={() => setOpenDropdown(dropdownItem.label)}
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
                      <span>{dropdownItem.label}</span>
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
                        {dropdown.map((subItem) => (
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
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
