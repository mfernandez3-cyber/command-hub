"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Command", icon: <path d="M4 17l6-6-6-6M12 19h8" /> },
  {
    href: "/agents",
    label: "Agents",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
      </>
    ),
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </>
    ),
  },
  {
    href: "/approvals",
    label: "Approvals",
    icon: (
      <>
        <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
        <path d="M8.5 12l2.5 2.5 4.5-5" />
      </>
    ),
  },
  {
    href: "/memory",
    label: "Memory",
    icon: (
      <>
        <path d="M5 4h11l3 3v13H5z" />
        <path d="M9 10h6M9 14h6" />
      </>
    ),
  },
];

export function TabBar({ pending }: { pending: number }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[max(env(safe-area-inset-bottom),12px)] pt-2"
    >
      <div className="mx-auto grid max-w-xl grid-cols-5">
        {tabs.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-11 flex-col items-center gap-1 py-1.5 text-xs ${
                active ? "font-semibold text-accent" : "text-quiet"
              }`}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {t.icon}
              </svg>
              {t.label}
              {t.href === "/approvals" && pending > 0 && (
                <span className="absolute right-[22%] top-0 min-w-5 rounded-full bg-warn px-1.5 text-center text-[11px] font-semibold leading-5 text-white">
                  {pending}
                  <span className="sr-only"> pending</span>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
