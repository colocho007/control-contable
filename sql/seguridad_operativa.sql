-- Seguridad operativa para Control+.
-- Ejecutar en Supabase SQL Editor despues de revisar.
-- Este script propone tablas para rate limit, idempotencia, intentos bloqueados
-- y auditoria de Control+ Assist. No modifica RLS de otras tablas.
--
-- Modelo de escritura:
-- - rate_limits_operativos: solo admin/backend/RPC. El frontend comun no debe escribir aqui.
--   Para rate limit real de produccion, crear una RPC security definer que consuma y registre
--   ventanas de uso desde el servidor sin exponer capacidad de escritura directa.
-- - intentos_bloqueados: frontend autenticado puede insertar solo sus propios bloqueos
--   y solo para empresa null o empresa asignada activa.
-- - idempotency_keys_operativas: frontend autenticado puede insertar/actualizar solo sus
--   propias llaves y solo para empresa null o empresa asignada activa.
-- - control_assist_auditoria: frontend/route de Assist puede insertar solo auditoria propia
--   y solo para empresa null o empresa asignada activa; SELECT queda admin-only.
--
-- Las columnas usuario_id nullable en intentos_bloqueados existen para eventos anonimos/IP
-- que deben registrarse desde backend/RPC con service role o security definer, no desde frontend.

create table if not exists public.rate_limits_operativos (
  id uuid primary key default gen_random_uuid(),
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  clave text not null,
  alcance text not null check (alcance in ('ip', 'usuario', 'empresa', 'usuario_empresa', 'assist')),
  usuario_id uuid null references public.perfiles(id),
  empresa_id bigint null references public.empresas(id),
  ip_hash text null,
  modulo text not null,
  accion text not null,
  ventana_inicio timestamptz not null,
  ventana_fin timestamptz not null,
  contador integer not null default 0 check (contador >= 0),
  limite integer not null check (limite > 0),
  bloqueado boolean not null default false,
  ultimo_intento_at timestamptz null,
  metadatos jsonb null
);

create unique index if not exists rate_limits_operativos_clave_ventana_idx
  on public.rate_limits_operativos (clave, ventana_inicio, ventana_fin);

create index if not exists rate_limits_operativos_usuario_idx
  on public.rate_limits_operativos (usuario_id);

create index if not exists rate_limits_operativos_empresa_idx
  on public.rate_limits_operativos (empresa_id);

create index if not exists rate_limits_operativos_modulo_accion_idx
  on public.rate_limits_operativos (modulo, accion);

create index if not exists rate_limits_operativos_bloqueado_idx
  on public.rate_limits_operativos (bloqueado);

create table if not exists public.intentos_bloqueados (
  id uuid primary key default gen_random_uuid(),
  creado_at timestamptz not null default now(),
  usuario_id uuid null references public.perfiles(id),
  empresa_id bigint null references public.empresas(id),
  ip_hash text null,
  modulo text not null,
  accion text not null,
  motivo text not null,
  severidad text not null default 'media' check (severidad in ('baja', 'media', 'alta', 'critica')),
  entidad_tipo text null,
  entidad_id text null,
  mensaje text null,
  metadatos jsonb null
);

create index if not exists intentos_bloqueados_usuario_idx
  on public.intentos_bloqueados (usuario_id);

create index if not exists intentos_bloqueados_empresa_idx
  on public.intentos_bloqueados (empresa_id);

create index if not exists intentos_bloqueados_modulo_accion_idx
  on public.intentos_bloqueados (modulo, accion);

create index if not exists intentos_bloqueados_creado_at_desc_idx
  on public.intentos_bloqueados (creado_at desc);

