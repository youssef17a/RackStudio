import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Shield,
  Router as RouterIcon,
  Network,
  Server as ServerIcon,
  Cable,
  Trash2,
  GripVertical,
  Plus,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  X,
  FileDown
} from 'lucide-react';
import {
  CompanyProject,
  RackUnit,
  RackDevice,
  HardwareTemplate,
  DeviceCategory,
  CableColor,
  CableCategory
} from '../types';
import {
  HARDWARE_CATALOG,
  CABLE_COLORS,
  CATEGORY_LABELS,
  createDeviceFromTemplate
} from '../constants';

interface RackWorkspaceProps {
  project: CompanyProject;
  rack: RackUnit;
  onUpdateRack: (updatedRack: RackUnit) => void;
  onExportPDF: () => void;
}

interface PendingPortSelection {
  deviceId: string;
  deviceName: string;
  portId: string;
  portLabel: string;
}

interface CableGeometry {
  id: string;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colorHex: string;
  vlan: string;
  category: string;
  fromDesc: string;
  toDesc: string;
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

export const RackWorkspace: React.FC<RackWorkspaceProps> = ({
  project,
  rack,
  onUpdateRack,
  onExportPDF
}) => {
  const [catalogFilter, setCatalogFilter] = useState<DeviceCategory | 'all'>('all');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    rack.devices[0]?.id || null
  );
  const [selectedCableId, setSelectedCableId] = useState<string | null>(null);
  const [showCablesOverlay, setShowCablesOverlay] = useState<boolean>(true);
  const [cableFilterColor, setCableFilterColor] = useState<CableColor | 'all'>('all');

  // Interactive Cable Patching Mode
  const [activeCableColor, setActiveCableColor] = useState<CableColor>('blue');
  const [activeCableCategory, setActiveCableCategory] = useState<CableCategory>('Cat6A');
  const [activeCableVlan, setActiveCableVlan] = useState<string>('VLAN 10 (LAN)');
  const [pendingPort, setPendingPort] = useState<PendingPortSelection | null>(null);

  // Drag & Drop State
  const [draggedTemplate, setDraggedTemplate] = useState<HardwareTemplate | null>(null);
  const [draggedDeviceId, setDraggedDeviceId] = useState<string | null>(null);
  const [hoverU, setHoverU] = useState<number | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Refs for SVG Cable Coordinates Calculation
  const rackContainerRef = useRef<HTMLDivElement | null>(null);
  const portRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [cableGeometries, setCableGeometries] = useState<CableGeometry[]>([]);

  const selectedDevice = rack.devices.find((d) => d.id === selectedDeviceId) || null;
  const selectedCable = rack.cables.find((c) => c.id === selectedCableId) || null;

  const showNotice = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Check if a target U range [uStart, uStart + uSize - 1] is available
  const isURangeAvailable = (
    uStart: number,
    uSize: number,
    ignoreDeviceId?: string | null
  ): boolean => {
    const uEnd = uStart + uSize - 1;
    if (uStart < 1 || uEnd > rack.totalU) return false;

    for (const dev of rack.devices) {
      if (ignoreDeviceId && dev.id === ignoreDeviceId) continue;
      const devEnd = dev.uStart + dev.uSize - 1;
      const overlaps = !(uEnd < dev.uStart || uStart > devEnd);
      if (overlaps) return false;
    }
    return true;
  };

  // Find first available U from top of rack downwards for quick-add button
  const findFirstAvailableUFromTop = (uSize: number): number | null => {
    for (let u = rack.totalU - uSize + 1; u >= 1; u--) {
      if (isURangeAvailable(u, uSize, null)) {
        return u;
      }
    }
    return null;
  };

  const handleInstallTemplateAtU = (template: HardwareTemplate, targetU: number) => {
    if (!isURangeAvailable(targetU, template.uSize, null)) {
      showNotice(
        `No hay espacio libre en U${targetU} (requiere ${template.uSize}U contiguos).`
      );
      return;
    }
    const sameCategoryCount =
      rack.devices.filter((d) => d.category === template.category).length + 1;
    const newDevice = createDeviceFromTemplate(template, targetU, sameCategoryCount);
    const updatedRack: RackUnit = {
      ...rack,
      devices: [...rack.devices, newDevice]
    };
    onUpdateRack(updatedRack);
    setSelectedDeviceId(newDevice.id);
    showNotice(`Instalado ${newDevice.name} en posición U${targetU}`);
  };

