import React, { useState } from 'react';
import StatusPicker, { StatusValue, ConnectionCounts } from './StatusPicker';

/**
 * Example usage of StatusPicker component
 * This demonstrates how to integrate the StatusPicker into the Dashboard
 * Updated to use select dropdown interface
 */
const StatusPickerExample: React.FC = () => {
  const [selectedStatus, setSelectedStatus] = useState<StatusValue>('all');
  
  // Example connection counts that would come from the database
  const connectionCounts: ConnectionCounts = {
    incoming: 8,    // Pending connections
    outgoing: 5,    // Sent connection requests
    allies: 23,     // Established connections
    total: 36       // Total of all connection types
  };

  const handleStatusChange = (status: StatusValue) => {
    setSelectedStatus(status);
    console.log('Filter changed to:', status);
    
    // Here you would typically:
    // 1. Update the filtered connections list
    // 2. Fetch new data if needed
    // 3. Update the UI to show filtered results
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">StatusPicker Integration Example</h1>
        
        {/* This is how StatusPicker should be integrated into the Dashboard */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6">
          <StatusPicker
            selectedStatus={selectedStatus}
            onStatusChange={handleStatusChange}
            connectionCounts={connectionCounts}
          />
        </div>
        
        {/* Display current selection for demonstration */}
        <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-2">Current Filter</h3>
          <p className="text-slate-300">
            Selected Status: <span className="text-blue-300 font-medium">{selectedStatus}</span>
          </p>
          <p className="text-slate-400 text-sm mt-2">
            This would filter the connections list to show only the selected status type.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StatusPickerExample;