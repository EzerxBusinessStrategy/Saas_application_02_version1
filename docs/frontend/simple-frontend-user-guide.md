# SaaS App Frontend User Guide

This document explains the current frontend in simple language. It is written
for checking the application in the browser, not for backend or database setup.

The current project is a frontend demo with mock data. Some actions save only in
the current browser session or local storage until a backend API is connected.

## 1. How to open the frontend

1. Start the local frontend server.
2. Open this URL in the browser:

   `http://localhost:4008`

3. If you are not logged in, the app sends you to:

   `http://localhost:4008/login`


   Or

   use saas02.netlify.app this link to access it

## 2. Demo login credentials

Use these credentials for testing.

| Portal | Portal access option | Login ID | Password |
| --- | --- | --- | --- |
| Super Admin | Super Admin | `abcd1234@gmail.com` | `1234` |
| Tenant Admin | Tenant Admin | `abcd1234@gmail.com` | `1234` |
| Manager | Manager | `abcd1234@gmail.com` | `1234` |
| Employee | Employee | `abcd1234@gmail.com` | `1234` |
| Client User | Client User | `abcd1234@gmail.com` | `1234` |

Important:

- All portals use the same demo email and password.
- Select the correct `Portal access` option before signing in.
- Direct URL access is role checked in the frontend. For example, an employee
  should not be able to open Super Admin pages by typing the URL.

## 3. Common layout and controls

All logged-in portals use the same main layout:

- Left sidebar: main navigation for the current role.
- Top header: breadcrumbs, search, theme toggle, notifications, and user menu.
- Theme toggle: switches light and dark mode.
- User menu: profile/preferences and sign out.
- Notifications: shows role-related activity alerts.
- Sidebar collapse: reduces the sidebar to icons only.

## 4. Super Admin portal

Super Admin manages the whole platform. This role is for the mother company or
platform owner.

Base URL:

`http://localhost:4008/super-admin`

### 4.1 Dashboard

URL:

`/super-admin`

Purpose:

- Shows platform-wide health.
- Shows total tenants, active tenants, suspended tenants, tenant reviews, and
  active platform users.
- Shows tenant health, recent platform activity, platform alerts, and global
  audit activity.

How to check:

1. Login as Super Admin.
2. Open `/super-admin`.
3. Check KPI cards at the top.
4. Check tenant health and platform alerts.

### 4.2 Tenants

URL:

`/super-admin/tenants`

Purpose:

- View tenant companies.
- Filter and review tenant status.
- Open tenant details.
- Create a new tenant from the frontend flow.

How to check:

1. Open `Platform > Tenants`.
2. Search or filter tenant records.
3. Open tenant actions.
4. Use the create tenant action to test the provisioning form.

### 4.3 Global reports

URL:

`/super-admin/reports`

Purpose:

- Shows platform-level reporting.
- Helps the platform owner understand tenant health and usage.

How to check:

1. Open `Operations > Reports`.
2. Review the tenant health and platform usage chart.
3. Hover charts to check tooltip readability.

### 4.4 Global audit logs

URL:

`/super-admin/audit-log`

Purpose:

- Shows platform-wide administrative actions.
- Helps trace who changed what, when, and whether it succeeded.

How to check:

1. Open `Operations > Audit log`.
2. Search or filter records.
3. Open an audit record detail drawer.

### 4.5 Platform configuration

URL:

`/super-admin/platform-settings`

Purpose:

- Lets Super Admin configure frontend platform defaults.
- Current working items include platform name and default brand colour.
- The colour field supports hex input, colour picker, and RGB preview.

How to check:

1. Open `Platform > Platform configuration`.
2. Change `Platform name`.
3. Change `Default brand colour`.
4. Confirm the RGB value appears below the colour field.
5. Click `Publish platform configuration`.
6. Check that the app brand name and primary colour update in the browser.

Current limitation:

- Security, MFA, reporting, and support-session settings are frontend-only
  placeholders until backend configuration and audit workflows are connected.

### 4.6 Support access

URL:

`/super-admin/support-access`

Purpose:

- Represents controlled support access to a tenant workspace.
- Support access must be visible, reasoned, time-limited, and auditable.

How to check:

1. Open `Platform > Support access`.
2. Select a tenant.
3. Select a maximum session time.
4. Enter a support reason.
5. Start the visible support session.

Current limitation:

