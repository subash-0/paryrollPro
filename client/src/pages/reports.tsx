import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/ui/header';
import { Sidebar } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { 
  BarChart as BarChartIcon, 
  Download, 
  Calendar, 
  DollarSign, 
  Users 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

export default function Reports() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const { toast } = useToast();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState('all');
  
  // Fetch all payrolls
  const { data: payrolls = [], isLoading: isPayrollsLoading } = useQuery({
    queryKey: ['http://localhost:5000/api/payrolls'],
  });
  
  // Fetch all employees with details
  const { data: employees = [], isLoading: isEmployeesLoading } = useQuery({
    queryKey: ['http://localhost:5000/api/employees'],
  });
  
  // Fetch departments
  const { data: departments = [], isLoading: isDepartmentsLoading } = useQuery({
    queryKey: ['http://localhost:5000/api/dashboard/departments'],
  });
  
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  const handleExportReport = () => {
    toast({
      title: "Export initiated",
      description: "Your report is being generated and will download shortly.",
    });
    
    // In a real app, this would trigger a report generation API
    setTimeout(() => {
      toast({
        title: "Export completed",
        description: "Report has been exported successfully.",
      });
    }, 1500);
  };
  
  // Filter payrolls based on selected year and month
  const filteredPayrolls = payrolls.filter((payroll: any) => {
    if (selectedYear !== 'all' && payroll.year.toString() !== selectedYear) {
      return false;
    }
    if (selectedMonth !== 'all' && payroll.month.toString() !== selectedMonth) {
      return false;
    }
    return true;
  });
  
  // Generate monthly payroll data for bar chart
  const getMonthlyPayrollData = () => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    const data = months.map((month, index) => {
      const monthPayrolls = payrolls.filter((p: any) => 
        p.month === index + 1 && 
        p.year.toString() === selectedYear
      );
      
      const totalGross = monthPayrolls.reduce((sum: number, p: any) => 
        sum + Number(p.grossAmount), 0
      );
      
      const totalNet = monthPayrolls.reduce((sum: number, p: any) => 
        sum + Number(p.netAmount), 0
      );
      
      const totalTax = monthPayrolls.reduce((sum: number, p: any) => 
        sum + Number(p.taxDeductions), 0
      );
      
      return {
        name: month,
        gross: totalGross,
        net: totalNet,
        tax: totalTax
      };
    });
    
    return data;
  };
  
  // Generate department distribution data for pie chart
  const getDepartmentData = () => {
    return departments.map((dept: any) => ({
      name: dept.name,
      value: dept.count,
      percentage: dept.percentage
    }));
  };
  
  const monthlyPayrollData = getMonthlyPayrollData();
  const departmentData = getDepartmentData();
  
  // Generate years for select dropdown (current year and 2 previous years)
  const years = [];
  const currentYear = new Date().getFullYear();
  for (let i = 0; i < 3; i++) {
    years.push((currentYear - i).toString());
  }
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
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
  
  // Calculate summary statistics
  const totalAnnualPayroll = monthlyPayrollData.reduce((sum, item) => sum + item.gross, 0);
  const totalTaxes = monthlyPayrollData.reduce((sum, item) => sum + item.tax, 0);
  const avgMonthlySalary = employees.length > 0
    ? employees.reduce((sum: number, emp: any) => sum + Number(emp.baseSalary), 0) / employees.length
    : 0;
  
  // Colors for pie chart
  const COLORS = ['#1976d2', '#f50057', '#2196f3', '#ff9800', '#4caf50'];
  
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuToggle={toggleSidebar} />
        
        <main className="flex-1 overflow-y-auto bg-[#f5f5f5] p-6">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold">Payroll Reports</h1>
                  <p className="text-muted-foreground">
                    View and analyze payroll data across the organization
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={selectedYear}
                    onValueChange={setSelectedYear}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {years.map((year) => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select
                    value={selectedMonth}
                    onValueChange={setSelectedMonth}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Select Month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Months</SelectItem>
                      <SelectItem value="1">January</SelectItem>
                      <SelectItem value="2">February</SelectItem>
                      <SelectItem value="3">March</SelectItem>
                      <SelectItem value="4">April</SelectItem>
                      <SelectItem value="5">May</SelectItem>
                      <SelectItem value="6">June</SelectItem>
                      <SelectItem value="7">July</SelectItem>
                      <SelectItem value="8">August</SelectItem>
                      <SelectItem value="9">September</SelectItem>
                      <SelectItem value="10">October</SelectItem>
                      <SelectItem value="11">November</SelectItem>
                      <SelectItem value="12">December</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button onClick={handleExportReport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Report
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      Annual Payroll
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalAnnualPayroll)}</div>
                    <p className="text-xs text-muted-foreground">
                      Total gross payroll for {selectedYear}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      Tax Deductions
                    </CardTitle>
                    <BarChartIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalTaxes)}</div>
                    <p className="text-xs text-muted-foreground">
                      Total tax deductions for {selectedYear}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      Average Salary
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(avgMonthlySalary)}</div>
                    <p className="text-xs text-muted-foreground">
                      Average monthly salary per employee
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Monthly Payroll Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={monthlyPayrollData}
                          margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 5,
                          }}
                        >
                          <XAxis dataKey="name" />
                          <YAxis 
                            tickFormatter={(value) => 
                              new Intl.NumberFormat('en-US', {
                                notation: 'compact',
                                compactDisplay: 'short',
                                currency: 'USD',
                                style: 'currency',
                              }).format(value)
                            } 
                          />
                          <Tooltip 
                            formatter={(value) => formatCurrency(Number(value))} 
                            labelFormatter={(label) => `Month: ${label}`}
                          />
                          <Legend />
                          <Bar dataKey="gross" name="Gross Amount" fill="#1976d2" />
                          <Bar dataKey="net" name="Net Amount" fill="#4caf50" />
                          <Bar dataKey="tax" name="Tax Deductions" fill="#f50057" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Department Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={departmentData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percentage }) => `${name}: ${percentage}%`}
                          >
                            {departmentData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value, name, props) => [`${value} employees`, props.payload.name]} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Yearly Payroll Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 font-medium">Month</th>
                          <th className="text-right py-3 font-medium">Gross Amount</th>
                          <th className="text-right py-3 font-medium">Tax Deductions</th>
                          <th className="text-right py-3 font-medium">Net Amount</th>
                          <th className="text-right py-3 font-medium">Employees Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyPayrollData.map((month, index) => {
                          // Count employees paid this month
                          const employeesPaid = new Set(
                            payrolls
                              .filter((p: any) => p.month === index + 1 && p.year.toString() === selectedYear)
                              .map((p: any) => p.employeeId)
                          ).size;
                          
                          return (
                            <tr key={month.name} className="border-b hover:bg-neutral-lightest">
                              <td className="py-3">{month.name}</td>
                              <td className="py-3 text-right">{formatCurrency(month.gross)}</td>
                              <td className="py-3 text-right">{formatCurrency(month.tax)}</td>
                              <td className="py-3 text-right">{formatCurrency(month.net)}</td>
                              <td className="py-3 text-right">{employeesPaid}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-muted">
                          <td className="py-3 font-bold">Total</td>
                          <td className="py-3 text-right font-bold">
                            {formatCurrency(monthlyPayrollData.reduce((sum, item) => sum + item.gross, 0))}
                          </td>
                          <td className="py-3 text-right font-bold">
                            {formatCurrency(monthlyPayrollData.reduce((sum, item) => sum + item.tax, 0))}
                          </td>
                          <td className="py-3 text-right font-bold">
                            {formatCurrency(monthlyPayrollData.reduce((sum, item) => sum + item.net, 0))}
                          </td>
                          <td className="py-3 text-right font-bold">
                            {employees.length}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
