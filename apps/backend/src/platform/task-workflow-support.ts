import { PoolClient } from "pg";

type NotificationAudience = "actor" | "employee" | "managers" | "tenant_admins";

type TaskWorkflowNotification = {
  tenantId: string;
  actorUserId: string;
  taskId: string;
  employeeId: string;
  audience: NotificationAudience;
  type: string;
  title: string;
  message: string;
  actionUrl: string;
  eventKey: string;
};

export async function publishTaskWorkflowNotification(
  client: PoolClient,
  notification: TaskWorkflowNotification,
): Promise<void> {
  const recipients = notification.audience === "actor"
    ? "select $2::uuid as user_id"
    : notification.audience === "employee"
    ? `select tm.user_id
       from public.employees e
       join public.tenant_memberships tm on tm.tenant_id = e.tenant_id and tm.id = e.membership_id
       where e.tenant_id = $1 and e.id = $4 and e.employment_status = 'active' and tm.status = 'active'`
    : notification.audience === "tenant_admins"
      ? `select distinct tm.user_id
         from public.tenant_memberships tm
         join public.membership_roles mr on mr.tenant_id = tm.tenant_id and mr.membership_id = tm.id and mr.status = 'active'
         join public.roles r on r.id = mr.role_id
         where tm.tenant_id = $1 and tm.status = 'active' and r.code in ('TENANT_OWNER', 'TENANT_ADMIN')`
      : `select distinct managers.user_id
         from (
           select tm.user_id
           from public.tasks t
           join public.work_group_memberships wgm on wgm.tenant_id = t.tenant_id and wgm.work_group_id = t.work_group_id and wgm.group_role = 'manager' and wgm.status = 'active'
           join public.employees e on e.tenant_id = wgm.tenant_id and e.id = wgm.employee_id and e.employment_status = 'active'
           join public.tenant_memberships tm on tm.tenant_id = e.tenant_id and tm.id = e.membership_id and tm.status = 'active'
           where t.tenant_id = $1 and t.id = $3
           union
           select tm.user_id
           from public.employee_manager_assignments ema
           join public.employees e on e.tenant_id = ema.tenant_id and e.id = ema.manager_employee_id and e.employment_status = 'active'
           join public.tenant_memberships tm on tm.tenant_id = e.tenant_id and tm.id = e.membership_id and tm.status = 'active'
           where ema.tenant_id = $1 and ema.employee_id = $4
         ) managers`;

  await client.query(
    `
      with recipients as (${recipients}),
      inserted as (
        insert into public.notifications (
          type, title, message, severity, tenant_id, actor_user_id, entity_type, entity_id, action_url, metadata, idempotency_key
        ) values ($5, $6, $7, 'INFO', $1, $2, 'task', $3, $8, jsonb_build_object('taskId', $3::uuid, 'employeeId', $4::uuid), $9)
        on conflict (idempotency_key) where idempotency_key is not null do nothing
        returning id
      ), notification_row as (
        select id from inserted
        union all
        select id from public.notifications where idempotency_key = $9
        limit 1
      ), inserted_recipients as (
        insert into public.notification_recipients (notification_id, recipient_user_id)
        select notification_row.id, recipients.user_id
        from notification_row cross join recipients
        on conflict (notification_id, recipient_user_id) do nothing
        returning notification_id
      )
      insert into public.notification_outbox (tenant_id, notification_id, event_type, event_key)
      select $1, notification_row.id, 'TASK_NOTIFICATION_READY', 'task-workflow:' || notification_row.id::text
      from notification_row
      where exists (select 1 from inserted_recipients)
      on conflict (event_key) do nothing
    `,
    [
      notification.tenantId,
      notification.actorUserId,
      notification.taskId,
      notification.employeeId,
      notification.type,
      notification.title,
      notification.message,
      notification.actionUrl,
      notification.eventKey,
    ],
  );
}

export async function resumeReturnedTaskTimer(
  client: PoolClient,
  tenantId: string,
  taskId: string,
  employeeId: string,
): Promise<boolean> {
  await client.query(
    "select id from public.employees where tenant_id = $1 and id = $2 for update",
    [tenantId, employeeId],
  );
  const active = await client.query(
    "select 1 from public.task_work_segments where tenant_id = $1 and employee_id = $2 and ended_at is null limit 1",
    [tenantId, employeeId],
  );
  const sessionStatus = active.rowCount ? "paused" : "active";
  const session = await client.query<{ id: string }>(
    "insert into public.task_work_sessions (tenant_id, task_id, employee_id, status) values ($1, $2, $3, $4) returning id::text",
    [tenantId, taskId, employeeId, sessionStatus],
  );
  const sessionId = session.rows[0]?.id;
  if (!sessionId) throw new Error("Returned task work session could not be created.");
  if (sessionStatus === "paused") return false;
  await client.query(
    "insert into public.task_work_segments (tenant_id, task_id, employee_id, work_session_id) values ($1, $2, $3, $4)",
    [tenantId, taskId, employeeId, sessionId],
  );
  return true;
}
