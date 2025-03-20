import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Header } from '@/components/ui/header';
import { Sidebar } from '@/components/ui/sidebar';
import { SummaryCard } from '@/components/ui/summary-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { EmployeeWithDetails, PayrollWithDetails } from '@shared/schema';
import { BarChart, Circle, FilterIcon, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocation } from 'wouter';

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { isAdmin } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Fetch dashboard summary data
  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['http://localhost:5000/api/dashboard/summary'],
  });
  
  // Fetch department distribution data
  const { data: departments, isLoading: isDepartmentsLoading } = useQuery({
    queryKey: ['http://localhost:5000/api/dashboard/departments'],
  });
  
  // Fetch recent payroll activities
  const { data: recentPayrolls, isLoading: isPayrollsLoading } = useQuery<PayrollWithDetails[]>({
    queryKey: ['http://localhost:5000/api/payrolls/recent'],
  });
  
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  // Format currency
  const formatCurrency = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return '$0';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(Number(value));
  };
  
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuToggle={toggleSidebar} />
        
        <main className="flex-1 overflow-y-auto bg-[#f5f5f5] p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <SummaryCard
              title="Total Employees"
              value={summary?.employeeCount || '0'}
              trend={{
                value: "4.75% this month",
                isPositive: true
              }}
              type="employees"
            />
            
            <SummaryCard
              title="Total Payroll"
              value={formatCurrency(summary?.totalPayroll || 0)}
              trend={{
                value: "2.5% vs last month",
                isPositive: true
              }}
              type="payroll"
            />
            
            <SummaryCard
              title="Avg. Salary"
              value={formatCurrency(summary?.averageSalary || 0)}
              trend={{
                value: "1.2% vs last month",
                isPositive: true
              }}
              type="average"
            />
            
            <SummaryCard
              title="Pending Actions"
              value={summary?.pendingCount || '0'}
              trend={{
                value: "Needs attention",
                isPositive: false
              }}
              type="pending"
            />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Department Distribution</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View All</DropdownMenuItem>
                    <DropdownMenuItem>Export Data</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {isDepartmentsLoading ? (
                    <p>Loading departments...</p>
                  ) : departments?.length > 0 ? (
                    departments.map((dept: any, index: number) => (
                      <div key={index}>
                        <div className="flex justify-between mb-1">
                          <span>{dept.name}</span>
                          <span className="font-medium">{dept.count} ({dept.percentage}%)</span>
                        </div>
                        <div className="w-full h-2 bg-neutral-lightest rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${getBarColor(index)}`} 
                            style={{ width: `${dept.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground p-4">
                      <p>No department data available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Payroll Activity</CardTitle>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    <FilterIcon className="h-4 w-4 mr-1" />
                    Filter
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View All</DropdownMenuItem>
                      <DropdownMenuItem>Export Data</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-neutral-light">
                        <th className="text-left pb-3 font-medium text-neutral-medium">Employee</th>
                        <th className="text-left pb-3 font-medium text-neutral-medium">Department</th>
                        <th className="text-left pb-3 font-medium text-neutral-medium">Amount</th>
                        <th className="text-left pb-3 font-medium text-neutral-medium">Date</th>
                        <th className="text-left pb-3 font-medium text-neutral-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isPayrollsLoading ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center">Loading recent activities...</td>
                        </tr>
                      ) : recentPayrolls?.length > 0 ? (
                        recentPayrolls.map((payroll) => (
                          <tr key={payroll.id} className="border-b border-neutral-light hover:bg-neutral-lightest"
                              onClick={() => navigate(`/payroll/${payroll.id}`)}
                              style={{ cursor: 'pointer' }}>
                            <td className="py-3 flex items-center">
                              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white mr-3">
                                <span>{getInitials(payroll.employee?.user)}</span>
                              </div>
                              <span>{payroll.employee?.user?.firstName} {payroll.employee?.user?.lastName}</span>
                            </td>
                            <td className="py-3">{payroll.employee?.department?.name || 'N/A'}</td>
                            <td className="py-3 font-medium">{formatCurrency(payroll.netAmount)}</td>
                            <td className="py-3 text-neutral-medium">
                              {getMonthName(payroll.month)} {payroll.year}
                            </td>
                            <td className="py-3">
                              <StatusBadge status={payroll.status as any} />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-muted-foreground">
                            No recent payroll activities
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-4 text-center">
                  {recentPayrolls?.length > 0 && (
                    <Button 
                      variant="link" 
                      className="text-primary hover:text-primary-dark font-medium"
                      onClick={() => navigate('/payroll')}
                    >
                      View All Activities
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

// Helper functions
function getInitials(user: any): string {
  if (!user) return "N/A";
  return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
}

function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
}

function getBarColor(index: number): string {
  const colors = [
    'bg-primary',
    'bg-secondary',
    'bg-[#2196f3]',
    'bg-[#ff9800]',
    'bg-[#4caf50]'
  ];
  return colors[index % colors.length];
}
