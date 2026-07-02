import React from "react";
import { 
  LayoutDashboard, 
  Search,
  Library,
  Microscope,
  FolderOpen,
  FileText,
  Download,
  Settings 
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
  return (
    <div className="w-64 bg-surface border-r border-border-light flex flex-col py-6 flex-shrink-0 z-10 shadow-sm">
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-primary/20 flex-shrink-0">
          C
        </div>
        <div>
          <h1 className="text-sm font-bold text-foreground leading-tight tracking-tight">CCRAS Suite</h1>
          <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">Intelligence</p>
        </div>
      </div>
      
      <div className="flex flex-col gap-1 px-3">
        <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-3 mb-2 mt-2">Platform</div>
        
        {navItems.slice(0, 1).map((item) => (
          <NavItem key={item.id} item={item} isActive={activePage === item.id} onClick={() => setActivePage(item.id)} />
        ))}

        <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-3 mb-2 mt-6">Core Modules</div>
        {navItems.slice(1, 4).map((item) => (
          <NavItem key={item.id} item={item} isActive={activePage === item.id} onClick={() => setActivePage(item.id)} />
        ))}

        <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-3 mb-2 mt-6">Workspace</div>
        {navItems.slice(4).map((item) => (
          <NavItem key={item.id} item={item} isActive={activePage === item.id} onClick={() => setActivePage(item.id)} />
        ))}
      </div>
      
      <div className="flex-1" />
      
      <div className="px-6 mt-4">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-hover cursor-pointer transition-colors border border-transparent hover:border-border-light">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-success shadow-sm" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-foreground">Dr. Researcher</span>
            <span className="text-[10px] text-text-muted">Lead Investigator</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ item, isActive, onClick }: { item: any, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full h-10 px-3 rounded-lg border-none cursor-pointer flex items-center gap-3 transition-all duration-150 ${
        isActive 
          ? "bg-primary-light text-primary shadow-sm font-bold" 
          : "bg-transparent text-text-dim hover:text-text-muted hover:bg-surface-hover font-medium"
      }`}
    >
      <div className={`${isActive ? "text-primary" : "text-text-dim"}`}>
        {item.icon}
      </div>
      <span className="text-sm">{item.label}</span>
    </button>
  );
}
