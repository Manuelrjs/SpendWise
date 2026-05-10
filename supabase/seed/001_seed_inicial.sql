-- Seed inicial Fase 1 de ControlFlow.
-- Inserta catálogos base para comenzar a registrar gastos.

insert into personas (nombre, activo)
values
  ('Manuel', true),
  ('Paola', true),
  ('Suegra', true);

insert into categorias (nombre, activo, orden)
values
  ('Supermercado', true, 1),
  ('Combustible', true, 2),
  ('Farmacia', true, 3),
  ('Comida', true, 4),
  ('Educación', true, 5),
  ('Hogar', true, 6),
  ('Transporte', true, 7),
  ('Entretenimiento', true, 8),
  ('Servicios', true, 9),
  ('Salud', true, 10),
  ('Ropa', true, 11),
  ('Otros', true, 12);

insert into medios_pago (nombre, tipo, activo, orden)
values
  ('Efectivo', 'efectivo', true, 1),
  ('Débito', 'debito', true, 2),
  ('Transferencia', 'transferencia', true, 3),
  ('Tarjeta crédito', 'tarjeta_credito', true, 4),
  ('Mercado Pago', 'billetera_virtual', true, 5);

insert into cuentas_tarjeta (nombre_cuenta, marca, persona_titular_id, activo)
values
  (
    'Visa Galicia Manuel',
    'Visa',
    (select id from personas where nombre = 'Manuel' limit 1),
    true
  ),
  (
    'Visa Galicia Paola',
    'Visa',
    (select id from personas where nombre = 'Paola' limit 1),
    true
  );

insert into tarjetas_fisicas (cuenta_tarjeta_id, persona_id, tipo, alias, activo)
values
  (
    (select id from cuentas_tarjeta where nombre_cuenta = 'Visa Galicia Manuel' limit 1),
    (select id from personas where nombre = 'Manuel' limit 1),
    'titular',
    'Manuel titular',
    true
  ),
  (
    (select id from cuentas_tarjeta where nombre_cuenta = 'Visa Galicia Manuel' limit 1),
    (select id from personas where nombre = 'Paola' limit 1),
    'adicional',
    'Paola adicional',
    true
  ),
  (
    (select id from cuentas_tarjeta where nombre_cuenta = 'Visa Galicia Paola' limit 1),
    (select id from personas where nombre = 'Paola' limit 1),
    'titular',
    'Paola titular',
    true
  ),
  (
    (select id from cuentas_tarjeta where nombre_cuenta = 'Visa Galicia Paola' limit 1),
    (select id from personas where nombre = 'Suegra' limit 1),
    'adicional',
    'Suegra adicional',
    true
  );