  const handleQuickAddTemplate = (template: HardwareTemplate) => {
    const targetU = findFirstAvailableUFromTop(template.uSize);
    if (targetU === null) {
      showNotice(`El rack no dispone de ${template.uSize}U libres contiguos.`);
      return;
    }
    handleInstallTemplateAtU(template, targetU);
  };

  const handleMoveDeviceToU = (deviceId: string, targetU: number) => {
    const dev = rack.devices.find((d) => d.id === deviceId);
    if (!dev) return;
    if (dev.uStart === targetU) return;

    if (!isURangeAvailable(targetU, dev.uSize, deviceId)) {
      showNotice(`Posición U${targetU} ocupada o fuera de rango para un chasis de ${dev.uSize}U.`);
      return;
    }

    const updatedDevices = rack.devices.map((d) =>
      d.id === deviceId ? { ...d, uStart: targetU } : d
    );
    onUpdateRack({
      ...rack,
      devices: updatedDevices
    });
    showNotice(`Reubicado ${dev.name} a U${targetU}`);
  };

  const handleDeleteDevice = (deviceId: string) => {
    const dev = rack.devices.find((d) => d.id === deviceId);
    const updatedDevices = rack.devices.filter((d) => d.id !== deviceId);
    const updatedCables = rack.cables.filter(
      (c) => c.fromDeviceId !== deviceId && c.toDeviceId !== deviceId
    );
    onUpdateRack({
      ...rack,
      devices: updatedDevices,
      cables: updatedCables
    });
    if (selectedDeviceId === deviceId) {
      setSelectedDeviceId(updatedDevices[0]?.id || null);
    }
    if (dev) {
      showNotice(`Desinstalado ${dev.name} y retirados sus latiguillos asociados.`);
    }
  };

  // Interactive Port Click -> Cable Connection
  const handlePortClick = (
    e: React.MouseEvent,
    device: RackDevice,
    portId: string,
    portLabel: string
  ) => {
    e.stopPropagation();
    setSelectedDeviceId(device.id);

    // Check if port already has a cable
    const existingCable = rack.cables.find(
      (c) =>
        (c.fromDeviceId === device.id && c.fromPortId === portId) ||
        (c.toDeviceId === device.id && c.toPortId === portId)
    );

    // If user is not currently patching and clicks a patched port, select that cable
    if (!pendingPort && existingCable) {
      setSelectedCableId(existingCable.id);
      return;
    }

    // If clicking the exact same pending port, cancel patching
    if (pendingPort && pendingPort.portId === portId) {
      setPendingPort(null);
      return;
    }

    // If port is already occupied when trying to patch, warn user
    if (existingCable) {
      setSelectedCableId(existingCable.id);
      showNotice(
        `El puerto ${device.name}:${portLabel} ya tiene conectado el latiguillo ${existingCable.label}.`
      );
      return;
    }

    // First click: start cable from this port
    if (!pendingPort) {
      setPendingPort({
        deviceId: device.id,
        deviceName: device.name,
        portId,
        portLabel
      });
      setSelectedCableId(null);
      return;
    }

    // Second click: complete patch cable between pendingPort and current port
    const cableNum = (rack.cables.length + 1).toString().padStart(3, '0');
    const uDistance = Math.abs(
      (rack.devices.find((d) => d.id === pendingPort.deviceId)?.uStart || 1) -
        device.uStart
    );
    const estimatedLength = Math.max(0.5, Number((0.5 + uDistance * 0.15).toFixed(1)));

    const newCable = {
      id: `cab-${Date.now()}`,
      label: `PATCH-${cableNum}`,
      fromDeviceId: pendingPort.deviceId,
      fromPortId: pendingPort.portId,
      toDeviceId: device.id,
      toPortId: portId,
      color: activeCableColor,
      category: activeCableCategory,
      vlan: activeCableVlan,
      lengthMeters: estimatedLength
    };

    onUpdateRack({
      ...rack,
      cables: [...rack.cables, newCable]
    });
    setPendingPort(null);
    setSelectedCableId(newCable.id);
    showNotice(
      `Latiguillo ${newCable.label} conectado: ${pendingPort.deviceName} (${pendingPort.portLabel}) → ${device.name} (${portLabel})`
    );
  };