- This does not actually impersonate a tenant user. Backend authorization is
  required before real support access can be used.

## 5. Tenant Admin portal

Tenant Admin manages one tenant company. This role controls clients, work,
employees, documents, invoices, reports, settings, and support tickets.

Base URL:

`http://localhost:4008/admin`

### 5.1 Dashboard

URL:

`/admin`

Purpose:

- Shows operational overview for the tenant.
- Shows active clients, active engagements, open tasks, SLA compliance,
  employee utilisation, and outstanding invoices.
- Shows at-risk work, organisation setup progress, upcoming deadlines, and
  recent activity.

How to check:

1. Login as Tenant Admin.
2. Open `/admin`.
3. Review the KPI cards and at-risk work.

### 5.2 Tasks

URL:

`/admin/tasks`

Purpose:

- Manage client work.
- View tasks by board or list.
- Open task details.
- Assign employees, set due dates, priority, complexity, checklist, review, and
  approval status.

How to check:

1. Open `Delivery > Tasks`.
2. Use search and filters.
3. Switch between board and list.
4. Open a task drawer and check assignment controls.

### 5.3 Clients

URL:

`/admin/clients`

Purpose:

- View client companies served by the tenant.
- Manage client contacts and service engagements.
- Check client delivery health and outstanding work.

How to check:

1. Open `Delivery > Clients`.
2. Search or filter clients.
3. Open a client detail page.
4. Check contacts, agreements, services, and work information.

### 5.4 Work groups

URL:

`/admin/work-groups`

Purpose:

- Organise work by client, service engagement, manager, and employees.
- Track workload, capacity, open tasks, and SLA status.

How to check:

1. Open `Delivery > Work groups`.
2. Review group status, manager, workload, and capacity.

### 5.5 Employees

URL:

`/admin/employees`

Purpose:

- Employee directory for the tenant.
- Shows employee name, code, department, categories, skills, manager, workload,
  availability, status, and work groups.

How to check:

1. Open `Operations > Employees`.
2. Use search and filters.
3. Check desktop table and mobile employee-card layout.

### 5.6 Documents

URL:

`/admin/documents`

Purpose:

- Manage shared documents for tenant operations.
- Upload document metadata in the frontend mock.
- Check document visibility and status.

How to check:

1. Open `Operations > Documents`.
2. Open upload document.
3. Select file metadata and check the upload UI.

### 5.7 Invoices, payments, and agreements

URLs:

- `/admin/invoices`
- `/admin/payments`
- `/admin/agreements`

Purpose:

- View billing and finance-related frontend screens.
- Track invoices, payment status, agreements, and document records.

How to check:

1. Open each route from the sidebar.
2. Review tables, cards, status badges, and actions.

### 5.8 Reports

URL:

`/admin/reports`

Purpose:

- Tenant operational reports.
- Includes task completion trend, task status distribution, SLA compliance
  trend, and workforce utilisation.
- SLA compliance uses a combined line and scatter chart.

How to check:

1. Open `Operations > Reports`.
2. Check each chart.
3. Hover charts and confirm labels are readable.

### 5.9 Audit log

URL:

`/admin/audit-log`

Purpose:

- Shows tenant-level administrative activity.
- Helps the tenant admin see important operational changes.

How to check:

1. Open `Operations > Audit log`.
2. Search and filter records.
3. Open record details.

### 5.10 Managers

URL:

`/admin/managers`

Purpose:

- View managers in the tenant.
- Check assigned clients, employees, work groups, pending reviews, utilisation,
  and SLA performance.

### 5.11 Organisation

URL:

`/admin/organisation`

Purpose:

- Manage tenant organisation structure.
- Includes departments, categories, skills, workload planning, and capacity.

### 5.12 Settings and branding

URLs:

- `/admin/settings`
- `/admin/branding`

Purpose:

- Manage tenant branding and preferences.
- Change company name.
- Change primary colour, sidebar colour, and surface colour.
- See RGB values.
- Use colour picker.
- Preview theme, density, and font before publishing.
- Publish changes to the current browser session.

How to check:

1. Open `Operations > Settings`.
2. Stay on the `Branding` tab.
3. Change company name or colours.
4. Use `Reset colours` if needed.
5. Click `Publish changes`.
6. Check manager and employee portals in the same browser to see tenant branding
   reflected for that tenant.

Current limitation:

- This is browser-session persistence. Real tenant-wide publishing needs a
  backend branding API.

