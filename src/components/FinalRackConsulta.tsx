import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileDown,
  Search,
  Cable,
  Eye,
  EyeOff,
  Zap,
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import {
  CompanyProject,
  RackUnit,
  RackDevice,
  DevicePort,
  PatchCable,
  CableColor,
  PortType
} from '../types';
import {
  CATEGORY_LABELS,
  CABLE_COLORS,
  getOrganizedDeviceZones
} from '../constants';

const PORT_TYPE_LABEL: Record<PortType, string> = {
  rj45: 'RJ45',
  sfp: 'SFP+ Fibra',
  pon: 'PON SC/APC',
  console: 'Consola Serial',
  usb: 'USB',
  fxs: 'FXS Voz RJ11',
  coax: 'Coaxial / RF',
  keystone: 'Keystone',
  power: 'IEC Energía'
};

interface FinalRackConsultaProps {
  project: CompanyProject;
  rack: RackUnit;
  onExportPDF: () => void;
}

interface CableGeometry {
  id: string;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colorHex: string;
  colorId: CableColor;
  vlan: string;
  category: string;
  lengthMeters: number;
  fromDeviceId: string;
  fromPortId: string;
  toDeviceId: string;
  toPortId: string;
}

interface HoveredConnectionDetails {
  cable: PatchCable;
  fromDevice: RackDevice;
  fromPort: DevicePort;
  toDevice: RackDevice;
  toPort: DevicePort;
}

interface HoveredFreePortDetails {
  device: RackDevice;
  port: DevicePort;
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

export const FinalRackConsulta: React.FC<FinalRackConsultaProps> = ({
  project,
  rack,
  onExportPDF
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter, setColorFilter] = useState<CableColor | 'all'>('all');
  const [showAllCables, setShowAllCables] = useState<boolean>(true);
  const [hoveredCableId, setHoveredCableId] = useState<string | null>(null);
  const [pinnedCableId, setPinnedCableId] = useState<string | null>(null);
  const [hoveredFreePort, setHoveredFreePort] =
    useState<HoveredFreePortDetails | null>(null);

  const rackContainerRef = useRef<HTMLDivElement | null>(null);
  const portRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [cableGeometries, setCableGeometries] = useState<CableGeometry[]>([]);

  const activeCableId = hoveredCableId || pinnedCableId;

  const getActiveConnectionDetails = (): HoveredConnectionDetails | null => {
    if (!activeCableId) return null;
    const cable = rack.cables.find((c) => c.id === activeCableId);
    if (!cable) return null;
    const fromDevice = rack.devices.find((d) => d.id === cable.fromDeviceId);
    const toDevice = rack.devices.find((d) => d.id === cable.toDeviceId);
    if (!fromDevice || !toDevice) return null;
    const fromPort = fromDevice.ports.find((p) => p.id === cable.fromPortId);
    const toPort = toDevice.ports.find((p) => p.id === cable.toPortId);
    if (!fromPort || !toPort) return null;
    return { cable, fromDevice, fromPort, toDevice, toPort };
  };

  const activeConnection = getActiveConnectionDetails();

  const recalculateCableCoordinates = useCallback(() => {
    if (!rackContainerRef.current) return;
    const containerRect = rackContainerRef.current.getBoundingClientRect();
    const list: CableGeometry[] = [];

    for (const cab of rack.cables) {
      if (colorFilter !== 'all' && cab.color !== colorFilter) continue;

      const elFrom = portRefs.current[cab.fromPortId];
      const elTo = portRefs.current[cab.toPortId];
      if (!elFrom || !elTo) continue;

      const r1 = elFrom.getBoundingClientRect();
      const r2 = elTo.getBoundingClientRect();

      list.push({
        id: cab.id,
        label: cab.label,
        x1: r1.left - containerRect.left + r1.width / 2,
        y1: r1.top - containerRect.top + r1.height / 2,
        x2: r2.left - containerRect.left + r2.width / 2,
        y2: r2.top - containerRect.top + r2.height / 2,
        colorHex: COLOR_HEX_MAP[cab.color] || '#3B82F6',
        colorId: cab.color,
        vlan: cab.vlan,
        category: cab.category,
        lengthMeters: cab.lengthMeters,
        fromDeviceId: cab.fromDeviceId,
        fromPortId: cab.fromPortId,
        toDeviceId: cab.toDeviceId,
        toPortId: cab.toPortId
      });
    }

    setCableGeometries(list);
  }, [rack.cables, colorFilter]);

  useEffect(() => {
    const timer = setTimeout(recalculateCableCoordinates, 50);
    window.addEventListener('resize', recalculateCableCoordinates);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', recalculateCableCoordinates);
    };
  }, [recalculateCableCoordinates, rack.devices]);

