import React, { useState } from "react";
import { 
  LayoutDashboard, 
  Search,
  Library,
  Microscope,
  FolderOpen,
  FileText,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const navItems = [
  { id: "dashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
  { id: "library", icon: <Library size={20} />, label: "Library / RECAP" },
  { id: "discover", icon: <Search size={20} />, label: "Discover / RISHI-AI" },
  { id: "design", icon: <Microscope size={20} />, label: "Design / BRAHMA" },
  { id: "collections", icon: <FolderOpen size={20} />, label: "Collections" },
  { id: "protocols", icon: <FileText size={20} />, label: "Protocols" },
  { id: "exports", icon: <Download size={20} />, label: "Exports" },
  { id: "settings", icon: <Settings size={20} />, label: "Settings" },
];

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
}

export function Sidebar({ activePage, setActivePage }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`${collapsed ? "w-16" : "w-64"} bg-surface border-r border-border-light flex flex-col py-6 flex-shrink-0 z-10 shadow-sm transition-all duration-200`}>

      {/* Logo + Toggle — fully inside the sidebar */}
      <div className={`mb-8 flex items-center justify-between ${collapsed ? "px-3" : "px-4"}`}>
        <div className={`flex items-center ${collapsed ? "justify-center w-full" : "gap-3"}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-primary/20 flex-shrink-0">
            C
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight tracking-tight">CCRAS Suite</h1>
              <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">Intelligence</p>
            </div>
          )}
        </div>

        {/* Collapse button shown inline when expanded */}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors flex-shrink-0"
            title="Collapse sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Expand button shown at top when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mb-4 w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight size={14} />
        </button>
      )}

      {/* Nav items */}
      <div className="flex flex-col gap-1 px-3">
        {!collapsed && (
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-3 mb-2 mt-2">Platform</div>
        )}

        {navItems.slice(0, 1).map((item) => (
          <NavItem key={item.id} item={item} isActive={activePage === item.id} onClick={() => setActivePage(item.id)} collapsed={collapsed} />
        ))}

        {!collapsed && (
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-3 mb-2 mt-6">Core Modules</div>
        )}
        {collapsed && <div className="my-2 border-t border-border-light mx-1" />}
        {navItems.slice(1, 4).map((item) => (
          <NavItem key={item.id} item={item} isActive={activePage === item.id} onClick={() => setActivePage(item.id)} collapsed={collapsed} />
        ))}

        {!collapsed && (
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-3 mb-2 mt-6">Workspace</div>
        )}
        {collapsed && <div className="my-2 border-t border-border-light mx-1" />}
        {navItems.slice(4).map((item) => (
          <NavItem key={item.id} item={item} isActive={activePage === item.id} onClick={() => setActivePage(item.id)} collapsed={collapsed} />
        ))}
      </div>

      <div className="flex-1" />

      <div className={`mt-4 ${collapsed ? "px-2" : "px-6"}`}>
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"} p-2 rounded-xl hover:bg-surface-hover cursor-pointer transition-colors border border-transparent hover:border-border-light`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-success shadow-sm flex-shrink-0" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground">Dr. Researcher</span>
              <span className="text-[10px] text-text-muted">Lead Investigator</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NavItem({ item, isActive, onClick, collapsed }: { item: any, isActive: boolean, onClick: () => void, collapsed: boolean }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`w-full h-10 px-3 rounded-lg border-none cursor-pointer flex items-center ${collapsed ? "justify-center" : "gap-3"} transition-all duration-150 ${
        isActive 
          ? "bg-primary-light text-primary shadow-sm font-bold" 
          : "bg-transparent text-text-dim hover:text-text-muted hover:bg-surface-hover font-medium"
      }`}
    >
      <div className={`${isActive ? "text-primary" : "text-text-dim"} flex-shrink-0`}>
        {item.icon}
      </div>
      {!collapsed && <span className="text-sm">{item.label}</span>}
    </button>
  );
}
