import { Home, Calendar, Clock, BarChart3, CheckSquare, FileText, Bell, User } from 'lucide-react';
import { NavLink } from './NavLink';
import gruttoLogo from '@/assets/grutto-logo.png';
import { useState, useRef, useEffect } from 'react';

const EXPANDED_WIDTH = 256;
const COLLAPSED_WIDTH = 72;

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(EXPANDED_WIDTH);
  const sidebarRef = useRef<HTMLElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(EXPANDED_WIDTH);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = currentWidth;
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const delta = e.clientX - dragStartXRef.current;
      const newWidth = Math.max(COLLAPSED_WIDTH, Math.min(EXPANDED_WIDTH, dragStartWidthRef.current + delta));
      setCurrentWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!isDragging) return;
      setIsDragging(false);
      // Snap to collapsed or expanded
      const midpoint = (EXPANDED_WIDTH + COLLAPSED_WIDTH) / 2;
      if (currentWidth < midpoint) {
        setCurrentWidth(COLLAPSED_WIDTH);
        setIsCollapsed(true);
      } else {
        setCurrentWidth(EXPANDED_WIDTH);
        setIsCollapsed(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, currentWidth]);

  const handleClick = () => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setCurrentWidth(EXPANDED_WIDTH);
    }
  };

  const handleMouseEnter = () => {
    if (isCollapsed) {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsCollapsed(false);
        setCurrentWidth(EXPANDED_WIDTH);
      }, 2000);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (!isCollapsed && !isDragging) {
      // Only collapse if it was expanded via hover
      // Don't auto-collapse if user manually expanded
    }
  };

  // Calculate opacity for text elements
  const textOpacity = Math.max(0, (currentWidth - COLLAPSED_WIDTH) / (EXPANDED_WIDTH - COLLAPSED_WIDTH));

  return (
    <aside 
      ref={sidebarRef}
      className="hidden md:flex bg-sidebar border-r border-sidebar-border flex-col h-screen sticky top-0 overflow-hidden cursor-ew-resize select-none"
      style={{ 
        width: currentWidth,
        transition: isDragging ? 'none' : 'width 0.3s ease-out'
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Logo */}
      <div className="p-6 pl-[22px]">
        <img 
          src={gruttoLogo} 
          alt="Grutto" 
          className="h-8 w-auto"
          style={{ 
            opacity: textOpacity,
            transition: isDragging ? 'none' : 'opacity 0.3s ease-out'
          }}
        />
      </div>

      {/* Menu */}
      <nav className="flex-1 px-3">
        <p 
          className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
          style={{ 
            opacity: textOpacity,
            transition: isDragging ? 'none' : 'opacity 0.3s ease-out'
          }}
        >
          Menu
        </p>
        <div className="space-y-1">
          <NavLink 
            to="/dashboard" 
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <Home className="w-5 h-5 flex-shrink-0" />
            <span 
              className="whitespace-nowrap overflow-hidden"
              style={{ 
                opacity: textOpacity,
                transition: isDragging ? 'none' : 'opacity 0.3s ease-out'
              }}
            >Home</span>
          </NavLink>
          
          <NavLink 
            to="/agenda" 
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <Calendar className="w-5 h-5 flex-shrink-0" />
            <span 
              className="whitespace-nowrap overflow-hidden"
              style={{ 
                opacity: textOpacity,
                transition: isDragging ? 'none' : 'opacity 0.3s ease-out'
              }}
            >Agenda</span>
          </NavLink>
          
          <NavLink 
            to="/studie" 
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <Clock className="w-5 h-5 flex-shrink-0" />
            <span 
              className="whitespace-nowrap overflow-hidden"
              style={{ 
                opacity: textOpacity,
                transition: isDragging ? 'none' : 'opacity 0.3s ease-out'
              }}
            >Studie</span>
          </NavLink>
          
          <NavLink 
            to="/cijfers" 
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <BarChart3 className="w-5 h-5 flex-shrink-0" />
            <span 
              className="whitespace-nowrap overflow-hidden"
              style={{ 
                opacity: textOpacity,
                transition: isDragging ? 'none' : 'opacity 0.3s ease-out'
              }}
            >Cijfers</span>
          </NavLink>
          
          <NavLink 
            to="/taken" 
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <CheckSquare className="w-5 h-5 flex-shrink-0" />
            <span 
              className="whitespace-nowrap overflow-hidden"
              style={{ 
                opacity: textOpacity,
                transition: isDragging ? 'none' : 'opacity 0.3s ease-out'
              }}
            >Taken</span>
          </NavLink>
          
          <NavLink 
            to="/bestanden" 
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <FileText className="w-5 h-5 flex-shrink-0" />
            <span 
              className="whitespace-nowrap overflow-hidden"
              style={{ 
                opacity: textOpacity,
                transition: isDragging ? 'none' : 'opacity 0.3s ease-out'
              }}
            >Bestanden</span>
          </NavLink>
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <NavLink 
          to="/meldingen" 
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors relative"
          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        >
          <Bell className="w-5 h-5 flex-shrink-0" />
          <span 
            className="whitespace-nowrap overflow-hidden"
            style={{ 
              opacity: textOpacity,
              transition: isDragging ? 'none' : 'opacity 0.3s ease-out'
            }}
          >Meldingen</span>
          <span 
            className="ml-auto bg-destructive text-destructive-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0"
            style={{ 
              opacity: textOpacity,
              transition: isDragging ? 'none' : 'opacity 0.3s ease-out'
            }}
          >
            3
          </span>
        </NavLink>
        
        <NavLink 
          to="/instellingen" 
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        >
          <User className="w-5 h-5 flex-shrink-0" />
          <span 
            className="whitespace-nowrap overflow-hidden"
            style={{ 
              opacity: textOpacity,
              transition: isDragging ? 'none' : 'opacity 0.3s ease-out'
            }}
          >Account</span>
        </NavLink>
      </div>
    </aside>
  );
}
