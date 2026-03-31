import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, Wallet, Repeat, ClipboardList, PieChart,
  Server, Cog, ScrollText, Bell, Settings, ChevronLeft, ChevronRight,
  FlaskConical, BarChart3, Receipt
} from "lucide-react";
import { useState } from "react";

type NavItem =
  | { title: string; path: string; icon: React.ElementType }
  | { separator: true; label: string };

const NAV_ITEMS: NavItem[] = [
  { title: "Overview",       path: "/",             icon: LayoutDashboard },
  { title: "Portfolio",      path: "/portfolio",    icon: Wallet          },
  { title: "Rebalance Plan", path: "/rebalance",    icon: Repeat          },
  { title: "Orders",         path: "/orders",       icon: ClipboardList   },
  { title: "Allocations",    path: "/allocations",  icon: PieChart        },
  { title: "Exchanges",      path: "/exchanges",    icon: Server          },
  { title: "Strategy Config",path: "/strategy",     icon: Cog             },
  { title: "Logs",           path: "/logs",         icon: ScrollText      },
  { title: "Alerts",         path: "/alerts",       icon: Bell            },
  { separator: true, label: "Advanced" },
  { title: "Backtesting",    path: "/backtesting",  icon: FlaskConical    },
  { title: "Analytics",      path: "/analytics",    icon: BarChart3       },
  { title: "Tax Reports",    path: "/tax",          icon: Receipt         },
  { title: "Settings",       path: "/settings",     icon: Settings        },
];

export function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`h-screen sticky top-0 border-r-[2.5px] border-foreground bg-card flex flex-col transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className="flex items-center justify-between p-3 border-b-[2.5px] border-foreground">
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight">⚡ RBBot</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-secondary transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map((item, idx) => {
          if ("separator" in item) {
            if (collapsed) return null;
            return (
              <div
                key={`sep-${idx}`}
                className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60"
              >
                {item.label}
              </div>
            );
          }
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 mx-1.5 my-0.5 rounded-md text-sm font-medium transition-all duration-75 ${
                active
                  ? "bg-primary text-primary-foreground brutal-shadow-sm"
                  : "hover:bg-secondary text-foreground"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <item.icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-3 border-t-[2.5px] border-foreground text-xs text-muted-foreground">
          v3.1.0 · solo mode
        </div>
      )}
    </aside>
  );
}
