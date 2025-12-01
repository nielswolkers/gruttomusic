import { Home, Calendar, Clock, BarChart3, CheckSquare, FileText, Bell, User } from 'lucide-react';
import { NavLink } from './NavLink';
import gruttoLogo from '@/assets/grutto-logo.png';

export function Sidebar() {
  return (
    <aside className="hidden md:flex h-screen bg-sidebar border-r border-sidebar-border flex-col overflow-hidden">
      {/* Logo */}
      <div className="p-6 flex-shrink-0">
        <img src={gruttoLogo} alt="Grutto" className="h-8 w-auto" />
      </div>

      {/* Menu */}
      <nav className="flex-1 px-3 overflow-y-auto">
        <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Menu
        </p>
        <div className="space-y-1">
          <NavLink 
            to="/dashboard" 
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </NavLink>
          
          <NavLink 
            to="/agenda" 
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <Calendar className="w-5 h-5" />
            <span>Agenda</span>
          </NavLink>
          
          <NavLink 
            to="/studie" 
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <Clock className="w-5 h-5" />
            <span>Studie</span>
          </NavLink>
          
          <NavLink 
            to="/cijfers" 
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <BarChart3 className="w-5 h-5" />
            <span>Cijfers</span>
          </NavLink>
          
          <NavLink 
            to="/taken" 
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <CheckSquare className="w-5 h-5" />
            <span>Taken</span>
          </NavLink>
          
          <NavLink 
            to="/bestanden" 
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <FileText className="w-5 h-5" />
            <span>Bestanden</span>
          </NavLink>
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="p-3 border-t border-sidebar-border space-y-1 flex-shrink-0">
        <NavLink 
          to="/meldingen" 
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors relative"
          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        >
          <Bell className="w-5 h-5" />
          <span>Meldingen</span>
          <span className="ml-auto bg-destructive text-destructive-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            3
          </span>
        </NavLink>
        
        <NavLink 
          to="/instellingen" 
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        >
          <User className="w-5 h-5" />
          <span>Account</span>
        </NavLink>
      </div>
    </aside>
  );
}
