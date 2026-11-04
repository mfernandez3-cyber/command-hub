"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/",
    label: "Home",
    icon: (
      <>
        <path d="M4 11.5 12 5l8 6.5" />
        <path d="M6 10v9h12v-9" />
      </>
    ),
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: (
      <>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17" />
      </>
    ),
  },
  {
    href: "/approvals",
    label: "Approvals",
    icon: (
      <>
        <path d="M12 3.5 19 6v5.5c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6z" />
        <path d="m8.8 12 2.2 2.2 4.2-4.4" />
      </>
    ),
  },
  {
    href: "/agents",
    label: "Team",
    icon: (
      <>
        <circle cx="8.5" cy="9" r="3" />
        <circle cx="16.5" cy="9" r="3" />
        <path d="M3 19c.6-3 2.8-4.5 5.5-4.5S13.4 16 14 19M13.6 15.2c.9-.5 1.8-.7 2.9-.7 2.7 0 4.9 1.5 5.5 4.5" />
      </>
    ),
  },
  {
    href: "/memory",
    label: "Memory",
    icon: (
      <>
        <path d="M6 4h9l3 3v13H6z" />
        <path d="M9.5 11h5M9.5 15h5" />
      </>
    ),
  },
];

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

/** Phone: bottom tab bar. Computer: left sidebar. */
export function TabBar({ pending, who }: { pending: number; who?: string }) {
  const isActive = useActive();
  const badge = (href: string) =>
    href === "/approvals" && pending > 0 ? (
      <span className="min-w-5 rounded-full bg-amber px-1.5 text-center text-[11px] font-bold leading-5 text-[#2b1a00]">
        {pending}
        <span className="sr-only"> waiting</span>
      </span>
    ) : null;

  return (
    <>
      {/* Computer sidebar */}
      <nav aria-label="Main" className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line-soft bg-ground px-4 py-6 md:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <Mark />
          <span className="display text-[19px] font-bold">Command Hub</span>
        </Link>
        <ul className="flex flex-col gap-1">
          {tabs.map((t) => {
            const active = isActive(t.href);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] ${
                    active ? "bg-raised font-semibold text-ink shadow-[var(--shadow)]" : "text-ink-2 hover:bg-raised/60 hover:text-ink"
                  }`}
                >
                  <Icon>{t.icon}</Icon>
                  <span className="flex-1">{t.label}</span>
                  {badge(t.href)}
                </Link>
              </li>
            );
          })}
        </ul>
        {who && <p className="mt-auto px-3 text-[13px] text-ink-3">Signed in as {who}</p>}
      </nav>

      {/* Phone tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line-soft bg-raised/90 pb-[max(env(safe-area-inset-bottom),10px)] pt-1.5 backdrop-blur-xl md:hidden"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map((t) => {
            const active = isActive(t.href);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] ${
                    active ? "font-semibold text-ink" : "text-ink-3"
                  }`}
                >
                  <span className={`flex h-8 w-14 items-center justify-center rounded-full ${active ? "bg-sunken" : ""}`}>
                    <Icon>{t.icon}</Icon>
                  </span>
                  {t.label}
                  {t.href === "/approvals" && pending > 0 && (
                    <span className="absolute right-[18%] top-0">{badge(t.href)}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--ink)" />
      <path d="m9.5 11 5 5-5 5" fill="none" stroke="var(--ground)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.5 21.5h5.5" stroke="var(--amber)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