### 5.13 Progress settings

URL:

`/admin/gamification`

Purpose:

- Controls optional progress and recognition features.
- This was previously named gamification.
- Examples include professional progress, consistency tracking, achievements,
  manager recognition, team recognition feed, client onboarding progress, and
  service milestones.

How to check:

1. Open `Operations > Progress settings`.
2. Tick or untick options.
3. Save tenant policy.

Current limitation:

- Backend policy enforcement is still required for real production behavior.

### 5.14 Support tickets

URL:

`/admin/tickets`

Purpose:

- Tenant Admin can view client support tickets.
- Tenant Admin can assign a ticket to an employee.
- Tenant Admin can reply to the client and resolve the ticket.

How to check:

1. Open `Operations > Support tickets`.
2. Open a ticket.
3. Assign employee, send update, or resolve request.

## 6. Manager portal

Manager handles assigned clients, work groups, employees, reviews, approvals,
support tickets, and reports.

Base URL:

`http://localhost:4008/manager`

### 6.1 Dashboard

URL:

`/manager`

Purpose:

- Shows team delivery overview.
- Shows assigned work groups, employees, reviews, SLA risks, and priorities.

### 6.2 Tasks

URL:

`/manager/tasks`

Purpose:

- View and manage tasks assigned to manager work groups.
- Open task details and review workflow.

### 6.3 Assigned clients

URL:

`/manager/clients`

Purpose:

- Shows only clients assigned to the manager.

### 6.4 Support tickets

URL:

`/manager/tickets`

Purpose:

- Manager can see support tickets for assigned clients.
- Manager can assign ticket work to an employee.
- Manager can reply to the client and resolve tickets.

### 6.5 Work groups

URL:

`/manager/work-groups`

Purpose:

- Shows assigned work groups and workload status.

### 6.6 Assigned employees

URL:

`/manager/employees`

Purpose:

- Shows employees assigned to the manager's work groups.

### 6.7 Review queue

URL:

`/manager/reviews`

Purpose:

- Shows employee work submitted for manager review.
- Manager can approve or reject the employee submission.

Workflow:

1. Employee moves a task from `In progress` to `Review`.
2. Employee confirms submission.
3. Manager receives the work in review queue.
4. Manager approves or rejects it.

### 6.8 Approval queue

URL:

`/manager/approvals`

Purpose:

- Shows work that needs approval after manager review.
- Manager can submit completed manager-reviewed work for tenant approval.

### 6.9 Team workload

URL:

`/manager/workload`

Purpose:

- Shows capacity and workload of assigned employees and work groups.

### 6.10 Manager reports

URL:

`/manager/manager-reports`

Purpose:

- Shows manager-level delivery and performance reports.

### 6.11 Documents, achievements, recognition, preferences, notifications, profile

URLs:

- `/manager/documents`
- `/manager/achievements`
- `/manager/recognition`
- `/manager/preferences`
- `/manager/notifications`
- `/manager/profile`

Purpose:

- Documents: manager-visible documents.
- Achievements: progress and achievement information.
- Recognition: manager recognition feed.
- Preferences: manager user preferences.
- Notifications: manager alerts.
- Profile: manager profile.

## 7. Employee portal

Employee handles assigned personal work, work logs, timesheet, calendar,
documents, recognition, notifications, and profile.

Base URL:

`http://localhost:4008/employee`

### 7.1 Dashboard

URL:

`/employee`

Purpose:

- Shows the employee's day, due work, in-progress work, logged hours, and
  submitted items.

### 7.2 My tasks

URL:

`/employee/tasks`

Purpose:

- Shows tasks assigned to the employee.
- Supports task board and task list.
- Employee can move work through allowed statuses.

Important workflow:

1. Task starts in `To do`.
2. Employee moves it to `In progress`.
3. Timer starts automatically while it is in progress.
4. Employee moves it from `In progress` to `Review`.
5. A confirmation popup warns that after submission the employee cannot change
   the status until manager review.
6. Manager reviews the task.
7. If approved, it moves forward.
8. If rejected, it appears as rejected for the employee and can be moved back to
   `In progress` for rework.

### 7.3 Work logs

URL:

`/employee/work-logs`

Purpose:

- Employee records work completed for assigned tasks.

### 7.4 Timesheet

URL:

`/employee/timesheet`

Purpose:

- Shows employee time and work-log summary.

