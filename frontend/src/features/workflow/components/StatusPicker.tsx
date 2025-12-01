import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Users, Clock, Send, UserCheck, Filter } from 'lucide-react';
import type { StatusValue, StatusPickerProps } from '@/shared/types';


interface StatusMapping {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}


export const STATUS_MAPPING: Record<StatusValue, StatusMapping> = {
  all: { label: 'All Statuses', icon: Filter },
  incoming: { label: 'Pending', icon: Clock },
  outgoing: { label: 'Sent', icon: Send },
  ally: { label: 'Connections', icon: UserCheck }
} as const;


const StatusPicker: React.FC<StatusPickerProps> = ({
  selectedStatus,
  onStatusChange,
  connectionCounts,
  className = ''
}) => {
  
  const getStatusCount = (status: StatusValue): number => {
    switch (status) {
      case 'all':
        return connectionCounts.incoming + connectionCounts.outgoing + connectionCounts.ally;
      case 'incoming':
        return connectionCounts.incoming;
      case 'outgoing':
        return connectionCounts.outgoing;
      case 'ally':
        return connectionCounts.ally;
      default:
        return 0;
    }
  };

  
  const getSelectedStatusDisplay = () => {
    const config = STATUS_MAPPING[selectedStatus];
    const Icon = config.icon;
    const count = getStatusCount(selectedStatus);

    return (
      <div className="flex items-center space-x-2">
        <Icon className="h-4 w-4" />
        <span>{config.label}</span>
        <Badge
          variant="outline"
          className="ml-2 text-xs bg-blue-600/20 border-blue-400/50 text-blue-300"
        >
          {count}
        </Badge>
      </div>
    );
  };

  
  const renderSelectItem = (status: StatusValue) => {
    const config = STATUS_MAPPING[status];
    const Icon = config.icon;
    const count = getStatusCount(status);

    return (
      <SelectItem key={status} value={status}>
        <div className="flex items-center space-x-2 w-full">
          <Icon className="h-4 w-4" />
          <span className="flex-1">{config.label}</span>
          <Badge
            variant="outline"
            className="ml-2 text-xs bg-white/5 border-white/20 text-slate-400"
          >
            {count}
          </Badge>
        </div>
      </SelectItem>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center space-x-2 mb-4">
        <Users className="h-5 w-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Filter Connections</h3>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status-select" className="text-sm font-medium text-slate-300">
          Connection Status
        </Label>
        <Select value={selectedStatus} onValueChange={(value) => onStatusChange(value as StatusValue)}>
          <SelectTrigger
            id="status-select"
            className="w-full bg-white/5 border-white/20 text-white hover:bg-white/10 focus:border-blue-400"
          >
            <SelectValue>
              {getSelectedStatusDisplay()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-white/20">
            {(Object.keys(STATUS_MAPPING) as StatusValue[]).map(renderSelectItem)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default StatusPicker;