export type PendingTaskFeedbackItem = {
  taskId: string;
  taskTitle: string;
  invoiceId: string;
  invoiceNumber: string;
  employeeId: string;
  employeeName: string;
  invoiceSentAt: string;
};

export type PendingTaskFeedbackResponse = {
  items: PendingTaskFeedbackItem[];
};

export type ClientTaskFeedback = {
  id: string;
  taskId: string;
  taskTitle: string;
  invoiceId: string;
  employeeId: string;
  employeeName: string;
  taskRating: number;
  employeeRating: number;
  replayed: boolean;
  createdAt: string;
};

export type TaskFeedbackLogItem = {
  id: string;
  taskId: string;
  taskTitle: string;
  clientId: string;
  clientName: string;
  employeeId: string;
  employeeName: string;
  taskRating: number;
  employeeRating: number;
  createdAt: string;
};

export type TaskFeedbackLogResponse = {
  items: TaskFeedbackLogItem[];
  total: number;
};

export async function listPendingTaskFeedback(): Promise<PendingTaskFeedbackResponse> {
  const response = await fetch("/api/client-portal/task-feedback/pending");
  if (!response.ok) {
    throw new Error("Could not load pending feedback.");
  }
  return response.json() as Promise<PendingTaskFeedbackResponse>;
}

export async function submitTaskFeedback(input: {
  taskId: string;
  invoiceId: string;
  taskRating: number;
  employeeRating: number;
  idempotencyKey: string;
}): Promise<ClientTaskFeedback> {
  const response = await fetch("/api/client-portal/task-feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Feedback could not be submitted.");
  }
  return response.json() as Promise<ClientTaskFeedback>;
}

export async function listTenantTaskFeedbackLog(): Promise<TaskFeedbackLogResponse> {
  const response = await fetch("/api/tenant-admin/task-feedback");
  if (!response.ok) {
    throw new Error("Could not load feedback log.");
  }
  return response.json() as Promise<TaskFeedbackLogResponse>;
}

export async function listEmployeeTaskFeedbackLog(): Promise<TaskFeedbackLogResponse> {
  const response = await fetch("/api/employee/task-feedback");
  if (!response.ok) {
    throw new Error("Could not load your feedback.");
  }
  return response.json() as Promise<TaskFeedbackLogResponse>;
}
