'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Opcion = { id: string; nombre: string };
type Gasto = { id:string; fecha_gasto:string; establecimiento:string; monto:number; moneda:string; categoria_id:string; medio_pago_id:string; persona_id:string; cuenta_tarjeta_id:string|null; tarjeta_fisica_id:string|null; estado_registro:'borrador'|'confirmado'|'anulado' };
type Persona = { id:string; nombre:string; apellido:string|null };
type Cuenta = { id:string; nombre_cuenta:string };
type Tarjeta = { id:string; alias:string|null; ultimos_4_digitos:string|null; persona_id:string; cuenta_tarjeta_id:string };
type Fila = { id:string; nombre:string; monto:number; cantidad:number; porcentaje:number };

const mesActual=()=>{const d=new Date();return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`};
const rango=(mes:string)=>{const [a,m]=mes.split('-').map(Number);return {desde:`${mes}-01`,hasta:new Date(Date.UTC(a,m,0)).toISOString().slice(0,10)}};
const money=(n:number,c='ARS')=>new Intl.NumberFormat('es-AR',{style:'currency',currency:c}).format(n);

export default function Page(){
  const [mes,setMes]=useState(mesActual()); const [categoriaId,setCategoriaId]=useState(''); const [medioId,setMedioId]=useState(''); const [personaId,setPersonaId]=useState(''); const [cuentaId,setCuentaId]=useState(''); const [tarjetaId,setTarjetaId]=useState(''); const [estado,setEstado]=useState('no_anulado');
  const [gastos,setGastos]=useState<Gasto[]>([]); const [categorias,setCategorias]=useState<Opcion[]>([]); const [medios,setMedios]=useState<Opcion[]>([]); const [personas,setPersonas]=useState<Persona[]>([]); const [cuentas,setCuentas]=useState<Cuenta[]>([]); const [tarjetas,setTarjetas]=useState<Tarjeta[]>([]);
  const [cargando,setCargando]=useState(true); const [error,setError]=useState<string|null>(null);

  useEffect(()=>{void cargar();},[mes]);
  async function cargar(){ setCargando(true); setError(null); const {desde,hasta}=rango(mes); const [g,c,m,p,ct,tf]=await Promise.all([
    supabase.from('gastos').select('id,fecha_gasto,establecimiento,monto,moneda,categoria_id,medio_pago_id,persona_id,cuenta_tarjeta_id,tarjeta_fisica_id,estado_registro').gte('fecha_gasto',desde).lte('fecha_gasto',hasta),
    supabase.from('categorias').select('id,nombre').order('nombre'), supabase.from('medios_pago').select('id,nombre').order('nombre'), supabase.from('personas').select('id,nombre,apellido').order('nombre'), supabase.from('cuentas_tarjeta').select('id,nombre_cuenta').order('nombre_cuenta'), supabase.from('tarjetas_fisicas').select('id,alias,ultimos_4_digitos,persona_id,cuenta_tarjeta_id').order('alias')
  ]); if(g.error||c.error||m.error||p.error||ct.error||tf.error){setError('No se pudieron cargar los reportes.');setCargando(false);return;} setGastos((g.data??[]) as Gasto[]); setCategorias((c.data??[]) as Opcion[]); setMedios((m.data??[]) as Opcion[]); setPersonas((p.data??[]) as Persona[]); setCuentas((ct.data??[]) as Cuenta[]); setTarjetas((tf.data??[]) as Tarjeta[]); setCargando(false);} 

  const nomCat=useMemo(()=>new Map(categorias.map(x=>[x.id,x.nombre])),[categorias]); const nomMed=useMemo(()=>new Map(medios.map(x=>[x.id,x.nombre])),[medios]); const nomPer=useMemo(()=>new Map(personas.map(x=>[x.id,`${x.nombre} ${x.apellido??''}`.trim()])),[personas]); const nomCue=useMemo(()=>new Map(cuentas.map(x=>[x.id,x.nombre_cuenta])),[cuentas]);
  const detalleTar=useMemo(()=>new Map(tarjetas.map(t=>[t.id,{nombre:`${t.alias??'Tarjeta sin alias'}${t.ultimos_4_digitos?` · ${t.ultimos_4_digitos}`:''}`,persona:nomPer.get(t.persona_id)??'Sin persona',cuenta:nomCue.get(t.cuenta_tarjeta_id)??'Sin cuenta'}])),[tarjetas,nomPer,nomCue]);

  const filtrados=useMemo(()=>gastos.filter(g=>!(categoriaId&&g.categoria_id!==categoriaId)&&!(medioId&&g.medio_pago_id!==medioId)&&!(personaId&&g.persona_id!==personaId)&&!(cuentaId&&g.cuenta_tarjeta_id!==cuentaId)&&!(tarjetaId&&g.tarjeta_fisica_id!==tarjetaId)&&!(estado==='no_anulado'&&g.estado_registro==='anulado')&&!(estado&&estado!=='no_anulado'&&g.estado_registro!==estado)),[gastos,categoriaId,medioId,personaId,cuentaId,tarjetaId,estado]);
  const total=filtrados.reduce((a,g)=>a+g.monto,0); const cantidad=filtrados.length; const promedio=cantidad?total/cantidad:0;
  const resumir=(mapa:Map<string,string>,get:(g:Gasto)=>string|null,pct=true):Fila[]=>{const acc=new Map<string,{n:string;m:number;c:number}>(); for(const g of filtrados){const id=get(g)??'sin'; const n=id==='sin'?'Sin asignar':(mapa.get(id)??'Sin asignar'); const p=acc.get(id); if(!p) acc.set(id,{n,m:g.monto,c:1}); else {p.m+=g.monto;p.c++;}} return Array.from(acc.entries()).map(([id,v])=>({id,nombre:v.n,monto:v.m,cantidad:v.c,porcentaje:pct&&total>0?v.m*100/total:0})).sort((a,b)=>b.monto-a.monto)};
  const porCategoria=resumir(nomCat,g=>g.categoria_id); const porMedio=resumir(nomMed,g=>g.medio_pago_id); const porPersona=resumir(nomPer,g=>g.persona_id); const porCuenta=resumir(nomCue,g=>g.cuenta_tarjeta_id,false);
  const porTarjeta=Array.from(filtrados.reduce((a,g)=>{const id=g.tarjeta_fisica_id??'sin'; const p=a.get(id)||{m:0,c:0}; p.m+=g.monto;p.c++; a.set(id,p); return a;},new Map<string,{m:number;c:number}>()).entries()).map(([id,v])=>({id,monto:v.m,cantidad:v.c,...(detalleTar.get(id)||{nombre:'Sin tarjeta física',persona:'Sin persona',cuenta:'Sin cuenta'})})).sort((a,b)=>b.monto-a.monto);
  const top=Array.from(filtrados.reduce((a,g)=>{const k=g.establecimiento.trim()||'Sin establecimiento';const p=a.get(k)||{m:0,c:0};p.m+=g.monto;p.c++;a.set(k,p);return a;},new Map<string,{m:number;c:number}>()).entries()).map(([id,v])=>({id,nombre:id,monto:v.m,cantidad:v.c,porcentaje:0})).sort((a,b)=>b.monto-a.monto).slice(0,10);

  return <section className='space-y-4'>
    <h1 className='text-2xl font-semibold'>Reportes mensuales</h1>
    <div className='grid grid-cols-1 gap-2 md:grid-cols-4'>
      <input type='month' value={mes} onChange={e=>setMes(e.target.value)} className='rounded-xl border px-3 py-2 text-sm'/>
      <Sel label='Categoría' value={categoriaId} onChange={setCategoriaId} opts={categorias}/><Sel label='Medio de pago' value={medioId} onChange={setMedioId} opts={medios}/><Sel label='Persona' value={personaId} onChange={setPersonaId} opts={personas.map(p=>({id:p.id,nombre:`${p.nombre} ${p.apellido??''}`.trim()}))}/>
      <Sel label='Cuenta de tarjeta' value={cuentaId} onChange={setCuentaId} opts={cuentas.map(c=>({id:c.id,nombre:c.nombre_cuenta}))}/><Sel label='Tarjeta física' value={tarjetaId} onChange={setTarjetaId} opts={tarjetas.map(t=>({id:t.id,nombre:`${t.alias??'Tarjeta sin alias'}${t.ultimos_4_digitos?` · ${t.ultimos_4_digitos}`:''}`}))}/>
      <Sel label='Estado del gasto' value={estado} onChange={setEstado} opts={[{id:'no_anulado',nombre:'Excluir anulados (por defecto)'},{id:'confirmado',nombre:'Confirmado'},{id:'borrador',nombre:'Borrador'},{id:'anulado',nombre:'Anulado'},{id:'',nombre:'Todos'}]}/>
    </div>
    {error&&<p>{error}</p>}{cargando&&<p>Cargando reportes...</p>}
    {!cargando&&filtrados.length===0&&<p className='rounded-xl border bg-white p-3 text-sm'>Todavía no hay gastos registrados para este mes.</p>}
    {!cargando&&filtrados.length>0&&<><div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-5'>{[['Gasto total',money(total)],['Cantidad de gastos',String(cantidad)],['Gasto promedio',money(promedio)],['Medio de pago más usado',porMedio[0]?.nombre??'Sin datos'],['Categoría principal',porCategoria[0]?.nombre??'Sin datos']].map(([t,v])=><article key={String(t)} className='rounded-2xl border bg-white p-3'><p className='text-sm text-slate-600'>{t}</p><p className='font-semibold'>{v}</p></article>)}</div>
    <div className='grid gap-3 xl:grid-cols-2'><Tabla titulo='Gastos por categoría' filas={porCategoria} pct/><Tabla titulo='Gastos por medio de pago' filas={porMedio} pct/><Tabla titulo='Gastos por persona' filas={porPersona} pct/><Tabla titulo='Gastos por cuenta de tarjeta' filas={porCuenta}/><article className='rounded-2xl border bg-white p-3 xl:col-span-2'><h3 className='font-semibold'>Gastos por tarjeta física</h3><div className='overflow-x-auto'><table className='min-w-full text-sm'><thead><tr><th>Tarjeta física</th><th>Persona asociada</th><th>Cuenta</th><th>Monto</th><th>Cantidad</th></tr></thead><tbody>{porTarjeta.map(f=><tr key={f.id} className='border-t'><td>{f.nombre}</td><td>{f.persona}</td><td>{f.cuenta}</td><td>{money(f.monto)}</td><td>{f.cantidad}</td></tr>)}</tbody></table></div></article><Tabla titulo='Top establecimientos' filas={top} full/></div></>}
  </section>;
}

function Sel({label,value,onChange,opts}:{label:string;value:string;onChange:(x:string)=>void;opts:Opcion[]}){return <select aria-label={label} value={value} onChange={e=>onChange(e.target.value)} className='rounded-xl border px-3 py-2 text-sm'><option value=''>{label}</option>{opts.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}</select>}
function Tabla({titulo,filas,pct=false,full=false}:{titulo:string;filas:Fila[];pct?:boolean;full?:boolean}){return <article className={`rounded-2xl border bg-white p-3 ${full?'xl:col-span-2':''}`}><h3 className='font-semibold'>{titulo}</h3><div className='overflow-x-auto'><table className='min-w-full text-sm'><thead><tr><th>Detalle</th><th>Monto</th>{pct&&<th>%</th>}<th>Cantidad</th></tr></thead><tbody>{filas.map(f=><tr key={f.id} className='border-t'><td>{f.nombre}</td><td>{money(f.monto)}</td>{pct&&<td>{f.porcentaje.toFixed(1)}%</td>}<td>{f.cantidad}</td></tr>)}</tbody></table></div></article>}
