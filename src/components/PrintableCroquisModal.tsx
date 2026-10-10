import React, { useState } from 'react';
import {
  Printer,
  FileDown,
  X,
  Maximize2,
  Eye,
  EyeOff,
  Cable,
  ArrowRight
} from 'lucide-react';
import {
  CompanyProject,
  RackUnit,
  RackDevice,
  CableColor,
  PortType
} from '../types';
import {
  CATEGORY_LABELS,
  CABLE_COLORS,
  ensureDevicePortCoordinates
} from '../constants';
import {
  buildPortConnectionMap,
  exportRackToTechnicalPDF,
  CroquisPaperFormat
} from '../utils/pdfExport';

interface PrintableCroquisModalProps {
  project: CompanyProject;
  rack: RackUnit;
  onClose: () => void;
}

const COLOR_HEX_MAP: Record<CableColor, string> = {
  blue: '#2563EB',
  yellow: '#CA8A04',
  emerald: '#059669',
  red: '#DC2626',
  cyan: '#0891B2',
  purple: '#7C3AED',
  orange: '#EA580C',
  slate: '#475569'
};

const PORT_TYPE_SHORT: Record<PortType, string> = {
  rj45: 'RJ45',
  sfp: 'SFP+',
  pon: 'PON',
  console: 'CON',
  usb: 'USB',
  fxs: 'TEL',
  coax: 'COAX',
  keystone: 'KEY',
  power: 'IEC'
};

