// Đường dẫn của Technician/Supervisor Workspace.

export const INTERNAL_PATHS = {
  technician: '/technician',
  technicianTickets: '/technician/tickets',
  technicianTicketDetail: (id: string) => `/technician/tickets/${id}`,
  supervisor: '/supervisor',
  supervisorQueue: '/supervisor/queue',
  supervisorAssignments: '/supervisor/assignments',
  supervisorDashboard: '/supervisor/dashboard',
} as const;
