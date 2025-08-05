import React, { useState } from 'react';
import StatusPicker, { StatusValue, ConnectionCounts } from './StatusPicker';

const StatusPickerDemo: React.FC = () => {
  const [selectedStatus, setSelectedStatus] = useState<StatusValue>('all');
  
  const mockConnectionCounts: ConnectionCounts = {
    incoming: 5,
    outgoing: 3,
    allies: 12,
    total: 20
  };

  const handleStatusChange = (status: StatusValue) => {
    setSelectedStatus(status);
    console.log('Status changed to:', status);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">StatusPicker Demo</h1>
        
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6">
          <StatusPicker
            selectedStatus={selectedStatus}
            onStatusChange={handleStatusChange}
            connectionCounts={mockConnectionCounts}
          />
        </div>
        
        <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-2">Current Selection</h3>
          <p className="text-slate-300">Selected Status: <span className="text-blue-300 font-medium">{selectedStatus}</span></p>
        </div>
      </div>
    </div>
  );
};

export default StatusPickerDemo;