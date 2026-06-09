'use client';

import { useEffect, useState } from 'react';

type TemaSpendFlow = 'dark-modern' | 'light-classic';

const CLAVE_TEMA = 'spendflow-theme';
const TEMA_DEFAULT: TemaSpendFlow = 'dark-modern';

function esTemaValido(valor: string | null): valor is TemaSpendFlow {
  return valor === 'dark-modern' || valor === 'light-classic';
}

function aplicarTema(tema: TemaSpendFlow) {
  document.documentElement.dataset.theme = tema;
  document.documentElement.style.colorScheme = tema === 'dark-modern' ? 'dark' : 'light';
  window.localStorage.setItem(CLAVE_TEMA, tema);
}

export function SelectorTema({ compacto = false }: { compacto?: boolean }) {
  const [tema, setTema] = useState<TemaSpendFlow>(TEMA_DEFAULT);

  useEffect(() => {
    const guardado = window.localStorage.getItem(CLAVE_TEMA);
    const inicial = esTemaValido(guardado) ? guardado : TEMA_DEFAULT;
    setTema(inicial);
    aplicarTema(inicial);
  }, []);

  const alternarTema = () => {
    const siguiente = tema === 'dark-modern' ? 'light-classic' : 'dark-modern';
    setTema(siguiente);
    aplicarTema(siguiente);
  };

  const esOscuro = tema === 'dark-modern';
  return (
    <button
      type="button"
      onClick={alternarTema}
      className={`sf-theme-toggle ${compacto ? 'sf-theme-toggle-compact' : ''}`}
      aria-label={`Cambiar a tema ${esOscuro ? 'Claro clásico' : 'Moderno oscuro'}`}
      title={`Tema actual: ${esOscuro ? 'Moderno oscuro' : 'Claro clásico'}`}
    >
      <span className="sf-theme-toggle-icon" aria-hidden="true">{esOscuro ? '☾' : '☀'}</span>
      {!compacto ? <span><strong>{esOscuro ? 'Moderno oscuro' : 'Claro clásico'}</strong><small>Cambiar apariencia</small></span> : null}
    </button>
  );
}
