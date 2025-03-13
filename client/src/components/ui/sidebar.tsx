import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { 
  Home, 
  Users, 
  DollarSign, 
  BarChart, 
  Settings, 
  User, 
  LogOut 
} from 'lucide-react';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
  const [location, navigate] = useLocation();
  const { user, logout, isAdmin } = useAuth();
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  
  // Get user initials for avatar
  const userInitials = user ? 
    `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() : 'U';
  
  const isActive = (path: string) => location === path;
  
  return (
    <aside className={`sidebar bg-[#424242] text-white ${isCollapsed ? 'w-20' : 'w-64'} flex-shrink-0 h-full flex flex-col shadow-lg z-10 transition-width duration-300`}>
      <div className="p-4 flex items-center border-b border-gray-700">
        {!isCollapsed ? (
          <>
            <div className="h-10 w-10 bg-primary rounded flex items-center justify-center text-white mr-3">
              <span className="text-xl font-bold">P</span>
            </div>
            <h1 className="text-xl font-medium">PayrollPro</h1>
          </>
        ) : (
          <div className="h-10 w-10 bg-primary rounded flex items-center justify-center mx-auto text-white">
            <span className="text-xl font-bold">P</span>
          </div>
        )}
      </div>
      
      <div className="p-4 border-b border-gray-700">
        <div className={`flex ${isCollapsed ? 'justify-center' : 'items-center'}`}>
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium">
            <span>{userInitials}</span>
          </div>
          {!isCollapsed && (
            <div className="ml-3">
              <p className="font-medium">{user?.firstName} {user?.lastName}</p>
              <p className="text-sm text-gray-400 capitalize">{user?.role}</p>
            </div>
          )}
        </div>
      </div>
      
      <nav className="flex-grow p-4">
        <p className={`text-gray-400 text-xs uppercase tracking-wider mb-2 ${isCollapsed ? 'text-center' : ''}`}>
          {!isCollapsed ? 'Management' : ''}
        </p>
        
        <ul>
          <li className="mb-1">
            <a 
              href="/dashboard" 
              onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}
              className={`sidebar-link ${isActive('/dashboard') ? 'active' : ''} ${isCollapsed ? 'justify-center' : ''}`}
            >
              <Home className={`${isCollapsed ? 'mx-auto' : 'mr-3'}`} size={20} />
              {!isCollapsed && <span>Dashboard</span>}
            </a>
          </li>
          
          <li className="mb-1">
            <a 
              href="/employees" 
              onClick={(e) => { e.preventDefault(); navigate('/employees'); }}
              className={`sidebar-link ${isActive('/employees') ? 'active' : ''} ${isCollapsed ? 'justify-center' : ''}`}
            >
              <Users className={`${isCollapsed ? 'mx-auto' : 'mr-3'}`} size={20} />
              {!isCollapsed && <span>Employees</span>}
            </a>
          </li>
          
          <li className="mb-1">
            <a 
              href="/payroll" 
              onClick={(e) => { e.preventDefault(); navigate('/payroll'); }}
              className={`sidebar-link ${isActive('/payroll') ? 'active' : ''} ${isCollapsed ? 'justify-center' : ''}`}
            >
              <DollarSign className={`${isCollapsed ? 'mx-auto' : 'mr-3'}`} size={20} />
              {!isCollapsed && <span>Payroll</span>}
            </a>
          </li>
          
          <li className="mb-1">
            <a 
              href="/reports" 
              onClick={(e) => { e.preventDefault(); navigate('/reports'); }}
              className={`sidebar-link ${isActive('/reports') ? 'active' : ''} ${isCollapsed ? 'justify-center' : ''}`}
            >
              <BarChart className={`${isCollapsed ? 'mx-auto' : 'mr-3'}`} size={20} />
              {!isCollapsed && <span>Reports</span>}
            </a>
          </li>
        </ul>
        
        <p className={`text-gray-400 text-xs uppercase tracking-wider mb-2 mt-6 ${isCollapsed ? 'text-center' : ''}`}>
          {!isCollapsed ? 'Settings' : ''}
        </p>
        
        <ul>
          {isAdmin && (
            <li className="mb-1">
              <a 
                href="/settings" 
                onClick={(e) => { e.preventDefault(); navigate('/settings'); }}
                className={`sidebar-link ${isActive('/settings') ? 'active' : ''} ${isCollapsed ? 'justify-center' : ''}`}
              >
                <Settings className={`${isCollapsed ? 'mx-auto' : 'mr-3'}`} size={20} />
                {!isCollapsed && <span>System Settings</span>}
              </a>
            </li>
          )}
          
          <li className="mb-1">
            <a 
              href="/profile" 
              onClick={(e) => { e.preventDefault(); navigate('/profile'); }}
              className={`sidebar-link ${isActive('/profile') ? 'active' : ''} ${isCollapsed ? 'justify-center' : ''}`}
            >
              <User className={`${isCollapsed ? 'mx-auto' : 'mr-3'}`} size={20} />
              {!isCollapsed && <span>Profile</span>}
            </a>
          </li>
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-700">
        <button 
          onClick={handleLogout}
          className={`flex items-center text-white hover:bg-gray-700 p-2 rounded w-full ${isCollapsed ? 'justify-center' : ''}`}
        >
          <LogOut className={`${isCollapsed ? 'mx-auto' : 'mr-3'}`} size={20} />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