### 7.5 Calendar

URL:

`/employee/calendar`

Purpose:

- Calendar view of assigned tasks and milestones.
- Employee can click a date to see task details, assigned by, deadline, client,
  and related work information.
- Employee can route from the calendar to the task.

### 7.6 Documents

URL:

`/employee/documents`

Purpose:

- Shows documents available to the employee.

### 7.7 Recognition

URL:

`/employee/recognition`

Purpose:

- Shows recognition and progress-related activity.

### 7.8 Notifications

URL:

`/employee/notifications`

Purpose:

- Shows employee alerts, review updates, task changes, and reminders.

### 7.9 Profile

URL:

`/employee/profile`

Purpose:

- Shows employee profile and personal details.

## 8. Client portal

Client portal is for the tenant's client users. Clients can see their own
services, documents, invoices, payments, agreements, support requests, and
deliverables.

Base URL:

`http://localhost:4008/client`

### 8.1 Dashboard

URL:

`/client`

Purpose:

- Shows client service overview.
- Shows active services, progress, milestones, invoices, and requests.

### 8.2 Active services

URL:

`/client/services`

Purpose:

- Shows services the client is receiving from the tenant.

### 8.3 Onboarding

URL:

`/client/onboarding`

Purpose:

- Shows onboarding checklist and setup progress.

### 8.4 Deliverables

URL:

`/client/deliverables`

Purpose:

- Shows documents or work outputs delivered to the client.

### 8.5 Requests

URL:

`/client/requests`

Purpose:

- Shows client service requests and follow-ups.

### 8.6 Invoices and payments

URLs:

- `/client/invoices`
- `/client/payments`

Purpose:

- Client can view invoices and payment-related records.

### 8.7 Agreements

URL:

`/client/agreements`

Purpose:

- Shows client agreements and contract-related documents.

### 8.8 Documents

URL:

`/client/documents`

Purpose:

- Client can view shared documents.
- Client can upload document metadata in the frontend mock.

### 8.9 Support

URL:

`/client/support`

Purpose:

- Client can create a professional support request.
- Form includes service/project, issue category, business impact, affected
  users, summary, description, optional page URL, optional attachments, and
  contact preference.
- After submission, a ticket ID and confirmation are shown.

Ticket workflow:

1. Client submits a support request.
2. Assigned manager and tenant admin can see the ticket.
3. Manager or tenant admin can assign the ticket to an employee.
4. Manager or tenant admin can send a client-visible reply.
5. Manager or tenant admin can resolve the ticket.

### 8.10 Notifications and profile

URLs:

- `/client/notifications`
- `/client/profile`

Purpose:

- Notifications: client alerts and updates.
- Profile: client user profile.

## 9. Important frontend workflows

### 9.1 Role-based login

- All portals use the same demo email and password.
- The selected portal controls which workspace opens.

### 9.2 Direct URL protection

- The frontend checks whether the logged-in role can open a route.
- If a user tries to open a portal they should not access, the app blocks it or
  redirects.
- This is frontend UX protection only. Production security still needs backend
  authorization.

### 9.3 Tenant branding

- Tenant Admin can change company name, colours, font, density, and preview
  theme.
- Published tenant branding affects tenant-related portals in the same browser.
- Real multi-user publishing requires backend storage.

### 9.4 Super Admin platform branding

- Super Admin can change platform name and default brand colour.
- RGB value is shown for the selected colour.
- The update applies in the current browser session.

### 9.5 Task review workflow

- Employee submits completed work for manager review.
- Manager approves or rejects.
- If rejected, employee can rework it.
- Manager-reviewed work can move toward tenant approval.

### 9.6 Support ticket workflow

- Client raises ticket.
- Manager and Tenant Admin can view it.
- Manager or Tenant Admin can assign it to employee.
- Manager or Tenant Admin can reply or resolve.

### 9.7 Documents and invoices

- Documents and finance modules are frontend mock workflows.
- They validate metadata and show role-based views.
- Actual file bytes, storage, download permissions, and invoice payment
  processing need backend services.

## 10. Current demo limitations

- Mock data is used until backend APIs are connected.
- Some saved changes are browser-local only.
- Frontend permission checks are not a replacement for backend authorization.
- Support access does not perform real tenant impersonation.
- Upload forms retain metadata only unless backend storage is connected.
- Audit and configuration actions need backend audit trails for production.
