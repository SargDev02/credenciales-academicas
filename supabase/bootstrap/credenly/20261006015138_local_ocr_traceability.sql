alter table public.verificaciones_identidad
  add column if not exists proveedor_ocr varchar(40),
  add column if not exists texto_extraido text,
  add column if not exists motivo_revision text,
  add column if not exists documento_mime_type varchar(100),
  add column if not exists updated_at timestamptz not null default now();

alter table public.verificaciones_identidad
  add constraint verificaciones_identidad_proveedor_ocr_check
  check (
    proveedor_ocr is null
    or proveedor_ocr in ('TESSERACT_LOCAL', 'MOCK_DESARROLLO')
  );

create trigger trg_verificaciones_identidad_updated_at
before update on public.verificaciones_identidad
for each row execute function public.set_updated_at();
;
