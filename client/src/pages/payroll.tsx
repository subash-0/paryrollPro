import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/ui/header';
import { Sidebar } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { Payslip } from '@/components/payroll/payslip';
import { PayrollForm } from '@/components/payroll/payroll-form';
import { PayrollWithDetails } from '@shared/schema';
import { FileText, Calendar, MoreHorizontal, Plus, Search, Edit2, Trash2, Download } from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface PayrollProps {
  id?: number;
  employeeId?: number;
}

export default function Payroll({ id, employeeId }: PayrollProps) {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading, isAdmin } = useAuth();
  const { toast } = useToast();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPayrollFormOpen, setIsPayrollFormOpen] = useState(false);
  const [payrollIdToEdit, setPayrollIdToEdit] = useState<number | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [payrollToDelete, setPayrollToDelete] = useState<number | null>(null);
  
  const isPayslipView = !!id;
  const isEmployeePayrollView = !!employeeId;
 
  // Fetch payrolls
  const { data: payrolls = [], isLoading: isPayrollsLoading } = useQuery<PayrollWithDetails[]>({
    queryKey: isEmployeePayrollView ? [`http://localhost:5000/api/payrolls/employees`, employeeId] : ['http://localhost:5000/api/payrolls/recent'],
    enabled: !isPayslipView
  });
  

  console.log(payrolls);



  // Fetch employee if viewing employee payrolls
  const { data: employee, isLoading: isEmployeeLoading } = useQuery({
    queryKey: [`http://localhost:5000/api/employees/${employeeId}`, employeeId],
    enabled: isEmployeePayrollView
  });


  
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  const handleAddPayroll = () => {
    setPayrollIdToEdit(undefined);
    setIsPayrollFormOpen(true);
  };
  
  const handleEditPayroll = (payrollId: number) => {
    setPayrollIdToEdit(payrollId);
    setIsPayrollFormOpen(true);
  };
  
  const handleClosePayrollForm = () => {
    setIsPayrollFormOpen(false);
    setPayrollIdToEdit(undefined);
  };
  
  const handleDeleteClick = (payrollId: number) => {
    setPayrollToDelete(payrollId);
    setDeleteDialogOpen(true);
  };
  
  const handleDelete = async () => {
    if (!payrollToDelete) return;
    
    try {
      await apiRequest('DELETE', `http://localhost:5000/api/payrolls/${payrollToDelete}`, {});
      setDeleteDialogOpen(false);
      setPayrollToDelete(null);
      toast({
        title: "Success",
        description: "Payroll record has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['http://localhost:5000/api/payrolls'] });
      if (isEmployeePayrollView) {
        queryClient.invalidateQueries({ queryKey: [`http://localhost:5000/api/payrolls/employee/${employeeId}`, employeeId] });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete payroll record",
        variant: "destructive",
      });
    }
  };
  
  const filteredPayrolls = searchTerm 
    ? payrolls.filter(payroll => 
        payroll.employee?.user?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payroll.employee?.user?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payroll.employee?.department?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(payroll.month).includes(searchTerm) ||
        String(payroll.year).includes(searchTerm) ||
        payroll.status?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : payrolls;
  
  const formatCurrency = (amount: number | string | null | undefined) => {
    if (amount === null || amount === undefined) return '$0.00';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(amount));
  };
  
  const getMonthName = (monthNum: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNum - 1] || '';
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
          {isPayslipView ? (
            // Show payslip view
            <Payslip payrollId={id!} />
          ) : (
            // Show payroll list view
            <div className="max-w-7xl mx-auto">
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-semibold">
                      {isEmployeePayrollView 
                        ? `Payroll History: ${employee?.user?.firstName} ${employee?.user?.lastName}`
                        : 'Payroll Management'
                      }
                    </h1>
                    <p className="text-muted-foreground">
                      {isEmployeePayrollView 
                        ? `View and manage payroll records for ${employee?.user?.firstName} ${employee?.user?.lastName}`
                        : 'Process and manage payroll for all employees'
                      }
                    </p>
                  </div>
                  {isAdmin && (
                    <Button onClick={handleAddPayroll}>
                      <Plus className="mr-2 h-4 w-4" />
                      Process New Payroll
                    </Button>
                  )}
                </div>
                
                <div className="flex items-center">
                  <div className="relative flex-grow max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search payrolls..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                
                {isPayrollsLoading ? (
                  <div className="flex justify-center items-center h-40">
                    <p>Loading payroll data...</p>
                  </div>
                ) : filteredPayrolls.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                      <Calendar className="h-10 w-10 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No payroll records found</h3>
                      <p className="text-muted-foreground">
                        {searchTerm 
                          ? 'No payroll records match your search criteria.'
                          : isEmployeePayrollView 
                            ? 'This employee does not have any payroll records yet.'
                            : 'No payroll records have been created yet.'
                        }
                      </p>
                      {isAdmin && (
                        <Button onClick={handleAddPayroll} className="mt-4">
                          Process New Payroll
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredPayrolls.map((payroll) => (
                      <Card key={payroll.id} className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex flex-col md:flex-row md:items-center p-4 md:p-6">
                            <div className="flex items-start md:items-center mb-4 md:mb-0">
                              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white mr-4">
                                <span>
                                  {`${payroll.employee?.user?.firstName?.[0] || ''}${payroll.employee?.user?.lastName?.[0] || ''}`.toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <h3 className="font-medium">
                                  {payroll.employee?.user?.firstName} {payroll.employee?.user?.lastName}
                                 
                                </h3>
                                <div className="flex text-sm text-muted-foreground">
                                  <span>{payroll.employee?.department?.name}</span>
                                  <span className="mx-2">•</span>
                                  <span>{payroll.employee?.position}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-4 ml-0 md:ml-auto">
                              <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground">Period</span>
                                <span className="font-medium">
                                  {getMonthName(payroll.month)} {payroll.year}
                                </span>
                              </div>
                              
                              <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground">Amount</span>
                                <span className="font-medium">
                                  {formatCurrency(payroll.netAmount)}
                                </span>
                              </div>
                              
                              <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground">Status</span>
                                <StatusBadge status={payroll.status as any} />
                              </div>
                              
                              <div className="flex items-center gap-2 ml-auto">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => navigate(`/payroll/${payroll.id}`)}
                                >
                                  <FileText className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                                
                                {isAdmin && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleEditPayroll(payroll.id)}>
                                        <Edit2 className="mr-2 h-4 w-4" />
                                        <span>Edit</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => handleDeleteClick(payroll.id)}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>Delete</span>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
      
      {/* Payroll Form Dialog */}
      {isPayrollFormOpen && (
        <PayrollForm
          isOpen={isPayrollFormOpen}
          onClose={handleClosePayrollForm}
          payrollId={payrollIdToEdit}
          employeeId={employeeId}
        />
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the payroll record
              from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