create table if not exists public.idempotency_keys_operativas (
  id uuid primary key default gen_random_uuid(),
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  expira_at timestamptz not null,
  idempotency_key text not null,
  usuario_id uuid not null references public.perfiles(id),
  empresa_id bigint null references public.empresas(id),
  modulo text not null,
  accion text not null,
  estado text not null default 'en_proceso' check (estado in ('en_proceso', 'completada', 'fallida', 'expirada')),
  request_hash text null,
  entidad_tipo text null,
  entidad_id text null,
  resultado_resumen jsonb null,
  error_resumen text null
);

create unique index if not exists idempotency_keys_operativas_key_idx
  on public.idempotency_keys_operativas (idempotency_key);

create index if not exists idempotency_keys_operativas_usuario_modulo_idx
  on public.idempotency_keys_operativas (usuario_id, modulo, accion);

create index if not exists idempotency_keys_operativas_expira_idx
  on public.idempotency_keys_operativas (expira_at);

create table if not exists public.control_assist_auditoria (
  id uuid primary key default gen_random_uuid(),
  creado_at timestamptz not null default now(),
  usuario_id uuid not null references public.perfiles(id),
  empresa_id bigint null references public.empresas(id),
  modulo text not null default 'control-assist',
  accion text not null,
  consulta_hash text not null,
  tokens_entrada integer null check (tokens_entrada is null or tokens_entrada >= 0),
  tokens_salida integer null check (tokens_salida is null or tokens_salida >= 0),
  proveedor text null,
  modelo text null,
  bloqueado boolean not null default false,
  motivo_bloqueo text null,
  metadatos jsonb null
);

create index if not exists control_assist_auditoria_usuario_idx
  on public.control_assist_auditoria (usuario_id);

create index if not exists control_assist_auditoria_empresa_idx
  on public.control_assist_auditoria (empresa_id);

create index if not exists control_assist_auditoria_creado_at_desc_idx
  on public.control_assist_auditoria (creado_at desc);

create or replace function public.seguridad_operativa_set_actualizado_at()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_at = now();
  return new;
end;
$$;

drop trigger if exists rate_limits_operativos_actualizado_at_trg
  on public.rate_limits_operativos;
create trigger rate_limits_operativos_actualizado_at_trg
before update on public.rate_limits_operativos
for each row execute function public.seguridad_operativa_set_actualizado_at();

drop trigger if exists idempotency_keys_operativas_actualizado_at_trg
  on public.idempotency_keys_operativas;
create trigger idempotency_keys_operativas_actualizado_at_trg
before update on public.idempotency_keys_operativas
for each row execute function public.seguridad_operativa_set_actualizado_at();

alter table public.rate_limits_operativos enable row level security;
alter table public.intentos_bloqueados enable row level security;
alter table public.idempotency_keys_operativas enable row level security;
alter table public.control_assist_auditoria enable row level security;

revoke all on table public.rate_limits_operativos from anon, public;
revoke all on table public.intentos_bloqueados from anon, public;
revoke all on table public.idempotency_keys_operativas from anon, public;
revoke all on table public.control_assist_auditoria from anon, public;

grant select, insert, update on table public.rate_limits_operativos to authenticated;
grant select, insert on table public.intentos_bloqueados to authenticated;
grant select, insert, update on table public.idempotency_keys_operativas to authenticated;
grant select, insert on table public.control_assist_auditoria to authenticated;

drop policy if exists "rate_limits_admin_select" on public.rate_limits_operativos;
drop policy if exists "rate_limits_admin_insert" on public.rate_limits_operativos;
drop policy if exists "rate_limits_admin_update" on public.rate_limits_operativos;
drop policy if exists "intentos_bloqueados_admin_select" on public.intentos_bloqueados;
drop policy if exists "intentos_bloqueados_usuario_insert" on public.intentos_bloqueados;
drop policy if exists "idempotency_keys_usuario_select" on public.idempotency_keys_operativas;
drop policy if exists "idempotency_keys_usuario_insert" on public.idempotency_keys_operativas;
drop policy if exists "idempotency_keys_usuario_update" on public.idempotency_keys_operativas;
drop policy if exists "control_assist_auditoria_usuario_insert" on public.control_assist_auditoria;
drop policy if exists "control_assist_auditoria_admin_select" on public.control_assist_auditoria;
drop policy if exists "rate_limits_no_delete" on public.rate_limits_operativos;
drop policy if exists "intentos_bloqueados_no_delete" on public.intentos_bloqueados;
drop policy if exists "idempotency_keys_no_delete" on public.idempotency_keys_operativas;
drop policy if exists "control_assist_auditoria_no_delete" on public.control_assist_auditoria;

