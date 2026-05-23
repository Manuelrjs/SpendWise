import { calcularPeriodoResumenYVencimiento } from '../utils/tarjetas.ts';

interface CasoPrueba {
  descripcion: string;
  fecha_gasto: string;
  dia_cierre_habitual: number;
  dias_hasta_vencimiento: number;
  esperado: {
    periodo_resumen: string;
    fecha_cierre: string;
    fecha_vencimiento: string;
    periodo_pago_estimado: string;
  };
}

const casos: CasoPrueba[] = [
  {
    descripcion: 'Caso 1',
    fecha_gasto: '2026-05-05',
    dia_cierre_habitual: 12,
    dias_hasta_vencimiento: 17,
    esperado: { periodo_resumen: '2026-05', fecha_cierre: '2026-05-12', fecha_vencimiento: '2026-05-29', periodo_pago_estimado: '2026-05' },
  },
  {
    descripcion: 'Caso 2',
    fecha_gasto: '2026-05-22',
    dia_cierre_habitual: 12,
    dias_hasta_vencimiento: 17,
    esperado: { periodo_resumen: '2026-06', fecha_cierre: '2026-06-12', fecha_vencimiento: '2026-06-29', periodo_pago_estimado: '2026-06' },
  },
  {
    descripcion: 'Caso 3',
    fecha_gasto: '2026-05-22',
    dia_cierre_habitual: 29,
    dias_hasta_vencimiento: 7,
    esperado: { periodo_resumen: '2026-05', fecha_cierre: '2026-05-29', fecha_vencimiento: '2026-06-05', periodo_pago_estimado: '2026-06' },
  },
  {
    descripcion: 'Caso 4',
    fecha_gasto: '2026-07-15',
    dia_cierre_habitual: 12,
    dias_hasta_vencimiento: 17,
    esperado: { periodo_resumen: '2026-08', fecha_cierre: '2026-08-12', fecha_vencimiento: '2026-08-29', periodo_pago_estimado: '2026-08' },
  },
];

let aprobados = 0;
for (const caso of casos) {
  const resultado = calcularPeriodoResumenYVencimiento(caso);
  const ok = JSON.stringify(resultado) === JSON.stringify(caso.esperado);
  if (ok) {
    console.log(`✅ ${caso.descripcion}`, resultado);
    aprobados += 1;
  } else {
    console.log(`❌ ${caso.descripcion}`);
    console.log('   Esperado:', caso.esperado);
    console.log('   Recibido:', resultado);
  }
}

console.log(`\nResultado final: ${aprobados}/${casos.length} casos aprobados.`);
if (aprobados !== casos.length) process.exitCode = 1;
