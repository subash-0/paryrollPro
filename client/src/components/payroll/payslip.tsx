import { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Separator } from '@/components/ui/separator';
import { employees, PayrollWithDetails } from '@shared/schema';
import { FileDown, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PayslipProps {
  payrollId: number;
}

export function Payslip({ payrollId }: PayslipProps) {
  const divRef = useRef<HTMLDivElement>(null);
 
  const { data: payroll, isLoading } = useQuery<PayrollWithDetails>({
    queryKey: [`http://localhost:5000/api/payrolls/${payrollId}`, payrollId],
  });
  


  
  const formattedDate = useMemo(() => {
    if (!payroll) return '';
    
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return `${months[payroll.month - 1]} ${payroll.year}`;
  }, [payroll]);
  
  console.log(payroll);
  const formatCurrency = (amount: number | string | null | undefined) => {
    if (amount === null || amount === undefined) return '$0.00';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(amount));
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleDownload = async () => {
    if (!divRef.current) return;
  
    const canvas = await html2canvas(divRef.current, {
      scale: 2, // Improves quality
      useCORS: true, // Handles external styles
      backgroundColor: null, // Keeps background transparent
    });
  
    const imageData = canvas.toDataURL("image/png");
  
    const pdf = new jsPDF("p", "mm", "a4");
    const imgWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
  
    pdf.addImage(imageData, "PNG", 0, 10, imgWidth, imgHeight);
    pdf.save(`${payroll.employee?.user?.firstName}_Payslip.pdf`);
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <p>Loading payslip...</p>
      </div>
    );
  }
  
  if (!payroll) {
    return (
      <div className="flex justify-center items-center h-40">
        <p>Payslip not found</p>
      </div>
    );
  }
  
  return (
    <Card className="w-full max-w-3xl mx-auto print:shadow-none" ref={divRef}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-2xl">Payslip</CardTitle>
          <p className="text-muted-foreground">{formattedDate}</p>
        </div>
        <div className="flex space-x-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <FileDown className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="flex flex-col md:flex-row md:justify-between gap-4">
          <div>
            <h3 className="font-medium text-sm text-muted-foreground mb-1">Employee</h3>
            <p className="font-semibold text-lg">
              {payroll.employee?.user?.firstName} {payroll.employee?.user?.lastName}
            </p>
            <p className="text-sm">{payroll.employee?.position}</p>
            <p className="text-sm">{payroll.employee?.department?.name}</p>
          </div>
          
          <div className="text-right">
            <h3 className="font-medium text-sm text-muted-foreground mb-1">Status</h3>
            <StatusBadge status={payroll.status as any} className="ml-auto" />
            <p className="text-sm mt-1">Reference: #{payroll.id}</p>
            <p className="text-sm">Tax ID: {payroll.employee?.taxId}</p>
          </div>
        </div>
        
        <Separator />
        
        <div className="space-y-4">
          <h3 className="font-medium">Earnings</h3>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Base Salary</span>
              <span>{formatCurrency(payroll.grossAmount)}</span>
            </div>
            
            {Number(payroll.bonuses) > 0 && (
              <div className="flex justify-between">
                <span>Bonuses</span>
                <span>{formatCurrency(payroll.bonuses)}</span>
              </div>
            )}
            
            <div className="flex justify-between font-medium pt-2 border-t">
              <span>Total Earnings</span>
              <span>{formatCurrency(Number(payroll.grossAmount) + Number(payroll.bonuses))}</span>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="font-medium">Deductions</h3>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Income Tax</span>
              <span>-{formatCurrency(payroll.taxDeductions)}</span>
            </div>
            
            {Number(payroll.otherDeductions) > 0 && (
              <div className="flex justify-between">
                <span>Other Deductions</span>
                <span>-{formatCurrency(payroll.otherDeductions)}</span>
              </div>
            )}
            
            <div className="flex justify-between font-medium pt-2 border-t">
              <span>Total Deductions</span>
              <span>-{formatCurrency(Number(payroll.taxDeductions) + Number(payroll.otherDeductions))}</span>
            </div>
          </div>
        </div>
        
        {payroll.details?.deductionDetails && (
          <div className="space-y-2">
            <h3 className="font-medium">Additional Notes</h3>
            <p className="text-sm">{payroll.details.deductionDetails}</p>
          </div>
        )}
        
        <div className="bg-muted p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Net Pay</span>
            <span className="text-lg font-bold">{formatCurrency(payroll.netAmount)}</span>
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground">
          <p>Payment processed by: PayrollPro System</p>
          <p>
            {payroll.details?.processedDate && 
              `Processed on: ${new Date(payroll.details.processedDate).toLocaleString()}`
            }
          </p>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col items-center text-center text-xs text-muted-foreground pt-0">
        <p>This is an electronic payslip and does not require a signature.</p>
        <p>For any questions regarding this payslip, please contact the HR department.</p>
      </CardFooter>
    </Card>
  );
}