  const handleDeleteCable = (cableId: string) => {
    const target = rack.cables.find((c) => c.id === cableId);
    onUpdateRack({
      ...rack,
      cables: rack.cables.filter((c) => c.id !== cableId)
    });
    if (selectedCableId === cableId) {
      setSelectedCableId(null);
    }
    if (target) {
      showNotice(`Latiguillo ${target.label} desconectado.`);
    }
  };

  // Recalculate SVG cable coordinates whenever devices, cables, or viewport size changes
  const recalculateCableCoordinates = useCallback(() => {
    if (!rackContainerRef.current) return;
    const containerRect = rackContainerRef.current.getBoundingClientRect();
    const list: CableGeometry[] = [];

    for (const cab of rack.cables) {
      if (cableFilterColor !== 'all' && cab.color !== cableFilterColor) continue;

      const elFrom = portRefs.current[cab.fromPortId];
      const elTo = portRefs.current[cab.toPortId];
      if (!elFrom || !elTo) continue;

      const r1 = elFrom.getBoundingClientRect();
      const r2 = elTo.getBoundingClientRect();

      const fromDev = rack.devices.find((d) => d.id === cab.fromDeviceId);
      const fromPort = fromDev?.ports.find((p) => p.id === cab.fromPortId);
      const toDev = rack.devices.find((d) => d.id === cab.toDeviceId);
      const toPort = toDev?.ports.find((p) => p.id === cab.toPortId);

      list.push({
        id: cab.id,
        label: cab.label,
        x1: r1.left - containerRect.left + r1.width / 2,
        y1: r1.top - containerRect.top + r1.height / 2,
        x2: r2.left - containerRect.left + r2.width / 2,
        y2: r2.top - containerRect.top + r2.height / 2,
        colorHex: COLOR_HEX_MAP[cab.color] || '#3B82F6',
        vlan: cab.vlan,
        category: cab.category,
        fromDesc: `${fromDev?.name || ''} : ${fromPort?.label || ''}`,
        toDesc: `${toDev?.name || ''} : ${toPort?.label || ''}`
      });
    }

    setCableGeometries(list);
  }, [rack.cables, rack.devices, cableFilterColor]);

