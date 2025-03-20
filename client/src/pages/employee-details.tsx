import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/ui/header';
import { Sidebar } from '@/components/ui/sidebar';
import { EmployeeForm } from '@/components/employees/employee-form';
import { useAuth } from '@/lib/auth';

interface EmployeeDetailsProps {
  id?: number;
}

export default function EmployeeDetails({ id }: EmployeeDetailsProps) {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [employeeFormOpen, setEmployeeFormOpen] = useState(true);
  
  const isNewEmployee = !id;
  
  const { data: employee, isLoading: isEmployeeLoading } = useQuery({
    queryKey: ['http://localhost:5000/api/employees', id],
    enabled: !!id,
  });
  
  
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  const handleCloseForm = () => {
    setEmployeeFormOpen(false);
    navigate('/employees');
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
                <h1 className="text-2xl font-semibold">
                  {isNewEmployee ? 'Add New Employee' : 'Edit Employee'}
                </h1>
                <p className="text-muted-foreground">
                  {isNewEmployee 
                    ? 'Add a new employee to the system' 
                    : 'Update employee information'
                  }
                </p>
              </div>
              
              {/* The EmployeeForm component will be shown as a dialog */}
              <EmployeeForm 
                isOpen={employeeFormOpen} 
                onClose={handleCloseForm} 
                employeeId={id}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
