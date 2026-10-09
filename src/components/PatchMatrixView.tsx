import React from 'react';
import { FileDown, Cable, Server, Shield, Router as RouterIcon, Network } from 'lucide-react';
import { CompanyProject, RackUnit, CableColor } from '../types';
import { CATEGORY_LABELS } from '../constants';

interface PatchMatrixViewProps {
  project: CompanyProject;
  rack: RackUnit;
  onExportPDF: () => void;
}

const COLOR_HEX_MAP: Record<CableColor, string> = {
  blue: '#3B82F6',
  yellow: '#EAB308',
  emerald: '#10B981',
  red: '#EF4444',
  cyan: '#06B6D4',
  purple: '#A855F7',
  orange: '#F97316',
  slate: '#94A3B8'
};

export const PatchMatrixView: React.FC<PatchMatrixViewProps> = ({
  project,
  rack,
  onExportPDF
}) => {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            Documentación Técnica de Parcheo y Plan de Rack
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {project.companyName} · {project.projectName} · Armario: <strong className="text-slate-200">{rack.name}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={onExportPDF}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <FileDown className="w-4 h-4" />
          <span>Descargar Diagrama y Matriz en PDF (A4)</span>
        </button>
      </div>

      {/* Section 1: Patch Panel & Cable Matrix Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cable className="w-4 h-4 text-blue-400" />
            <h3 className="font-display text-sm font-bold text-white">
              01. Matriz de Cableado Estructurado Punto a Punto
            </h3>
          </div>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {rack.cables.length} latiguillos activos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-mono text-slate-400">
                <th className="py-2.5 px-4">ID / ETIQUETA</th>
                <th className="py-2.5 px-4">EQUIPO ORIGEN</th>
                <th className="py-2.5 px-4">PUERTO A</th>
                <th className="py-2.5 px-4">EQUIPO DESTINO</th>
                <th className="py-2.5 px-4">PUERTO B</th>
                <th className="py-2.5 px-4">CATEGORÍA</th>
                <th className="py-2.5 px-4">VLAN / SERVICIO</th>
                <th className="py-2.5 px-4 text-right">LONGITUD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rack.cables.map((cab) => {
                const fromDev = rack.devices.find((d) => d.id === cab.fromDeviceId);
                const fromPort = fromDev?.ports.find((p) => p.id === cab.fromPortId);
                const toDev = rack.devices.find((d) => d.id === cab.toDeviceId);
                const toPort = toDev?.ports.find((p) => p.id === cab.toPortId);

                return (
                  <tr key={cab.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: COLOR_HEX_MAP[cab.color] }}
                        />
                        <span>{cab.label}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-200">
                      {fromDev ? `[U${fromDev.uStart}] ${fromDev.name}` : 'N/A'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-blue-300">
                      {fromPort?.label || 'N/A'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-200">
                      {toDev ? `[U${toDev.uStart}] ${toDev.name}` : 'N/A'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-emerald-300">
                      {toPort?.label || 'N/A'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-300">
                      {cab.category}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-300">
                      {cab.vlan}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-right text-slate-300 tabular-nums">
                      {cab.lengthMeters.toFixed(1)} m
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Rack Hardware Inventory Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <h3 className="font-display text-sm font-bold text-white">
              02. Inventario de Equipos Instalados por Unidad (U)
            </h3>
          </div>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {rack.devices.length} unidades montadas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-mono text-slate-400">
                <th className="py-2.5 px-4">POSICIÓN U</th>
                <th className="py-2.5 px-4">HOSTNAME</th>
                <th className="py-2.5 px-4">CATEGORÍA</th>
                <th className="py-2.5 px-4">MODELO DE CHASIS</th>
                <th className="py-2.5 px-4">DIRECCIÓN IP</th>
                <th className="py-2.5 px-4">NÚMERO DE SERIE</th>
                <th className="py-2.5 px-4 text-right">CONSUMO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {[...rack.devices]
                .sort((a, b) => b.uStart - a.uStart)
                .map((dev) => (
                  <tr key={dev.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-blue-400 tabular-nums">
                      U{dev.uStart}
                      {dev.uSize > 1 ? ` - U${dev.uStart + dev.uSize - 1}` : ''} ({dev.uSize}U)
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-white">
                      {dev.name}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">
                      <span className="inline-flex items-center gap-1.5">
                        {dev.category === 'firewall' && <Shield className="w-3.5 h-3.5 text-red-400" />}
                        {dev.category === 'router' && <RouterIcon className="w-3.5 h-3.5 text-indigo-400" />}
                        {dev.category === 'switch' && <Network className="w-3.5 h-3.5 text-emerald-400" />}
                        {dev.category === 'patchpanel' && <Cable className="w-3.5 h-3.5 text-blue-400" />}
                        {dev.category === 'server' && <Server className="w-3.5 h-3.5 text-purple-400" />}
                        <span>{CATEGORY_LABELS[dev.category]}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">{dev.model}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-200">
                      {dev.ipAddress}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">
                      {dev.serialNumber}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-right text-slate-200 tabular-nums">
                      {dev.powerWatts} W
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
