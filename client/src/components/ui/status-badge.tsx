import { cn } from '@/lib/utils';

type StatusType = 'completed' | 'pending' | 'failed' | 'active' | 'inactive' | 'terminated';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStyles = () => {
    switch (status) {
      case 'completed':
      case 'active':
        return 'bg-[#4caf50]/20 text-[#4caf50]';
      case 'pending':
        return 'bg-[#ff9800]/20 text-[#ff9800]';
      case 'failed':
      case 'terminated':
        return 'bg-[#f44336]/20 text-[#f44336]';
      case 'inactive':
        return 'bg-gray-200 text-gray-600';
      default:
        return 'bg-gray-200 text-gray-600';
    }
  };
  
  return (
    <span 
      className={cn(
        'px-2 py-1 rounded-full text-xs font-medium capitalize',
        getStyles(),
        className
      )}
    >
      {status}
    </span>
  );
}
