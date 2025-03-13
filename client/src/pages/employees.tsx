import { useState } from 'react';
import { useLocation } from 'wouter';
import { Header } from '@/components/ui/header';
import { Sidebar } from '@/components/ui/sidebar';
import { EmployeeTable } from '@/components/employees/employee-table';
import { EmployeeForm } from '@/components/employees/employee-form';
import { useAuth } from '@/lib/auth';

export default function Employees() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  // Check if user is authenticated
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }
  
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuToggle={toggleSidebar} />
        
        <main className="flex-1 overflow-y-auto bg-[#f5f5f5] p-6">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold">Employees</h1>
                <p className="text-muted-foreground">Manage employee information and records</p>
              </div>
              
              <EmployeeTable />
            </div>
          </div>
        </main>
      </div>
      
      {/* Conditionally render the EmployeeForm if the route is /employees/new */}
      {isAddEmployeeOpen && (
        <EmployeeForm 
          isOpen={isAddEmployeeOpen} 
          onClose={() => setIsAddEmployeeOpen(false)} 
        />
      )}
    </div>
  );
}
