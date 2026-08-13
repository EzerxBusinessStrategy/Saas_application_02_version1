create or replace view authn.credentials_ist as
select
  id,
  portal_type,
  user_id,
  tenant_id,
  employee_id,
  client_account_id,
  email,
  status,
  failed_login_attempts,
  locked_until at time zone 'Asia/Kolkata' as locked_until_ist,
  last_login_at at time zone 'Asia/Kolkata' as last_login_at_ist,
  password_changed_at at time zone 'Asia/Kolkata' as password_changed_at_ist,
  created_at at time zone 'Asia/Kolkata' as created_at_ist,
  updated_at at time zone 'Asia/Kolkata' as updated_at_ist
from authn.credentials;

revoke all on authn.credentials_ist from public, anon, authenticated, app_runtime, app_readonly;