  useEffect(() => {
    const timer = setTimeout(recalculateCableCoordinates, 40);
    window.addEventListener('resize', recalculateCableCoordinates);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', recalculateCableCoordinates);
    };
  }, [recalculateCableCoordinates]);

  // Build map of U slots -> mounted device
  const uSlotMap: Record<number, { type: 'start_top' | 'covered'; device: RackDevice }> = {};
  for (const dev of rack.devices) {
    const topU = dev.uStart + dev.uSize - 1;
    for (let u = dev.uStart; u <= topU; u++) {
      uSlotMap[u] = {
        type: u === topU ? 'start_top' : 'covered',
        device: dev
      };
    }
  }

  // Helper to get connected cable for a specific port
  const getCableForPort = (portId: string) => {
    return rack.cables.find(
      (c) => c.fromPortId === portId || c.toPortId === portId
    );
  };

  const filteredCatalog =
    catalogFilter === 'all'
      ? HARDWARE_CATALOG
      : HARDWARE_CATALOG.filter((t) => t.category === catalogFilter);

  const usedU = rack.devices.reduce((acc, d) => acc + d.uSize, 0);
  const totalWatts = rack.devices.reduce((acc, d) => acc + d.powerWatts, 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 p-6 max-w-[1600px] mx-auto items-start">
      {/* =================================================================== */}
      {/* LEFT PANEL (3 COLS): HARDWARE CATALOG (DRAG & DROP) + CABLE STUDIO  */}
      {/* =================================================================== */}
      <div className="xl:col-span-3 space-y-5">
        {/* Hardware Catalog Card */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-display text-sm font-bold text-white">
                Catálogo de Equipos 19&quot;
              </h2>
              <p className="text-xs text-slate-400">
                Arrastre al armario o pulse + para montar
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              {filteredCatalog.length} modelos
            </span>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap gap-1 p-1 bg-slate-900 rounded-lg mb-3 border border-slate-800/80">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'firewall', label: 'FW' },
                { id: 'router', label: 'Router' },
                { id: 'patchpanel', label: 'Patch' },
                { id: 'switch', label: 'Switch' },
                { id: 'server', label: 'Server' }
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCatalogFilter(tab.id)}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  catalogFilter === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Draggable Hardware Items */}
          <div className="space-y-2 max-h-[430px] overflow-y-auto pr-1">
            {filteredCatalog.map((tpl) => (
              <div
                key={tpl.id}
                draggable
                onDragStart={(e) => {
                  setDraggedTemplate(tpl);
                  setDraggedDeviceId(null);
                  e.dataTransfer.setData('text/plain', tpl.id);
                }}
                onDragEnd={() => {
                  setDraggedTemplate(null);
                  setHoverU(null);
                }}
                className="group p-3 rounded-lg bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 transition-colors cursor-grab active:cursor-grabbing flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                    <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{tpl.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 pl-5 mt-0.5 truncate">
                    {tpl.brand} {tpl.model} · <span className="font-mono text-slate-300">{tpl.uSize}U</span> ·{' '}
                    <span className="font-mono text-slate-300">
                      {tpl.defaultPorts + (tpl.sfpUplinks || 0)}p
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickAddTemplate(tpl)}
                  title="Montar en la primera unidad U libre"
                  className="p-1.5 rounded-md bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Patch Cable Tool Panel */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
              <Cable className="w-4 h-4 text-blue-400" />
              <span>Tendido de Latiguillos (Patching)</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowCablesOverlay(!showCablesOverlay)}
              className="px-2 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              {showCablesOverlay ? <Eye className="w-3 h-3 text-blue-400" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
              <span>{showCablesOverlay ? 'Ocultar Cables' : 'Ver Cables'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Haga clic en cualquier puerto libre de un <strong>Patch Panel</strong>, <strong>Switch</strong>, <strong>Router</strong>, <strong>Firewall</strong> o <strong>Servidor</strong> y luego en el puerto destino para tirar el cable.
          </p>

          {/* Cable Color Picker */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Color del Cable (Código TIA-606)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {CABLE_COLORS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setActiveCableColor(col.id)}
                    className={`px-2 py-1.5 rounded text-[11px] font-medium border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      activeCableColor === col.id
                        ? 'border-white bg-slate-800 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: col.hex }}
                    />
                    <span className="truncate">{col.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Categoría Medio
                </label>
                <select
                  value={activeCableCategory}
                  onChange={(e) => setActiveCableCategory(e.target.value as CableCategory)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Cat6A">Cat6A RJ45</option>
                  <option value="Cat6">Cat6 UTP</option>
                  <option value="Fibra OM4">Fibra OM4 LC</option>
                  <option value="DAC 10G">DAC SFP+ 10G</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  VLAN / Etiqueta Red
                </label>
                <input
                  type="text"
                  value={activeCableVlan}
                  onChange={(e) => setActiveCableVlan(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Filter visible cables by color */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Filtrar vista por color:</span>
              <select
                value={cableFilterColor}
                onChange={(e) => setCableFilterColor(e.target.value as CableColor | 'all')}
                className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200"
              >
                <option value="all">Todos los colores ({rack.cables.length})</option>
                {CABLE_COLORS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* CENTER PANEL (6 COLS): INTERACTIVE 42U 19" RACK + SVG PATCH CABLES  */}
      {/* =================================================================== */}
      <div className="xl:col-span-6 space-y-4">
        {/* Rack Telemetry & Quick Action Strip */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold text-white">
                {rack.name}
              </h2>
              <span className="text-xs font-mono text-slate-400">
                · {rack.locationCode}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 tabular-nums">
              <span>
                Ocupación: <strong className="text-slate-200 font-mono">{usedU}U / {rack.totalU}U</strong>
              </span>
              <span>·</span>
              <span>
                Equipos: <strong className="text-slate-200 font-mono">{rack.devices.length}</strong>
              </span>
              <span>·</span>
              <span>
                Latiguillos: <strong className="text-slate-200 font-mono">{rack.cables.length}</strong>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <strong className="text-slate-200 font-mono">{totalWatts}W / {rack.maxPowerWatts}W</strong>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onExportPDF}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileDown className="w-4 h-4" />
            <span>Exportar Plano PDF</span>
          </button>
        </div>

        {/* Active Patching Assistant Banner */}
        {pendingPort && (
          <div className="p-3 rounded-xl bg-blue-950/90 border border-blue-500/80 flex items-center justify-between gap-3">
            <div className="text-xs text-blue-100 flex items-center gap-2">
              <Cable className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                Origen seleccionado:{' '}
                <strong className="font-mono text-white">
                  {pendingPort.deviceName} [{pendingPort.portLabel}]
                </strong>
                . Pulse ahora sobre el puerto de destino en otro equipo o Patch Panel.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPendingPort(null)}
              className="px-2.5 py-1 rounded bg-blue-900 hover:bg-blue-800 text-xs text-blue-100 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancelar</span>
            </button>
          </div>
        )}

        {/* Operation Feedback Banner */}
        {feedbackBanner && !pendingPort && (
          <div className="p-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 flex items-center justify-between">
            <span>{feedbackBanner}</span>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 19-Inch Physical Rack Chassis Container */}
        <div
          ref={rackContainerRef}
          className="relative bg-[#0B0F17] border-2 border-slate-800 rounded-xl p-3 shadow-2xl select-none"
        >
          {/* Top Rack Bezel Plate */}
          <div className="flex items-center justify-between px-4 py-1.5 mb-2 bg-slate-900/90 border border-slate-800 rounded text-[11px] font-mono text-slate-400">
            <span>CHASSIS EIA-310-D · 19&quot; STANDARD RACK</span>
            <span>{project.companyName.toUpperCase()}</span>
            <span>{rack.totalU} UNIDADES (U)</span>
          </div>

          {/* SVG Patch Cables Overlay */}
          {showCablesOverlay && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-20"
              style={{ overflow: 'visible' }}
            >
              {cableGeometries.map((cab, idx) => {
                const isSelected =
                  selectedCableId === cab.id ||
                  (selectedDeviceId &&
                    rack.cables.find(
                      (c) =>
                        c.id === cab.id &&
                        (c.fromDeviceId === selectedDeviceId ||
                          c.toDeviceId === selectedDeviceId)
                    ));

                const dy = Math.abs(cab.y2 - cab.y1);
                const dx = Math.abs(cab.x2 - cab.x1);
                // Natural catenary curve sag or side-channel routing
                const sagOffset = Math.min(75, Math.max(24, dy * 0.25 + dx * 0.1 + (idx % 5) * 6));
                const midY = Math.max(cab.y1, cab.y2) + sagOffset;
                const dPath = `M ${cab.x1} ${cab.y1} C ${cab.x1} ${midY}, ${cab.x2} ${midY}, ${cab.x2} ${cab.y2}`;

                return (
                  <g key={cab.id}>
                    {/* Outer dark casing shadow for cable contrast */}
                    <path
                      d={dPath}
                      fill="none"
                      stroke="#090D16"
                      strokeWidth={isSelected ? 5.5 : 4}
                      strokeLinecap="round"
                      opacity={0.85}
                    />
                    {/* Colored Patch Cord */}
                    <path
                      d={dPath}
                      fill="none"
                      stroke={cab.colorHex}
                      strokeWidth={isSelected ? 3.2 : 2.1}
                      strokeLinecap="round"
                      opacity={isSelected ? 1 : 0.85}
                    />
                    {/* Connector Boots */}
                    <circle
                      cx={cab.x1}
                      cy={cab.y1}
                      r={isSelected ? 4 : 3}
                      fill={cab.colorHex}
                      stroke="#090D16"
                      strokeWidth={1}
                    />
                    <circle
                      cx={cab.x2}
                      cy={cab.y2}
                      r={isSelected ? 4 : 3}
                      fill={cab.colorHex}
                      stroke="#090D16"
                      strokeWidth={1}
                    />
                  </g>
                );
              })}
            </svg>
          )}

          {/* Rack U Slots Loop (Top U down to U1) */}
          <div className="divide-y divide-slate-800/70 border border-slate-800 rounded bg-[#090D16]">
            {Array.from({ length: rack.totalU }, (_, i) => rack.totalU - i).map((uNumber) => {
              const slotInfo = uSlotMap[uNumber];

              // If this U is covered by a multi-U device that started above it, skip rendering a separate row
              if (slotInfo && slotInfo.type === 'covered') {
                return null;
              }

              // If a device's top U is at uNumber, render the complete device faceplate spanning dev.uSize
              if (slotInfo && slotInfo.type === 'start_top') {
                const dev = slotInfo.device;
                const isSelected = selectedDeviceId === dev.id;
                const rowHeightPx = dev.uSize * 38;

                const categoryBg =
                  dev.category === 'firewall'
                    ? 'bg-gradient-to-r from-red-950/90 via-slate-900 to-slate-900 border-red-800/60'
                    : dev.category === 'router'
                    ? 'bg-gradient-to-r from-indigo-950/90 via-slate-900 to-slate-900 border-indigo-800/60'
                    : dev.category === 'patchpanel'
                    ? 'bg-[#0F1623] border-slate-700/80'
                    : dev.category === 'switch'
                    ? 'bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-emerald-800/60'
                    : dev.category === 'server'
                    ? 'bg-gradient-to-r from-slate-900 via-slate-800/90 to-slate-900 border-slate-600/70'
                    : 'bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-900 border-amber-800/60';

                return (
                  <div
                    key={`u-dev-${dev.id}`}
                    draggable
                    onDragStart={(e) => {
                      setDraggedDeviceId(dev.id);
                      setDraggedTemplate(null);
                      e.dataTransfer.setData('text/plain', dev.id);
                    }}
                    onDragEnd={() => {
                      setDraggedDeviceId(null);
                      setHoverU(null);
                    }}
                    onClick={() => {
                      setSelectedDeviceId(dev.id);
                      setSelectedCableId(null);
                    }}
                    style={{ minHeight: `${rowHeightPx}px` }}
                    className={`relative flex items-stretch transition-all cursor-pointer ${categoryBg} ${
                      isSelected
                        ? 'ring-2 ring-blue-500 z-10'
                        : 'hover:brightness-110'
                    }`}
                  >
                    {/* Left Rack Rail with cage-nut holes & U number */}
                    <div className="w-10 shrink-0 bg-slate-950/90 border-r border-slate-800 flex flex-col items-center justify-center font-mono text-[10px] text-slate-400 tabular-nums">
                      <span>{uNumber.toString().padStart(2, '0')}</span>
                      {dev.uSize > 1 && (
                        <span className="text-[9px] text-slate-600">
                          ..{dev.uStart.toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>

                    {/* Device Chassis Faceplate */}
                    <div className="flex-1 px-3 py-1.5 flex flex-col md:flex-row md:items-center justify-between gap-2 min-w-0">
                      {/* Left Identity Info */}
                      <div className="flex items-center gap-2 min-w-0 shrink-0">
                        <GripVertical className="w-3.5 h-3.5 text-slate-500 cursor-grab shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-white truncate max-w-[165px]">
                              {dev.name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                              {dev.ipAddress}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {dev.model} · {CATEGORY_LABELS[dev.category]} ({dev.uSize}U)
                          </div>
                        </div>
                      </div>

                      {/* Right Physical Port Matrix (Patch Panel / Switch / Firewall / Router / Server Ports) */}
                      <div className="flex flex-wrap items-center gap-1 justify-end z-30">
                        {dev.ports.map((port) => {
                          const connCable = getCableForPort(port.id);
                          const isPending = pendingPort?.portId === port.id;
                          const portColorHex = connCable
                            ? COLOR_HEX_MAP[connCable.color]
                            : undefined;

                          return (
                            <button
                              key={port.id}
                              ref={(el) => {
                                portRefs.current[port.id] = el;
                              }}
                              type="button"
                              onClick={(e) => handlePortClick(e, dev, port.id, port.label)}
                              title={`${dev.name} — Puerto ${port.label} (${port.type.toUpperCase()})${
                                connCable ? ` · Conectado: ${connCable.label} (${connCable.vlan})` : ' · Libre (Clic para parchear)'
                              }`}
                              style={
                                connCable
                                  ? {
                                      backgroundColor: portColorHex,
                                      borderColor: '#ffffff'
                                    }
                                  : undefined
                              }
                              className={`h-5 min-w-[20px] px-1 rounded-[3px] font-mono text-[9px] font-bold flex items-center justify-center border transition-transform cursor-pointer tabular-nums ${
                                isPending
                                  ? 'bg-amber-500 text-slate-950 border-white scale-125 ring-2 ring-amber-300'
                                  : connCable
                                  ? 'text-white shadow-sm hover:scale-110'
                                  : port.type === 'sfp'
                                  ? 'bg-slate-950 text-cyan-300 border-cyan-800/80 hover:border-cyan-400 hover:scale-110'
                                  : port.type === 'keystone'
                                  ? 'bg-slate-950 text-slate-300 border-slate-700 hover:border-blue-400 hover:scale-110'
                                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-blue-400 hover:scale-110'
                              }`}
                            >
                              {port.number.toString().padStart(2, '0')}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Rack Rail */}
                    <div className="w-8 shrink-0 bg-slate-950/90 border-l border-slate-800 flex items-center justify-center font-mono text-[10px] text-slate-500 tabular-nums">
                      {uNumber.toString().padStart(2, '0')}
                    </div>
                  </div>
                );
              }

              // Empty U Slot (Supports DragOver and Drop)
              const isHovered = hoverU === uNumber;
              return (
                <div
                  key={`u-empty-${uNumber}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (hoverU !== uNumber) setHoverU(uNumber);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setHoverU(null);
                    if (draggedTemplate) {
                      handleInstallTemplateAtU(draggedTemplate, uNumber);
                    } else if (draggedDeviceId) {
                      handleMoveDeviceToU(draggedDeviceId, uNumber);
                    }
                  }}
                  className={`h-[30px] flex items-center justify-between transition-colors ${
                    isHovered
                      ? 'bg-blue-950/60 border-y border-blue-500'
                      : 'bg-[#090D16] hover:bg-slate-900/50'
                  }`}
                >
                  {/* Left Rail */}
                  <div className="w-10 h-full bg-slate-950/60 border-r border-slate-800/80 flex items-center justify-center font-mono text-[10px] text-slate-600 tabular-nums">
                    {uNumber.toString().padStart(2, '0')}
                  </div>

                  {/* Empty Slot Center */}
                  <div className="flex-1 px-3 flex items-center justify-between text-[10px] font-mono text-slate-700">
                    <span>
                      {isHovered
                        ? `Soltar aquí para montar en U${uNumber}`
                        : 'Bahía 19" Libre'}
                    </span>
                    <span className="hidden sm:inline">U{uNumber}</span>
                  </div>

                  {/* Right Rail */}
                  <div className="w-8 h-full bg-slate-950/60 border-l border-slate-800/80 flex items-center justify-center font-mono text-[10px] text-slate-600 tabular-nums">
                    {uNumber.toString().padStart(2, '0')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* RIGHT PANEL (3 COLS): DEVICE INSPECTOR & PATCH SCHEDULE MATRIX      */}
      {/* =================================================================== */}
      <div className="xl:col-span-3 space-y-5">
        {/* Selected Device Inspector */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
              {selectedDevice?.category === 'firewall' && <Shield className="w-4 h-4 text-red-400" />}
              {selectedDevice?.category === 'router' && <RouterIcon className="w-4 h-4 text-indigo-400" />}
              {selectedDevice?.category === 'switch' && <Network className="w-4 h-4 text-emerald-400" />}
              {selectedDevice?.category === 'patchpanel' && <Cable className="w-4 h-4 text-blue-400" />}
              {selectedDevice?.category === 'server' && <ServerIcon className="w-4 h-4 text-purple-400" />}
              <span>Inspector de Equipo</span>
            </h3>
            {selectedDevice && (
              <button
                type="button"
                onClick={() => handleDeleteDevice(selectedDevice.id)}
                className="px-2 py-1 rounded bg-red-950/70 hover:bg-red-900 text-red-200 text-[11px] flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3 h-3" />
                <span>Desmontar</span>
              </button>
            )}
          </div>

          {selectedDevice ? (
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Hostname / Identificador en Rack
                </label>
                <input
                  type="text"
                  value={selectedDevice.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateRack({
                      ...rack,
                      devices: rack.devices.map((d) =>
                        d.id === selectedDevice.id ? { ...d, name: val } : d
                      )
                    });
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Dirección IP / Máscara
                  </label>
                  <input
                    type="text"
                    value={selectedDevice.ipAddress}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateRack({
                        ...rack,
                        devices: rack.devices.map((d) =>
                          d.id === selectedDevice.id ? { ...d, ipAddress: val } : d
                        )
                      });
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    VLAN de Gestión
                  </label>
                  <input
                    type="text"
                    value={selectedDevice.managementVlan}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateRack({
                        ...rack,
                        devices: rack.devices.map((d) =>
                          d.id === selectedDevice.id ? { ...d, managementVlan: val } : d
                        )
                      });
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 font-mono text-[11px] tabular-nums">
                <div>
                  <span className="text-slate-500 block">Posición</span>
                  <span className="text-slate-200 font-semibold">
                    U{selectedDevice.uStart} ({selectedDevice.uSize}U)
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Puertos</span>
                  <span className="text-slate-200 font-semibold">
                    {selectedDevice.ports.length} Total
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Consumo</span>
                  <span className="text-slate-200 font-semibold">
                    {selectedDevice.powerWatts} W
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Notas Técnicas / Servicio en Ubuntu
                </label>
                <textarea
                  rows={2}
                  value={selectedDevice.notes}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateRack({
                      ...rack,
                      devices: rack.devices.map((d) =>
                        d.id === selectedDevice.id ? { ...d, notes: val } : d
                      )
                    });
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Status selector with explicit text + icon */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">Estado Operativo:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateRack({
                        ...rack,
                        devices: rack.devices.map((d) =>
                          d.id === selectedDevice.id ? { ...d, status: 'nominal' } : d
                        )
                      })
                    }
                    className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 cursor-pointer ${
                      selectedDevice.status === 'nominal'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Nominal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateRack({
                        ...rack,
                        devices: rack.devices.map((d) =>
                          d.id === selectedDevice.id ? { ...d, status: 'warning' } : d
                        )
                      })
                    }
                    className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 cursor-pointer ${
                      selectedDevice.status === 'warning'
                        ? 'bg-amber-950 text-amber-300 border border-amber-700'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Aviso</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4 text-center">
              Seleccione cualquier dispositivo en el rack para editar su configuración IP, VLAN o posición U.
            </p>
          )}
        </div>

        {/* Patch Cable Schedule & Connections List */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div>
              <h3 className="font-display text-sm font-bold text-white">
                Tabla de Latiguillos Activos
              </h3>
              <p className="text-[11px] text-slate-400">
                Conexiones punto a punto en este armario
              </p>
            </div>
            <span className="text-xs font-mono text-slate-300 tabular-nums">
              {rack.cables.length} cables
            </span>
          </div>

          {selectedCable && (
            <div className="mb-3 p-3 rounded-lg bg-slate-900 border border-blue-500/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-white">
                  Editando: {selectedCable.label}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteCable(selectedCable.id)}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Eliminar cable</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={selectedCable.label}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateRack({
                      ...rack,
                      cables: rack.cables.map((c) =>
                        c.id === selectedCable.id ? { ...c, label: val } : c
                      )
                    });
                  }}
                  className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white"
                  placeholder="Etiqueta"
                />
                <input
                  type="text"
                  value={selectedCable.vlan}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateRack({
                      ...rack,
                      cables: rack.cables.map((c) =>
                        c.id === selectedCable.id ? { ...c, vlan: val } : c
                      )
                    });
                  }}
                  className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white"
                  placeholder="VLAN"
                />
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {rack.cables.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">
                No hay latiguillos conectados. Haga clic en dos puertos del rack para tirar un cable.
              </div>
            ) : (
              rack.cables.map((cab) => {
                const fromDev = rack.devices.find((d) => d.id === cab.fromDeviceId);
                const fromPort = fromDev?.ports.find((p) => p.id === cab.fromPortId);
                const toDev = rack.devices.find((d) => d.id === cab.toDeviceId);
                const toPort = toDev?.ports.find((p) => p.id === cab.toPortId);
                const isSelected = selectedCableId === cab.id;

                return (
                  <div
                    key={cab.id}
                    onClick={() => setSelectedCableId(isSelected ? null : cab.id)}
                    className={`p-2.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-blue-500'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: COLOR_HEX_MAP[cab.color] }}
                        />
                        <span className="font-mono font-semibold text-white">
                          {cab.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                          {cab.category} · {cab.lengthMeters}m
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCable(cab.id);
                          }}
                          title="Quitar latiguillo"
                          className="text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-slate-300 truncate">
                      {fromDev?.name} [{fromPort?.label}] ⟷ {toDev?.name} [{toPort?.label}]
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Red: {cab.vlan}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