-- Admin activo: acceso de lectura y mantenimiento no destructivo.
create policy "rate_limits_admin_select"
on public.rate_limits_operativos
for select
to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo = true and lower(coalesce(p.rol, '')) = 'admin'));

create policy "rate_limits_admin_insert"
on public.rate_limits_operativos
for insert
to authenticated
with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo = true and lower(coalesce(p.rol, '')) = 'admin'));

create policy "rate_limits_admin_update"
on public.rate_limits_operativos
for update
to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo = true and lower(coalesce(p.rol, '')) = 'admin'))
with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo = true and lower(coalesce(p.rol, '')) = 'admin'));

create policy "intentos_bloqueados_admin_select"
on public.intentos_bloqueados
for select
to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo = true and lower(coalesce(p.rol, '')) = 'admin'));

create policy "intentos_bloqueados_usuario_insert"
on public.intentos_bloqueados
for insert
to authenticated
with check (
  intentos_bloqueados.usuario_id = auth.uid()
  and (
    intentos_bloqueados.empresa_id is null
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = auth.uid()
        and ue.empresa_id = intentos_bloqueados.empresa_id
        and ue.activo = true
    )
  )
);

create policy "idempotency_keys_usuario_select"
on public.idempotency_keys_operativas
for select
to authenticated
using (
  usuario_id = auth.uid()
  or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo = true and lower(coalesce(p.rol, '')) = 'admin')
);

create policy "idempotency_keys_usuario_insert"
on public.idempotency_keys_operativas
for insert
to authenticated
with check (
  idempotency_keys_operativas.usuario_id = auth.uid()
  and (
    idempotency_keys_operativas.empresa_id is null
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = auth.uid()
        and ue.empresa_id = idempotency_keys_operativas.empresa_id
        and ue.activo = true
    )
  )
);

create policy "idempotency_keys_usuario_update"
on public.idempotency_keys_operativas
for update
to authenticated
using (idempotency_keys_operativas.usuario_id = auth.uid())
with check (
  idempotency_keys_operativas.usuario_id = auth.uid()
  and (
    idempotency_keys_operativas.empresa_id is null
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = auth.uid()
        and ue.empresa_id = idempotency_keys_operativas.empresa_id
        and ue.activo = true
    )
  )
);

create policy "control_assist_auditoria_usuario_insert"
on public.control_assist_auditoria
for insert
to authenticated
with check (
  control_assist_auditoria.usuario_id = auth.uid()
  and (
    control_assist_auditoria.empresa_id is null
    or exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = auth.uid()
        and ue.empresa_id = control_assist_auditoria.empresa_id
        and ue.activo = true
    )
  )
);

create policy "control_assist_auditoria_admin_select"
on public.control_assist_auditoria
for select
to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo = true and lower(coalesce(p.rol, '')) = 'admin'));

-- Sin borrado fisico desde clientes autenticados.
create policy "rate_limits_no_delete"
on public.rate_limits_operativos
for delete
to authenticated
using (false);

create policy "intentos_bloqueados_no_delete"
on public.intentos_bloqueados
for delete
to authenticated
using (false);

create policy "idempotency_keys_no_delete"
on public.idempotency_keys_operativas
for delete
to authenticated
using (false);

create policy "control_assist_auditoria_no_delete"
on public.control_assist_auditoria
for delete
to authenticated
using (false);
