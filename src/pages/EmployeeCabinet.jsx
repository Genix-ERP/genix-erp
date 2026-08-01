import React from 'react';
import EmployeePortal from '@/components/payroll/EmployeePortal';

// Xodim kabineti — employee self-service area (own payslips, own loan
// balance), reachable from the user menu. Moved out of the payroll admin
// module (audit §4): an ordinary xodim never needs the admin screens to see
// their own money. All data comes from the server-scoped /my/* endpoints.
export default function EmployeeCabinet() {
  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <EmployeePortal />
      </div>
    </div>
  );
}
