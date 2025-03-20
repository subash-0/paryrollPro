import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { MoreHorizontal, Edit2, Trash2, FileText } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmployeeWithDetails } from '@shared/schema';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

export function EmployeeTable() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<number | null>(null);
  
  const { data: employees = [], isLoading } = useQuery<EmployeeWithDetails[]>({
    queryKey: ['http://localhost:5000/api/employees'],
  });
  
  const filteredEmployees = searchTerm 
    ? employees.filter(emp => 
        emp.user?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.user?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.position?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : employees;
  
  const handleEdit = (id: number) => {
    navigate(`/employees/${id}`);
  };
  
  const handleDeleteClick = (id: number) => {
    setEmployeeToDelete(id);
    setDeleteDialogOpen(true);
  };
  
  const handleDelete = async () => {
    if (!employeeToDelete) return;
    
    try {
      await apiRequest('DELETE', `http://localhost:5000/api/employees/${employeeToDelete}`, {});
      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
      toast({
        title: "Success",
        description: "Employee has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['http://localhost:5000/api/employees'] });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete employee",
        variant: "destructive",
      });
    }
  };
  
  const handleViewPayslips = (id: number) => {
    navigate(`/payroll/employee/${id}`);
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <p>Loading employees...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <Input
          placeholder="Search employees..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={() => navigate('/employees/new')}>Add Employee</Button>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Salary</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "No employees match your search" : "No employees found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium flex items-center">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white mr-2">
                      <span>{`${employee.user?.firstName?.[0] || ''}${employee.user?.lastName?.[0] || ''}`.toUpperCase()}</span>
                    </div>
                    <span>{employee.user?.firstName} {employee.user?.lastName}</span>
                  </TableCell>
                  <TableCell>{employee.department?.name || 'N/A'}</TableCell>
                  <TableCell>{employee.position}</TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(Number(employee.baseSalary) || 0)}
                  </TableCell>
                  <TableCell>
                    {new Date(employee.joinDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={employee.status as any} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(employee.id)}>
                          <Edit2 className="mr-2 h-4 w-4" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleViewPayslips(employee.id)}>
                          <FileText className="mr-2 h-4 w-4" />
                          <span>View Payslips</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteClick(employee.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the employee record
              and remove the associated data from the server.
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
