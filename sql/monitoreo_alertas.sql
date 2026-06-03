-- Persistencia de alertas operativas para /monitoreo-sistema.
-- Ejecutar en Supabase SQL Editor despues de revisar.
-- Este script crea solo public.monitoreo_alertas y sus politicas.

create table if not exists public.monitoreo_alertas (
  id uuid primary key default gen_random_uuid(),
  alerta_clave text not null,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  empresa_id bigint null references public.empresas(id),
  usuario_id uuid null references public.perfiles(id),
  modulo text not null,
  accion text null,
  severidad text not null check (severidad in ('info', 'baja', 'media', 'alta', 'critica')),
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'En revisión', 'Resuelta', 'Archivada')),
  titulo text not null,
  mensaje text null,
  fuente text not null,
  entidad_tipo text null,
  entidad_id text null,
  ruta_destino text null,
  posible_causa text null,
  accion_recomendada text null,
  metadatos jsonb null,
  revisado_por uuid null references public.perfiles(id),
  revisado_at timestamptz null,
  resuelto_por uuid null references public.perfiles(id),
  resuelto_at timestamptz null,
  archivado_por uuid null references public.perfiles(id),
  archivado_at timestamptz null
);

create unique index if not exists monitoreo_alertas_alerta_clave_idx
  on public.monitoreo_alertas (alerta_clave);

create index if not exists monitoreo_alertas_empresa_id_idx
  on public.monitoreo_alertas (empresa_id);

create index if not exists monitoreo_alertas_modulo_idx
  on public.monitoreo_alertas (modulo);

create index if not exists monitoreo_alertas_estado_idx
  on public.monitoreo_alertas (estado);

create index if not exists monitoreo_alertas_severidad_idx
  on public.monitoreo_alertas (severidad);

create index if not exists monitoreo_alertas_fuente_idx
  on public.monitoreo_alertas (fuente);

create index if not exists monitoreo_alertas_creado_at_desc_idx
  on public.monitoreo_alertas (creado_at desc);

create index if not exists monitoreo_alertas_entidad_idx
  on public.monitoreo_alertas (entidad_tipo, entidad_id);

create or replace function public.monitoreo_alertas_set_actualizado_at()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_at = now();
  return new;
end;
$$;

drop trigger if exists monitoreo_alertas_actualizado_at_trg
  on public.monitoreo_alertas;

create trigger monitoreo_alertas_actualizado_at_trg
before update on public.monitoreo_alertas
for each row
execute function public.monitoreo_alertas_set_actualizado_at();

alter table public.monitoreo_alertas enable row level security;

revoke all on table public.monitoreo_alertas from anon;
revoke all on table public.monitoreo_alertas from public;
grant select, insert, update on table public.monitoreo_alertas to authenticated;

drop policy if exists "monitoreo_alertas_admin_select" on public.monitoreo_alertas;
drop policy if exists "monitoreo_alertas_admin_insert" on public.monitoreo_alertas;
drop policy if exists "monitoreo_alertas_admin_update" on public.monitoreo_alertas;
drop policy if exists "monitoreo_alertas_no_delete" on public.monitoreo_alertas;

create policy "monitoreo_alertas_admin_select"
on public.monitoreo_alertas
for select
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.activo = true
      and lower(coalesce(p.rol, '')) = 'admin'
  )
);

create policy "monitoreo_alertas_admin_insert"
on public.monitoreo_alertas
for insert
to authenticated
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.activo = true
      and lower(coalesce(p.rol, '')) = 'admin'
  )
);

create policy "monitoreo_alertas_admin_update"
on public.monitoreo_alertas
for update
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.activo = true
      and lower(coalesce(p.rol, '')) = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.activo = true
      and lower(coalesce(p.rol, '')) = 'admin'
  )
);

create policy "monitoreo_alertas_no_delete"
on public.monitoreo_alertas
for delete
to authenticated
using (false);