export const PrintableCroquisModal: React.FC<PrintableCroquisModalProps> = ({
  project,
  rack,
  onClose
}) => {
  // Auto-recommend DIN A3 Landscape when the rack has >= 5 devices or >= 36U or >= 48 total ports
  const totalPortCount = rack.devices.reduce((acc, d) => acc + d.ports.length, 0);
  const defaultRecommendedFormat: CroquisPaperFormat =
    rack.devices.length >= 5 || rack.totalU >= 36 || totalPortCount >= 48
      ? 'a3-landscape'
      : 'a4-landscape';

  const [paperFormat, setPaperFormat] = useState<CroquisPaperFormat>(
    defaultRecommendedFormat
  );
  const [showFreePorts, setShowFreePorts] = useState<boolean>(true);

  const portConnMap = buildPortConnectionMap(rack);
  const sortedDevices = [...rack.devices].sort((a, b) => {
    if (b.uStart !== a.uStart) return b.uStart - a.uStart;
    const order = { left: 0, full: 1, right: 2 };
    return order[a.shelfBay || 'full'] - order[b.shelfBay || 'full'];
  });
  const occupiedUSet = new Set<number>();
  rack.devices.forEach((d) => {
    for (let u = d.uStart; u < d.uStart + d.uSize; u++) {
      occupiedUSet.add(u);
    }
  });
  const usedU = occupiedUSet.size;
  const totalWatts = rack.devices.reduce((acc, d) => acc + d.powerWatts, 0);

  const uSlotMap: Record<
    number,
    { type: 'start_top' | 'covered'; devices: RackDevice[] }
  > = {};
  for (const dev of rack.devices) {
    const topU = dev.uStart + dev.uSize - 1;
    for (let u = dev.uStart; u <= topU; u++) {
      if (u === topU) {
        const existing = uSlotMap[u];
        const currentList =
          existing && existing.type === 'start_top' ? existing.devices : [];
        const sorted = [...currentList, dev].sort((a, b) => {
          const order = { left: 0, full: 1, right: 2 };
          return (
            order[a.shelfBay || 'full'] - order[b.shelfBay || 'full']
          );
        });
        uSlotMap[u] = {
          type: 'start_top',
          devices: sorted
        };
      } else if (!uSlotMap[u]) {
        uSlotMap[u] = {
          type: 'covered',
          devices: [dev]
        };
      }
    }
  }

  const handleBrowserPrint = () => {
    window.print();
  };

  const isA3 = paperFormat === 'a3-landscape';
  const isLandscape = paperFormat !== 'a4-portrait';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col overflow-y-auto print:static print:bg-white print:overflow-visible">
      {/* Dynamic @page CSS rule so the browser print dialog automatically sets A3 or A4 and orientation */}
      <style>
        {`
          @media print {
            @page {
              size: ${isA3 ? 'A3 landscape' : isLandscape ? 'A4 landscape' : 'A4 portrait'};
              margin: 7mm;
            }
            body {
              background: #ffffff !important;
              color: #0f172a !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      {/* =================================================================== */}
      {/* TOP CONTROL BAR (Hidden when printing on paper)                     */}
      {/* =================================================================== */}
      <div className="no-print sticky top-0 z-50 bg-[#0D1322] border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
              <span>Croquis de Conexionado Punto a Punto para Imprimir</span>
              <span className="px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 font-mono text-[11px]">
                Recomendado para este rack ({rack.totalU}U / {totalPortCount}p):{' '}
                {defaultRecommendedFormat === 'a3-landscape'
                  ? 'Hoja DIN A3 Apaisado'
                  : 'Hoja DIN A4 Apaisado'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Plano mural para colgar en la puerta del armario rack: muestra cada puerto físico y exactamente a qué equipo y puerto va conectado.
            </p>
          </div>
        </div>

        {/* Paper Size & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Paper Format Selector */}
          <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-700">
            {(
              [
                { id: 'a3-landscape', label: 'DIN A3 Apaisado (420×297mm)' },
                { id: 'a4-landscape', label: 'DIN A4 Apaisado (297×210mm)' },
                { id: 'a4-portrait', label: 'DIN A4 Vertical (210×297mm)' }
              ] as const
            ).map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setPaperFormat(fmt.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-colors cursor-pointer ${
                  paperFormat === fmt.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>

          {/* Toggle Free Ports */}
          <button
            type="button"
            onClick={() => setShowFreePorts(!showFreePorts)}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            {showFreePorts ? (
              <Eye className="w-3.5 h-3.5 text-blue-400" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>
              {showFreePorts
                ? 'Mostrando Todos los Puntos'
                : 'Solo Puntos Conectados'}
            </span>
          </button>

          {/* Direct Print Button */}
          <button
            type="button"
            onClick={handleBrowserPrint}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Croquis ({isA3 ? 'DIN A3' : 'DIN A4'})</span>
          </button>

          {/* Download Vector PDF */}
          <button
            type="button"
            onClick={() =>
              exportRackToTechnicalPDF(project, rack, paperFormat)
            }
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>Descargar PDF ({isA3 ? 'DIN A3' : 'DIN A4'})</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
            title="Cerrar vista de impresión"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* PRINTABLE CROQUIS SHEET (High-Contrast White Technical Blueprint)   */}
      {/* =================================================================== */}
      <div className="flex-1 p-6 print:p-0 flex justify-center">
        <div
          className={`bg-white text-slate-900 rounded-xl print:rounded-none shadow-2xl print:shadow-none border border-slate-300 print:border-0 p-6 print:p-2 w-full ${
            isA3
              ? 'max-w-[1680px]'
              : isLandscape
              ? 'max-w-[1240px]'
              : 'max-w-[920px]'
          } space-y-4`}
        >
          {/* Technical Title Block (Cajetín de Plano de Ingeniería) */}
          <div className="border-2 border-slate-900 rounded-lg p-3 flex flex-wrap items-center justify-between gap-4 bg-slate-50">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-slate-900 text-white font-mono text-[10px] font-bold uppercase tracking-wider rounded">
                  CROQUIS OFICIAL DE ARMARIADO Y PARCHEO
                </span>
                <span className="font-mono text-xs text-slate-600 font-bold">
                  FORMATO: {isA3 ? 'DIN A3 APAISADO' : isLandscape ? 'DIN A4 APAISADO' : 'DIN A4 VERTICAL'}
                </span>
              </div>
              <h1 className="font-display text-lg font-extrabold text-slate-950 mt-1">
                {project.companyName} — {rack.name} ({rack.locationCode})
              </h1>
              <p className="text-xs text-slate-600 font-mono">
                Proyecto: {project.projectName} · Dimensiones: {rack.totalU}U ({rack.widthMm || 600}×{rack.depthMm || 1000}mm) · Ubicación: {project.siteAddress}
              </p>
            </div>

            {/* Key Telemetry & Color Legend */}
            <div className="flex flex-col items-end gap-1.5 text-right">
              <div className="flex items-center gap-3 font-mono text-xs font-bold text-slate-900 bg-white px-3 py-1 rounded border border-slate-300">
                <span>Ocupación: {usedU}/{rack.totalU}U</span>
                <span>·</span>
                <span>Equipos: {rack.devices.length}</span>
                <span>·</span>
                <span>Puntos Totales: {totalPortCount}</span>
                <span>·</span>
                <span>Latiguillos Activos: {rack.cables.length}</span>
                <span>·</span>
                <span>Potencia: {totalWatts}W</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-700">
                <span className="font-bold">Código Colores Cableado:</span>
                {CABLE_COLORS.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block border border-slate-800"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span>{c.name.split(' ')[0]}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Main Blueprint Body: Left = Visual Elevation Diagram, Right = Point-by-Point Destination Map */}
          <div
            className={`grid gap-5 items-start ${
              isLandscape ? 'grid-cols-12' : 'grid-cols-1'
            }`}
          >
            {/* =============================================================== */}
            {/* LEFT COLUMN: ALZADO FÍSICO DEL RACK 19"                         */}
            {/* =============================================================== */}
            <div className={isLandscape ? 'col-span-4' : 'col-span-1'}>
              <div className="border-2 border-slate-900 rounded-lg overflow-hidden bg-white">
                <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between font-mono text-xs font-bold">
                  <span>1. ALZADO FÍSICO RACK 19&quot; ({rack.totalU}U · {rack.widthMm || 600}×{rack.depthMm || 1000}mm)</span>
                  <span>EIA-310-D</span>
                </div>

                <div className="divide-y divide-slate-300">
                  {Array.from(
                    { length: rack.totalU },
                    (_, i) =>
                      rack.uNumberingDirection === 'bottom-up'
                        ? i + 1
                        : rack.totalU - i
                  ).map((uNumber) => {
                    const slotInfo = uSlotMap[uNumber];
                    if (slotInfo && slotInfo.type === 'covered') {
                      return null;
                    }

                    if (slotInfo && slotInfo.type === 'start_top') {
                      const shelfDevices = slotInfo.devices;
                      const maxUSize = Math.max(
                        ...shelfDevices.map((d) => d.uSize)
                      );
                      const minUStart = Math.min(
                        ...shelfDevices.map((d) => d.uStart)
                      );

                      return (
                        <div
                          key={`croquis-rack-shelf-${uNumber}`}
                          style={{
                            minHeight: `${Math.max(34, maxUSize * 26)}px`
                          }}
                          className="flex items-stretch bg-slate-100 border-l-4 border-slate-900"
                        >
                          {/* U Rail */}
                          <div className="w-10 shrink-0 bg-slate-900 text-white font-mono text-[10px] font-bold flex flex-col items-center justify-center tabular-nums">
                            <span>U{uNumber.toString().padStart(2, '0')}</span>
                            {maxUSize > 1 && (
                              <span className="text-[8px] text-slate-300">
                                ..U{minUStart.toString().padStart(2, '0')}
                              </span>
                            )}
                          </div>

                          {/* 1 or 2 Side-by-Side Devices on the Same U Shelf */}
                          <div className="flex-1 flex items-stretch divide-x-2 divide-slate-300 min-w-0">
                            {shelfDevices.map((dev) => {
                              const positionedPorts =
                                ensureDevicePortCoordinates(dev);
                              const shortBrand = dev.model
                                .split('/')[0]
                                .trim()
                                .split(' ')[0];
                              const connectedCount = dev.ports.filter((p) =>
                                Boolean(portConnMap[p.id])
                              ).length;

                              return (
                                <div
                                  key={`croquis-shelf-cell-${dev.id}`}
                                  className="flex-1 p-1.5 flex flex-col justify-between gap-1 min-w-0"
                                >
                                  <div className="flex items-center justify-between gap-1 border-b border-slate-300 pb-0.5">
                                    <div className="truncate">
                                      <span
                                        className="inline-block w-2 h-2 rounded-full mr-1"
                                        style={{
                                          backgroundColor:
                                            dev.customColor || '#0F172A'
                                        }}
                                      />
                                      <span className="font-mono text-[10px] font-extrabold text-slate-900">
                                        {dev.name}
                                      </span>{' '}
                                      {dev.shelfBay &&
                                        dev.shelfBay !== 'full' && (
                                          <span className="px-1 rounded bg-slate-800 text-white font-mono text-[8px]">
                                            {dev.shelfBay === 'left'
                                              ? 'IZQ'
                                              : 'DER'}
                                          </span>
                                        )}{' '}
                                      <span className="font-mono text-[8px] text-slate-600">
                                        ({shortBrand})
                                      </span>
                                    </div>
                                    <span className="font-mono text-[8px] font-bold text-slate-700 shrink-0">
                                      {connectedCount}/{dev.ports.length}p
                                    </span>
                                  </div>

                                  {/* Graphical 2D Port Mini-Faceplate */}
                                  <div className="relative min-h-[26px] bg-white border border-slate-300 rounded px-1 py-0.5">
                                    {positionedPorts.map((p) => {
                                      const conn = portConnMap[p.id];
                                      const bgHex = conn
                                        ? COLOR_HEX_MAP[conn.color]
                                        : '#F1F5F9';
                                      return (
                                        <span
                                          key={`mini-pt-${p.id}`}
                                          style={{
                                            position: 'absolute',
                                            left: `${p.xPercent ?? 50}%`,
                                            top: `${p.yPercent ?? 50}%`,
                                            transform: 'translate(-50%, -50%)',
                                            backgroundColor: bgHex,
                                            color: conn ? '#FFFFFF' : '#475569',
                                            borderColor: conn
                                              ? '#0F172A'
                                              : '#CBD5E1'
                                          }}
                                          className="px-1 py-[1px] rounded-[2px] border font-mono text-[7px] font-bold leading-none tabular-nums"
                                        >
                                          {p.number.toString().padStart(2, '0')}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    // Empty U slot (very compact so the full 42U fits cleanly)
                    return (
                      <div
                        key={`croquis-empty-${uNumber}`}
                        className="h-[13px] flex items-center bg-white text-[8px] font-mono text-slate-400"
                      >
                        <div className="w-10 h-full bg-slate-100 border-r border-slate-300 flex items-center justify-center tabular-nums text-slate-500">
                          U{uNumber.toString().padStart(2, '0')}
                        </div>
                        <div className="px-2 text-slate-300">—</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* =============================================================== */}
            {/* RIGHT COLUMN: CROQUIS DETALLADO DE CADA PUNTO A DÓNDE VA        */}
            {/* =============================================================== */}
            <div
              className={`${
                isLandscape ? 'col-span-8' : 'col-span-1'
              } space-y-3`}
            >
              <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg flex items-center justify-between font-mono text-xs font-bold">
                <span>
                  2. CROQUIS DETALLADO PUNTO POR PUNTO (DE DÓNDE A DÓNDE VA CONECTADO CADA PUERTO)
                </span>
                <span>{rack.cables.length} CONEXIONES ACTIVAS</span>
              </div>

              {sortedDevices.map((dev) => {
                const visiblePorts = showFreePorts
                  ? dev.ports
                  : dev.ports.filter((p) => Boolean(portConnMap[p.id]));

                const connectedCount = dev.ports.filter((p) =>
                  Boolean(portConnMap[p.id])
                ).length;

                return (
                  <div
                    key={`croquis-detail-dev-${dev.id}`}
                    className="border-2 border-slate-900 rounded-lg overflow-hidden bg-white break-inside-avoid"
                  >
                    {/* Device Title Bar */}
                    <div
                      style={{
                        backgroundColor: dev.customColor || '#0F172A'
                      }}
                      className="px-3 py-1.5 text-white flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-xs font-extrabold">
                          U{dev.uStart.toString().padStart(2, '0')}
                          {dev.uSize > 1
                            ? `-U${(dev.uStart + dev.uSize - 1)
                                .toString()
                                .padStart(2, '0')}`
                            : ''}
                          {dev.shelfBay === 'left'
                            ? ' (Bandeja Izq.)'
                            : dev.shelfBay === 'right'
                            ? ' (Bandeja Der.)'
                            : ''}
                        </span>
                        <span className="font-display text-sm font-extrabold">
                          {dev.name}
                        </span>
                        <span className="font-mono text-xs text-white/85">
                          · {dev.model} ({CATEGORY_LABELS[dev.category]})
                        </span>
                      </div>
                      <div className="font-mono text-[11px] font-bold flex items-center gap-3">
                        <span>IP: {dev.ipAddress}</span>
                        <span>·</span>
                        <span>
                          Conectados: {connectedCount} / {dev.ports.length} puertos
                        </span>
                      </div>
                    </div>

                    {/* Grid of Every Port and Where It Connects */}
                    {visiblePorts.length === 0 ? (
                      <div className="p-2.5 text-xs font-mono text-slate-500">
                        Sin puertos conectados en este equipo (active «Mostrando Todos los Puntos» para ver puertos libres).
                      </div>
                    ) : (
                      <div
                        className={`p-2 grid gap-1.5 ${
                          isA3
                            ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6'
                            : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                        }`}
                      >
                        {visiblePorts.map((port) => {
                          const conn = portConnMap[port.id];
                          const zoneTag =
                            port.zone === 'left'
                              ? 'IZQ'
                              : port.zone === 'center'
                              ? 'CEN'
                              : 'DER';

                          if (conn) {
                            const badgeColor = COLOR_HEX_MAP[conn.color];
                            return (
                              <div
                                key={`croquis-cell-${port.id}`}
                                className="rounded border-2 border-slate-900 bg-slate-50 overflow-hidden flex flex-col justify-between"
                              >
                                {/* Port Origin Header */}
                                <div
                                  style={{ backgroundColor: badgeColor }}
                                  className="px-2 py-1 text-white flex items-center justify-between gap-1"
                                >
                                  <span className="font-mono text-[11px] font-extrabold truncate">
                                    #{port.number.toString().padStart(2, '0')} · {port.label}
                                  </span>
                                  <span className="px-1 rounded bg-black/30 font-mono text-[9px] font-bold shrink-0">
                                    {PORT_TYPE_SHORT[port.type] || port.type} · {zoneTag}
                                  </span>
                                </div>

                                {/* Destination Connection Body */}
                                <div className="p-1.5 space-y-0.5 text-[10px]">
                                  <div className="flex items-center gap-1 font-mono font-bold text-slate-900">
                                    <ArrowRight className="w-3 h-3 text-slate-700 shrink-0" />
                                    <span className="truncate">
                                      [U{conn.remoteDevice.uStart}] {conn.remoteDevice.name}
                                    </span>
                                  </div>
                                  <div className="font-mono text-slate-800 pl-4 font-bold">
                                    Puerto:{' '}
                                    <span className="underline">
                                      {conn.remotePort.label} (#
                                      {conn.remotePort.number
                                        .toString()
                                        .padStart(2, '0')}
                                      )
                                    </span>
                                  </div>
                                  <div className="font-mono text-[9px] text-slate-600 pl-4 flex items-center justify-between">
                                    <span>{conn.cableLabel}</span>
                                    <span>{conn.vlan}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // Unconnected / Free Port Box
                          return (
                            <div
                              key={`croquis-cell-${port.id}`}
                              className="rounded border border-slate-300 bg-white p-1.5 flex flex-col justify-between text-slate-400"
                            >
                              <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
                                <span className="font-mono text-[10px] font-bold text-slate-600">
                                  #{port.number.toString().padStart(2, '0')} · {port.label}
                                </span>
                                <span className="font-mono text-[8px] uppercase">
                                  {PORT_TYPE_SHORT[port.type]} · {zoneTag}
                                </span>
                              </div>
                              <div className="pt-1 font-mono text-[9px] text-slate-400">
                                LIBRE — Sin latiguillo
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
