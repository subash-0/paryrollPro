import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { z } from 'zod';
import { insertPayrollSchema, EmployeeWithDetails } from '@shared/schema';
import { useAuth } from '@/lib/auth';

// Create a schema for the payroll form with appropriate validations
const payrollFormSchema = insertPayrollSchema.extend({
  grossAmount: z.coerce.number().min(0, "Gross amount must be positive"),
  taxDeductions: z.coerce.number().min(0, "Tax deductions must be positive"),
  otherDeductions: z.coerce.number().min(0, "Other deductions must be positive"),
  netAmount: z.coerce.number().min(0, "Net amount must be positive"),
  bonuses: z.coerce.number().min(0, "Bonuses must be positive"),
  deductionDetails: z.string().optional(),
});

type PayrollFormValues = z.infer<typeof payrollFormSchema>;

interface PayrollFormProps {
  isOpen: boolean;
  onClose: () => void;
  payrollId?: number;
  employeeId?: number;
}

export function PayrollForm({ isOpen, onClose, payrollId, employeeId }: PayrollFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get current month and year for default values
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
  const currentYear = currentDate.getFullYear();
  
  // Fetch employees for dropdown
  const { data: employees, isLoading: isEmployeesLoading } = useQuery<EmployeeWithDetails[]>({
    queryKey: ['http://localhost:5000/api/employees'],
    enabled: isOpen,
  });
  
  // Fetch payroll data if editing
  const { data: payroll, isLoading: isPayrollLoading } = useQuery({
    queryKey: ['http://localhost:5000/api/payrolls', payrollId],
    enabled: !!payrollId && isOpen,
  });

  const title = payrollId ? 'Edit Payroll' : 'Process New Payroll';

 const filterdPayroll = payroll?.filter((payroll) => payroll.id === payrollId);
 
  const form = useForm<PayrollFormValues>({
    resolver: zodResolver(payrollFormSchema),
    defaultValues: {
      employeeId: employeeId || undefined,
      month: currentMonth,
      year: currentYear,
      grossAmount: 0,
      taxDeductions: 0,
      otherDeductions: 0,
      netAmount: 0,
      bonuses: 0,
      status: 'pending',
      details: {},
      processedBy: user?.id,
      deductionDetails: '',
    },
  });
  
  // Calculate net amount when other fields change
  const watchGrossAmount = form.watch('grossAmount');
  const watchTaxDeductions = form.watch('taxDeductions');
  const watchOtherDeductions = form.watch('otherDeductions');
  const watchBonuses = form.watch('bonuses');
  
  useEffect(() => {
    // Calculate net amount: gross + bonuses - taxes - other deductions
    const netAmount = (
      watchGrossAmount + 
      watchBonuses - 
      watchTaxDeductions - 
      watchOtherDeductions
    );
    
    if (netAmount >= 0) {
      form.setValue('netAmount', netAmount);
    }
  }, [watchGrossAmount, watchBonuses, watchTaxDeductions, watchOtherDeductions, form]);
  
  // Update form when payroll data is loaded
  useEffect(() => {
    if (filterdPayroll) {
      const deductionDetails = filterdPayroll[0].details?.deductionDetails || '';
      
      form.reset({
        ...filterdPayroll[0],
        grossAmount: filterdPayroll[0].grossAmount,
        taxDeductions: filterdPayroll.taxDeductions,
        otherDeductions: filterdPayroll[0].otherDeductions,
        netAmount: filterdPayroll[0].netAmount,
        bonuses: filterdPayroll[0].bonuses,
        deductionDetails,
      });
    }
  }, [payroll, form]);
  
  // If an employee is selected, get their base salary as default gross amount
  const handleEmployeeChange = (employeeId: number) => {
    const selectedEmployee = employees?.find(emp => emp.id === employeeId);
    
    if (selectedEmployee) {
      // Set gross amount to the employee's base salary
      form.setValue('grossAmount', Number(selectedEmployee.baseSalary));
      
      // Default tax calculations (simplified)
      const taxRate = 0.15; // 15% tax rate
      const taxAmount = Number(selectedEmployee.baseSalary) * taxRate;
      form.setValue('taxDeductions', taxAmount);
      
      // Recalculate net amount
      form.setValue('netAmount', 
        Number(selectedEmployee.baseSalary) - taxAmount + form.getValues('bonuses') - form.getValues('otherDeductions')
      );
    }
  };
  
  const createMutation = useMutation({
    mutationFn: async (data: PayrollFormValues) => {
      // Format data for API
      const { deductionDetails, ...payrollData } = data;
      
      // Add details as JSON object
      const formattedData = {
        ...payrollData,
        details: {
          deductionDetails,
          processedDate: new Date().toISOString(),
        },
      };
      const processedData = {
        ...formattedData,
        grossAmount: String(formattedData.grossAmount),
        taxDeductions: String(formattedData.taxDeductions),
        otherDeductions: String(formattedData.otherDeductions),
        netAmount: String(formattedData.netAmount),
        bonuses: String(formattedData.bonuses),
      };
      await apiRequest('POST', 'http://localhost:5000/api/payrolls', processedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['http://localhost:5000/api/payrolls'] });
      queryClient.invalidateQueries({ queryKey: ['http://localhost:5000/api/employees'] });
      toast({
        title: "Success",
        description: "Payroll has been processed successfully",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process payroll",
        variant: "destructive",
      });
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: async (data: PayrollFormValues) => {
      // Format data for API
      const { deductionDetails, ...payrollData } = data;
      
      // Add details as JSON object
      const formattedData = {
        ...payrollData,
        details: {
          ...payroll?.details,
          deductionDetails,
          lastUpdated: new Date().toISOString(),
        },
      };
      
      await apiRequest('PATCH', `http://localhost:5000/api/payrolls/${payrollId}`, formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['http://localhost:5000/api/payrolls'] });
      queryClient.invalidateQueries({ queryKey: ['http://localhost:5000/api/payrolls', payrollId] });
      toast({
        title: "Success",
        description: "Payroll has been updated successfully",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update payroll",
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = async (values: PayrollFormValues) => {
    setIsSubmitting(true);
    try {
      if (payrollId) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isLoading = isPayrollLoading || isEmployeesLoading || isSubmitting;
  
  // Generate month options
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];
  
  // Generate year options (current year and 2 previous years)
  const years = [currentYear, currentYear - 1, currentYear - 2];
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {payrollId 
              ? "Update payroll information in the system."
              : "Process a new payroll. This will calculate salary, taxes, and deductions."}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(Number(value));
                        handleEmployeeChange(Number(value));
                      }}
                      value={field.value?.toString()}
                      disabled={isLoading || !!employeeId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees?.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id.toString()}>
                            {employee.user?.firstName} {employee.user?.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Month</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(Number(value))}
                        value={field.value?.toString()}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Month" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {months.map((month) => (
                            <SelectItem key={month.value} value={month.value.toString()}>
                              {month.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(Number(value))}
                        value={field.value?.toString()}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {years.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="grossAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gross Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">$</span>
                        <Input 
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-8"
                          {...field} 
                          onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                          disabled={isLoading} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="bonuses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bonuses</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">$</span>
                        <Input 
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-8"
                          {...field} 
                          onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                          disabled={isLoading} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="taxDeductions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Deductions</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">$</span>
                        <Input 
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-8"
                          {...field} 
                          onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                          disabled={isLoading} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="otherDeductions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Other Deductions</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">$</span>
                        <Input 
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-8"
                          {...field} 
                          onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                          disabled={isLoading} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="netAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Net Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">$</span>
                        <Input 
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-8"
                          {...field} 
                          onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                          disabled={isLoading}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select 
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="deductionDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deduction Details</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter details about deductions and bonuses"
                      className="min-h-32"
                      {...field} 
                      disabled={isLoading} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Processing...' : payrollId ? 'Update Payroll' : 'Process Payroll'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
