import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  AlertTriangle,
  BarChart
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface SummaryCardProps {
  title: string;
  value: string | number;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  type: 'employees' | 'payroll' | 'average' | 'pending';
}

export function SummaryCard({ title, value, trend, type }: SummaryCardProps) {
  // Icon based on card type
  const getIcon = () => {
    switch (type) {
      case 'employees':
        return <Users className="text-primary" size={24} />;
      case 'payroll':
        return <DollarSign className="text-secondary" size={24} />;
      case 'average':
        return <BarChart className="text-[#2196f3]" size={24} />;
      case 'pending':
        return <AlertTriangle className="text-[#ff9800]" size={24} />;
      default:
        return <TrendingUp className="text-primary" size={24} />;
    }
  };
  
  // Background color based on card type
  const getBgColor = () => {
    switch (type) {
      case 'employees':
        return 'bg-primary/20';
      case 'payroll':
        return 'bg-secondary/20';
      case 'average':
        return 'bg-[#2196f3]/20';
      case 'pending':
        return 'bg-[#ff9800]/20';
      default:
        return 'bg-primary/20';
    }
  };
  
  return (
    <Card className="bg-white">
      <CardContent className="pt-6">
        <div className="flex items-start">
          <div className="flex-1">
            <p className="text-neutral-medium text-sm">{title}</p>
            <p className="text-2xl font-medium mt-1">{value}</p>
            
            {trend && (
              <p className={`text-sm flex items-center mt-2 ${trend.isPositive ? 'text-[#4caf50]' : 'text-[#f44336]'}`}>
                {trend.isPositive ? (
                  <TrendingUp className="mr-1" size={16} />
                ) : (
                  <TrendingDown className="mr-1" size={16} />
                )}
                <span>{trend.value}</span>
              </p>
            )}
          </div>
          
          <div className={`w-12 h-12 rounded-full ${getBgColor()} flex items-center justify-center`}>
            {getIcon()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
