import { BadRequestException } from "@nestjs/common";
import type { PoolClient } from "pg";

export async function resolveServiceIdsForSpecialization(
  client: PoolClient,
  tenantId: string,
  serviceIds: readonly string[],
  skillNames: readonly string[],
): Promise<readonly string[]> {
  if (serviceIds.length) return [...new Set(serviceIds)];
  const names = [...new Set(skillNames.map((skill) => skill.trim()).filter(Boolean).map((skill) => skill.toLowerCase()))];
  if (!names.length) return [];
  const found = await client.query<{ id: string }>(
    `
      select id::text
      from public.services
      where tenant_id = $1
        and status = 'active'
        and lower(name) = any($2::text[])
    `,
    [tenantId, names],
  );
  return found.rows.map((row) => row.id);
}

export async function replaceEmployeeSpecialization(
  client: PoolClient,
  tenantId: string,
  employeeId: string,
  serviceIds: readonly string[],
): Promise<readonly string[]> {
  const uniqueIds = [...new Set(serviceIds)];
  let names: string[] = [];
  if (uniqueIds.length) {
    const found = await client.query<{ id: string; name: string }>(
      `
        select id::text, name
        from public.services
        where tenant_id = $1
          and id = any($2::uuid[])
          and status = 'active'
        order by lower(name)
      `,
      [tenantId, uniqueIds],
    );
    if (found.rowCount !== uniqueIds.length) {
      throw new BadRequestException({
        code: "SERVICE_NOT_AVAILABLE",
        message: "Select active services for this tenant.",
      });
    }
    names = found.rows.map((row) => row.name);
  }

  await client.query(
    `
      update public.employee_service_capabilities
      set status = 'inactive', updated_at = now()
      where tenant_id = $1
        and employee_id = $2
        and status = 'active'
        and not (service_id = any($3::uuid[]))
    `,
    [tenantId, employeeId, uniqueIds],
  );

  for (const serviceId of uniqueIds) {
    await client.query(
      `
        insert into public.employee_service_capabilities (tenant_id, employee_id, service_id, status)
        values ($1, $2, $3, 'active')
        on conflict (tenant_id, employee_id, service_id) do update
          set status = 'active', updated_at = now()
      `,
      [tenantId, employeeId, serviceId],
    );
  }

  await client.query("delete from public.employee_skills where tenant_id = $1 and employee_id = $2", [
    tenantId,
    employeeId,
  ]);

  for (const name of names) {
    const code = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    if (!code) continue;
    const skillResult = await client.query<{ id: string }>(
      `
        insert into public.skills (tenant_id, code, name, status)
        values ($1, $2, $3, 'active')
        on conflict (tenant_id, code) do update
          set name = excluded.name,
              status = 'active',
              updated_at = now()
        returning id::text
      `,
      [tenantId, code, name],
    );
    const skillId = skillResult.rows[0]?.id;
    if (!skillId) continue;
    await client.query(
      `
        insert into public.employee_skills (
          tenant_id,
          employee_id,
          skill_id,
          proficiency_level,
          is_verified
        )
        values ($1, $2, $3, 'intermediate', false)
        on conflict (employee_id, skill_id) do update
          set updated_at = now()
      `,
      [tenantId, employeeId, skillId],
    );
  }

  return names;
}
