import { useState } from 'react';
import { useLocation } from 'wouter';
import { Bell, Menu, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [notificationCount] = useState(3); // In real app, this would come from a state or API
  
  const userInitials = user ? 
    `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() : 'U';
  
  const getPageTitle = () => {
    switch (location) {
      case '/dashboard':
        return 'Dashboard';
      case '/employees':
        return 'Employees';
      case '/payroll':
        return 'Payroll';
      case '/reports':
        return 'Reports';
      case '/settings':
        return 'System Settings';
      case '/profile':
        return 'Profile';
      default:
        if (location.startsWith('/employees/')) {
          return 'Employee Details';
        }
        return 'PayrollPro';
    }
  };
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  
  return (
    <header className="bg-white shadow-sm h-16 flex items-center px-6 flex-shrink-0">
      <button 
        className="mr-4 lg:hidden text-gray-600 hover:text-gray-900 focus:outline-none" 
        onClick={onMenuToggle}
      >
        <Menu size={24} />
      </button>
      
      <h1 className="text-xl font-medium flex-1">{getPageTitle()}</h1>
      
      <div className="flex items-center">
        <div className="relative mr-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 rounded-full hover:bg-neutral-100 text-gray-600 focus:outline-none">
                <Bell size={20} />
                {notificationCount > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-secondary rounded-full text-white text-xs flex items-center justify-center">
                    {notificationCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <div className="flex flex-col">
                  <span className="font-medium">Payroll Processed</span>
                  <span className="text-xs text-gray-500">May payroll has been processed</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <div className="flex flex-col">
                  <span className="font-medium">New Employee</span>
                  <span className="text-xs text-gray-500">Sarah Miller joined Engineering</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <div className="flex flex-col">
                  <span className="font-medium">System Update</span>
                  <span className="text-xs text-gray-500">PayrollPro updated to v2.1</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="relative">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center focus:outline-none">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                  <span>{userInitials}</span>
                </div>
                <span className="ml-2 hidden md:block">{user?.firstName} {user?.lastName}</span>
                <ChevronDown className="ml-1" size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