  const uSlotMap: Record<
    number,
    { type: 'start_top' | 'covered'; device: RackDevice }
  > = {};
  for (const dev of rack.devices) {
    const topU = dev.uStart + dev.uSize - 1;
    for (let u = dev.uStart; u <= topU; u++) {
      uSlotMap[u] = {
        type: u === topU ? 'start_top' : 'covered',
        device: dev
      };
    }
  }

  const getCableForPort = (portId: string) => {
    return rack.cables.find(
      (c) => c.fromPortId === portId || c.toPortId === portId
    );
  };

  const usedU = rack.devices.reduce((acc, d) => acc + d.uSize, 0);
  const totalWatts = rack.devices.reduce((acc, d) => acc + d.powerWatts, 0);

  // Filter cables for the right-side quick directory
  const filteredCables = rack.cables.filter((cab) => {
    if (colorFilter !== 'all' && cab.color !== colorFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const fromDev = rack.devices.find((d) => d.id === cab.fromDeviceId);
    const fromPort = fromDev?.ports.find((p) => p.id === cab.fromPortId);
    const toDev = rack.devices.find((d) => d.id === cab.toDeviceId);
    const toPort = toDev?.ports.find((p) => p.id === cab.toPortId);

    return (
      cab.label.toLowerCase().includes(q) ||
      cab.vlan.toLowerCase().includes(q) ||
      (fromDev?.name.toLowerCase().includes(q) ?? false) ||
      (toDev?.name.toLowerCase().includes(q) ?? false) ||
      (fromPort?.label.toLowerCase().includes(q) ?? false) ||
      (toPort?.label.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-5">
      {/* =================================================================== */}
      {/* TOP LIVE CONNECTION HUD BANNER (Updates Instantly on Port/Cable Hover) */}
      {/* =================================================================== */}
      <div className="sticky top-2 z-40 bg-[#111827]/95 backdrop-blur-md border border-slate-700 rounded-xl p-3.5 shadow-2xl min-h-[68px] flex items-center">
        <div className="w-full flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Connection Inspector HUD */}
          <div className="flex-1 min-w-0">
            {activeConnection ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <div
                  className="px-2.5 py-1 rounded-lg font-mono text-xs font-bold text-white flex items-center gap-1.5 shrink-0"
                  style={{
                    backgroundColor: COLOR_HEX_MAP[activeConnection.cable.color]
                  }}
                >
                  <Cable className="w-3.5 h-3.5" />
                  <span>{activeConnection.cable.label}</span>
                </div>

                {/* Endpoint A */}
                <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-blue-500/60 flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-blue-400 font-bold">
                    [U{activeConnection.fromDevice.uStart}]
                  </span>
                  <span className="font-mono text-xs font-bold text-white truncate max-w-[160px]">
                    {activeConnection.fromDevice.name}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono text-xs font-bold">
                    {activeConnection.fromPort.label} (#{activeConnection.fromPort.number})
                  </span>
                </div>

                <ArrowLeftRight className="w-4 h-4 text-emerald-400 shrink-0" />

                {/* Endpoint B */}
                <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-emerald-500/60 flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-emerald-400 font-bold">
                    [U{activeConnection.toDevice.uStart}]
                  </span>
                  <span className="font-mono text-xs font-bold text-white truncate max-w-[160px]">
                    {activeConnection.toDevice.name}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-mono text-xs font-bold">
                    {activeConnection.toPort.label} (#{activeConnection.toPort.number})
                  </span>
                </div>

                {/* Cable Technical Metadata */}
                <div className="text-xs font-mono text-slate-300 flex items-center gap-2 pl-1">
                  <span>{activeConnection.cable.category}</span>
                  <span>·</span>
                  <span className="text-amber-300">{activeConnection.cable.vlan}</span>
                  <span>·</span>
                  <span>{activeConnection.cable.lengthMeters}m</span>
                </div>
              </div>
            ) : hoveredFreePort ? (
              <div className="flex items-center gap-3 text-xs">
                <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">
                  PUERTO LIBRE
                </span>
                <span className="font-mono font-bold text-white">
                  [U{hoveredFreePort.device.uStart}] {hoveredFreePort.device.name}
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-mono text-blue-300">
                  Puerto {hoveredFreePort.port.label} (#{hoveredFreePort.port.number} · {hoveredFreePort.port.type.toUpperCase()})
                </span>
                <span className="text-slate-500">
                  — Sin latiguillo conectado actualmente
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-sm font-bold text-white">
                    Vista Final de Consulta Interactiva — {rack.name} ({rack.locationCode})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Pase el ratón por encima de cualquier <strong>puerto</strong> o <strong>cable</strong> para iluminar su recorrido e inspeccionar de dónde a dónde va conectado.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            {pinnedCableId && (
              <button
                type="button"
                onClick={() => setPinnedCableId(null)}
                className="px-3 py-1.5 rounded-lg bg-amber-950/80 border border-amber-600 text-amber-200 text-xs font-mono cursor-pointer whitespace-nowrap shrink-0"
              >
                Desfijar Cable Seleccionado
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAllCables(!showAllCables)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {showAllCables ? (
                <Eye className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>
                {showAllCables ? 'Todos los Cables Visibles' : 'Solo Cable bajo el Ratón'}
              </span>
            </button>
            <button
              type="button"
              onClick={onExportPDF}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MAIN CONSULTATION GRID: 8 COLS ELEVATION RACK + 4 COLS TRACE TABLE   */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: High-Visibility Rack Elevation Diagram */}
        <div className="xl:col-span-8">
          <div
            ref={rackContainerRef}
            className="relative bg-[#0B0F17] border-2 border-slate-800 rounded-xl p-4 shadow-2xl select-none"
          >
            {/* Rack Top Plate */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 mb-3 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-slate-300">
              <span>
                PLANO FINAL DE ARMARIADO · <strong>{project.companyName}</strong>
              </span>
              <span className="tabular-nums">
                Ocupación: {usedU}/{rack.totalU}U · {rack.devices.length} Equipos · {rack.cables.length} Latiguillos ·{' '}
                <Zap className="w-3.5 h-3.5 text-amber-400 inline" /> {totalWatts}W
              </span>
            </div>

            {/* Interactive SVG Patch Cables Layer */}
            <svg
              className="absolute inset-0 w-full h-full z-20 pointer-events-none"
              style={{ overflow: 'visible' }}
            >
              {cableGeometries.map((cab, idx) => {
                const isHighlighted = activeCableId === cab.id;
                const isDimmed = activeCableId !== null && !isHighlighted;

                if (!showAllCables && !isHighlighted) {
                  return null;
                }

                const dy = Math.abs(cab.y2 - cab.y1);
                const dx = Math.abs(cab.x2 - cab.x1);
                const sagOffset = Math.min(
                  80,
                  Math.max(26, dy * 0.25 + dx * 0.1 + (idx % 5) * 6)
                );
                const midY = Math.max(cab.y1, cab.y2) + sagOffset;
                const dPath = `M ${cab.x1} ${cab.y1} C ${cab.x1} ${midY}, ${cab.x2} ${midY}, ${cab.x2} ${cab.y2}`;

                return (
                  <g key={cab.id}>
                    {/* Invisible wider hit-area path so hovering directly on the cable is super easy */}
                    <path
                      d={dPath}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={12}
                      className="pointer-events-auto cursor-pointer"
                      onMouseEnter={() => {
                        setHoveredCableId(cab.id);
                        setHoveredFreePort(null);
                      }}
                      onMouseLeave={() => setHoveredCableId(null)}
                      onClick={() =>
                        setPinnedCableId(pinnedCableId === cab.id ? null : cab.id)
                      }
                    />
                    {/* Dark Casing */}
                    <path
                      d={dPath}
                      fill="none"
                      stroke="#090D16"
                      strokeWidth={isHighlighted ? 7 : 4.2}
                      strokeLinecap="round"
                      opacity={isDimmed ? 0.15 : 0.9}
                    />
                    {/* Colored Patch Cord */}
                    <path
                      d={dPath}
                      fill="none"
                      stroke={cab.colorHex}
                      strokeWidth={isHighlighted ? 4.2 : 2.3}
                      strokeLinecap="round"
                      opacity={isDimmed ? 0.18 : 1}
                    />
                    {/* Port Boots */}
                    <circle
                      cx={cab.x1}
                      cy={cab.y1}
                      r={isHighlighted ? 5.5 : 3.2}
                      fill={cab.colorHex}
                      stroke="#ffffff"
                      strokeWidth={isHighlighted ? 1.5 : 0.5}
                      opacity={isDimmed ? 0.2 : 1}
                    />
                    <circle
                      cx={cab.x2}
                      cy={cab.y2}
                      r={isHighlighted ? 5.5 : 3.2}
                      fill={cab.colorHex}
                      stroke="#ffffff"
                      strokeWidth={isHighlighted ? 1.5 : 0.5}
                      opacity={isDimmed ? 0.2 : 1}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Rack Units Loop */}
            <div className="divide-y divide-slate-800/70 border border-slate-800 rounded bg-[#090D16] overflow-hidden">
              {Array.from({ length: rack.totalU }, (_, i) => rack.totalU - i).map(
                (uNumber) => {
                  const slotInfo = uSlotMap[uNumber];

                  if (slotInfo && slotInfo.type === 'covered') {
                    return null;
                  }

                  if (slotInfo && slotInfo.type === 'start_top') {
                    const dev = slotInfo.device;
                    const zones = getOrganizedDeviceZones(dev);
                    const rowHeightPx = Math.max(
                      dev.uSize * 40,
                      zones.maxRows * 25 + 16
                    );

                    const shortBrand = dev.model
                      .split('/')[0]
                      .trim()
                      .split(' ')[0];

                    const isEndpointDevice =
                      activeConnection &&
                      (activeConnection.fromDevice.id === dev.id ||
                        activeConnection.toDevice.id === dev.id);

                    const defaultCategoryColor =
                      dev.category === 'firewall'
                        ? '#7F1D1D'
                        : dev.category === 'router'
                        ? '#312E81'
                        : dev.category === 'ont'
                        ? '#065F46'
                        : dev.category === 'patchpanel'
                        ? '#0F172A'
                        : dev.category === 'switch'
                        ? '#065F46'
                        : dev.category === 'pbx'
                        ? '#581C87'
                        : dev.category === 'nvr'
                        ? '#1E3A8A'
                        : dev.category === 'server'
                        ? '#1E293B'
                        : '#78350F';

                    const activeChassisColor =
                      dev.customColor || defaultCategoryColor;

                    const renderZoneBank = (
                      zoneRows: DevicePort[][],
                      zoneKey: 'left' | 'center' | 'right',
                      alignClass: string
                    ) => {
                      if (zoneRows.length === 0) return null;
                      return (
                        <div
                          className={`flex flex-col gap-1 justify-center ${alignClass} shrink-0`}
                        >
                          {zoneRows.map((rowPorts, rIndex) => (
                            <div
                              key={`consulta-zone-${dev.id}-${zoneKey}-${rIndex}`}
                              className="flex flex-nowrap items-center gap-[3px]"
                            >
                              {zoneRows.length > 1 && zoneKey === 'right' && (
                                <span className="text-[8px] font-mono text-slate-400 mr-0.5 shrink-0">
                                  F{rIndex + 1}
                                </span>
                              )}
                              {rowPorts.map((port) => {
                                const connCable = getCableForPort(port.id);
                                const isPortActive =
                                  activeConnection &&
                                  (activeConnection.fromPort.id === port.id ||
                                    activeConnection.toPort.id === port.id);
                                const portColorHex = connCable
                                  ? COLOR_HEX_MAP[connCable.color]
                                  : undefined;

                                const isDefaultLabel =
                                  /^(GE|P|PORT|eno|SFP\+|ETH|OUT|CAM|FXS|IEC)\d+$/i.test(
                                    port.label
                                  );
                                const customPortName = !isDefaultLabel
                                  ? port.label
                                  : null;

                                const typePassiveStyle =
                                  port.type === 'sfp'
                                    ? 'bg-slate-950 text-cyan-300 border-cyan-500/70 hover:border-cyan-300'
                                    : port.type === 'pon'
                                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/80 hover:border-emerald-300'
                                    : port.type === 'console'
                                    ? 'bg-sky-950/90 text-sky-300 border-sky-500/70 hover:border-sky-300'
                                    : port.type === 'usb'
                                    ? 'bg-purple-950/90 text-purple-300 border-purple-500/70 hover:border-purple-300'
                                    : port.type === 'fxs'
                                    ? 'bg-amber-950/90 text-amber-300 border-amber-500/70 hover:border-amber-300'
                                    : port.type === 'coax'
                                    ? 'bg-orange-950/90 text-orange-300 border-orange-500/70 hover:border-orange-300'
                                    : port.type === 'power'
                                    ? 'bg-rose-950/90 text-rose-300 border-rose-500/70 hover:border-rose-300'
                                    : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:text-white';

                                return (
                                  <button
                                    key={port.id}
                                    ref={(el) => {
                                      portRefs.current[port.id] = el;
                                    }}
                                    type="button"
                                    title={`Puerto #${port.number} (${port.label}) · ${
                                      PORT_TYPE_LABEL[port.type] || port.type
                                    }`}
                                    onMouseEnter={() => {
                                      if (connCable) {
                                        setHoveredCableId(connCable.id);
                                        setHoveredFreePort(null);
                                      } else {
                                        setHoveredCableId(null);
                                        setHoveredFreePort({
                                          device: dev,
                                          port
                                        });
                                      }
                                    }}
                                    onMouseLeave={() => {
                                      setHoveredCableId(null);
                                      setHoveredFreePort(null);
                                    }}
                                    onClick={() => {
                                      if (connCable) {
                                        setPinnedCableId(
                                          pinnedCableId === connCable.id
                                            ? null
                                            : connCable.id
                                        );
                                      }
                                    }}
                                    style={
                                      connCable
                                        ? {
                                            backgroundColor: portColorHex,
                                            borderColor: '#ffffff'
                                          }
                                        : undefined
                                    }
                                    className={`h-5 ${
                                      rowPorts.length > 16
                                        ? 'w-[16px] text-[7px]'
                                        : rowPorts.length > 12
                                        ? 'w-[18px] text-[8px]'
                                        : customPortName
                                        ? 'min-w-[20px] max-w-[44px] px-1 text-[8px]'
                                        : 'w-[21px] text-[8px]'
                                    } rounded-[3px] font-mono font-bold flex items-center justify-center border transition-colors cursor-pointer tabular-nums shrink-0 truncate ${
                                      isPortActive
                                        ? 'ring-2 ring-amber-300 z-40 shadow-lg text-white brightness-125'
                                        : connCable
                                        ? 'text-white hover:brightness-125'
                                        : typePassiveStyle
                                    }`}
                                  >
                                    {customPortName
                                      ? customPortName.substring(0, 5)
                                      : port.number.toString().padStart(2, '0')}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      );
                    };

                    return (
                      <div
                        key={`consulta-dev-${dev.id}`}
                        style={{
                          minHeight: `${rowHeightPx}px`,
                          background: `linear-gradient(90deg, ${activeChassisColor}E6 0%, #0F172A 55%, #0F172A 100%)`
                        }}
                        className={`relative flex items-stretch transition-colors ${
                          isEndpointDevice
                            ? 'ring-2 ring-inset ring-amber-400 z-10'
                            : ''
                        }`}
                      >
                        {/* Left Rail */}
                        <div className="w-10 shrink-0 bg-slate-950/90 border-r border-slate-800 flex flex-col items-center justify-center font-mono text-[11px] text-slate-400 tabular-nums">
                          <span>U{uNumber.toString().padStart(2, '0')}</span>
                          {dev.uSize > 1 && (
                            <span className="text-[9px] text-slate-600">
                              ..U{dev.uStart.toString().padStart(2, '0')}
                            </span>
                          )}
                        </div>

                        {/* Device Faceplate: Compact Brand + Device Type on Left, 3-Zone Ports (Left / Center / Right) */}
                        <div className="flex-1 px-2.5 py-1.5 flex items-center justify-between gap-2 min-w-0 overflow-hidden">
                          <div
                            className="flex items-center gap-1.5 shrink-0 w-[92px]"
                            title={`${dev.name} — ${dev.model} (${dev.ipAddress})`}
                          >
                            {dev.status === 'nominal' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                            <div className="min-w-0 leading-tight">
                              <div className="font-mono text-[11px] font-bold text-white truncate">
                                {shortBrand}
                              </div>
                              <div className="text-[8px] font-mono uppercase tracking-wider text-slate-300/90 truncate">
                                {CATEGORY_LABELS[dev.category]}
                              </div>
                            </div>
                          </div>

                          {/* 3-Zone Chassis Faceplate Layout */}
                          <div className="flex-1 flex items-center justify-between gap-3 z-30 min-w-0">
                            {/* Left Zone */}
                            <div className="flex items-center">
                              {renderZoneBank(
                                zones.leftRows,
                                'left',
                                'items-start'
                              )}
                            </div>

                            {/* Center Zone */}
                            {zones.centerRows.length > 0 && (
                              <div className="flex items-center px-2 border-x border-slate-800/70">
                                {renderZoneBank(
                                  zones.centerRows,
                                  'center',
                                  'items-center'
                                )}
                              </div>
                            )}

                            {/* Right Zone */}
                            <div className="flex items-center ml-auto">
                              {renderZoneBank(
                                zones.rightRows,
                                'right',
                                'items-end'
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Rail */}
                        <div className="w-9 shrink-0 bg-slate-950/90 border-l border-slate-800 flex items-center justify-center font-mono text-[10px] text-slate-500 tabular-nums">
                          U{uNumber.toString().padStart(2, '0')}
                        </div>
                      </div>
                    );
                  }

                  // Empty U Slot (Compact in consultation mode)
                  return (
                    <div
                      key={`consulta-empty-${uNumber}`}
                      className="h-[22px] flex items-center justify-between bg-[#090D16]/70"
                    >
                      <div className="w-11 h-full bg-slate-950/40 border-r border-slate-800/50 flex items-center justify-center font-mono text-[9px] text-slate-700 tabular-nums">
                        U{uNumber.toString().padStart(2, '0')}
                      </div>
                      <div className="flex-1 px-3 text-[9px] font-mono text-slate-800">
                        —
                      </div>
                      <div className="w-9 h-full bg-slate-950/40 border-l border-slate-800/50 flex items-center justify-center font-mono text-[9px] text-slate-700 tabular-nums">
                        U{uNumber.toString().padStart(2, '0')}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Interactive Directory of All Connections */}
        <div className="xl:col-span-4 space-y-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-white">
                Buscador Rápido de Conexiones
              </h3>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {filteredCables.length} de {rack.cables.length} cables
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar puerto, equipo, etiqueta o VLAN..."
                className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">Filtrar por color:</span>
              <select
                value={colorFilter}
                onChange={(e) =>
                  setColorFilter(e.target.value as CableColor | 'all')
                }
                className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200"
              >
                <option value="all">Todos los colores</option>
                {CABLE_COLORS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1 pt-1">
              {filteredCables.map((cab) => {
                const fromDev = rack.devices.find(
                  (d) => d.id === cab.fromDeviceId
                );
                const fromPort = fromDev?.ports.find(
                  (p) => p.id === cab.fromPortId
                );
                const toDev = rack.devices.find((d) => d.id === cab.toDeviceId);
                const toPort = toDev?.ports.find((p) => p.id === cab.toPortId);
                const isActive = activeCableId === cab.id;

                return (
                  <div
                    key={cab.id}
                    onMouseEnter={() => setHoveredCableId(cab.id)}
                    onMouseLeave={() => setHoveredCableId(null)}
                    onClick={() =>
                      setPinnedCableId(pinnedCableId === cab.id ? null : cab.id)
                    }
                    className={`p-3 rounded-lg border text-xs transition-all cursor-pointer ${
                      isActive
                        ? 'bg-slate-800 border-amber-400 shadow-lg'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: COLOR_HEX_MAP[cab.color] }}
                        />
                        <span className="font-mono font-bold text-white">
                          {cab.label}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-amber-300">
                        {cab.vlan}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-1 font-mono text-[11px]">
                      <div className="flex items-center justify-between bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80">
                        <span className="text-slate-300 truncate">
                          [U{fromDev?.uStart}] {fromDev?.name}
                        </span>
                        <span className="text-blue-400 font-bold shrink-0 ml-2">
                          {fromPort?.label} (#{fromPort?.number})
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80">
                        <span className="text-slate-300 truncate">
                          [U{toDev?.uStart}] {toDev?.name}
                        </span>
                        <span className="text-emerald-400 font-bold shrink-0 ml-2">
                          {toPort?.label} (#{toPort?.number})
                        </span>
                      </div>
                    </div>
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
