import React, { useState, useRef, useEffect } from 'react';
import {
  ZoomIn,
  X,
  Move,
  Plus,
  Trash2,
  RotateCcw,
  Cable,
  ArrowRight,
  AlertTriangle,
  Palette,
  Layers,
  ArrowUpDown,
  Sliders,
  Tag,
  Globe,
  CheckCircle2,
  Activity,
  Unplug
} from 'lucide-react';
import {
  RackUnit,
  RackDevice,
  DevicePort,
  PortType,
  PortZone,
  PortNumberingOrder,
  ShelfBay,
  CableColor
} from '../types';
import {
  CATEGORY_LABELS,
  PORT_TYPE_META,
  DEVICE_COLOR_PALETTE,
  ensureDevicePortCoordinates
} from '../constants';

interface DeviceZoomEditorModalProps {
  rack: RackUnit;
  device: RackDevice;
  onUpdateRack: (updatedRack: RackUnit) => void;
  onClose: () => void;
}

const COLOR_HEX_MAP: Record<CableColor, string> = {
  blue: '#3B82F6',
  yellow: '#EAB308',
  emerald: '#10B981',
  red: '#EF4444',
  cyan: '#06B6D4',
  purple: '#A855F7',
  orange: '#F97316',
  slate: '#64748B'
};

export const DeviceZoomEditorModal: React.FC<DeviceZoomEditorModalProps> = ({
  rack,
  device,
  onUpdateRack,
  onClose
}) => {
  const [selectedPortId, setSelectedPortId] = useState<string | null>(
    device.ports[0]?.id || null
  );
  const [draggingPortId, setDraggingPortId] = useState<string | null>(null);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<1 | 1.25 | 1.5>(1);
  const [newPortType, setNewPortType] = useState<PortType>('rj45');
  const [newPortZone, setNewPortZone] = useState<PortZone>('right');
  const [newPortCustomLabel, setNewPortCustomLabel] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const positionedPorts = ensureDevicePortCoordinates(device);
  const selectedPort =
    positionedPorts.find((p) => p.id === selectedPortId) ||
    positionedPorts[0] ||
    null;

  const updateDeviceInRack = (updater: (dev: RackDevice) => RackDevice) => {
    const updatedDevices = rack.devices.map((d) =>
      d.id === device.id ? updater(d) : d
    );
    onUpdateRack({
      ...rack,
      devices: updatedDevices
    });
  };

  // Dragging port on the giant zoomed faceplate canvas
  useEffect(() => {
    if (!draggingPortId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      let rawX = ((e.clientX - rect.left) / rect.width) * 100;
      let rawY = ((e.clientY - rect.top) / rect.height) * 100;

      if (snapToGrid) {
        rawX = Math.round(rawX / 2.5) * 2.5;
        rawY = Math.round(rawY / 5) * 5;
      }

      const clampedX = Math.max(3, Math.min(97, Number(rawX.toFixed(1))));
      const clampedY = Math.max(10, Math.min(90, Number(rawY.toFixed(1))));

      const inferredZone: PortZone =
        clampedX < 30 ? 'left' : clampedX < 58 ? 'center' : 'right';

      updateDeviceInRack((dev) => {
        const basePorts = ensureDevicePortCoordinates(dev);
        return {
          ...dev,
          ports: basePorts.map((p) =>
            p.id === draggingPortId
              ? {
                  ...p,
                  xPercent: clampedX,
                  yPercent: clampedY,
                  zone: inferredZone
                }
              : p
          )
        };
      });
    };

    const handleMouseUp = () => {
      setDraggingPortId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingPortId, snapToGrid, rack, device.id]);

  const getPortCableInfo = (portId: string) => {
    const cab = rack.cables.find(
      (c) => c.fromPortId === portId || c.toPortId === portId
    );
    if (!cab) return null;
    const isFrom = cab.fromPortId === portId;
    const remoteDeviceId = isFrom ? cab.toDeviceId : cab.fromDeviceId;
    const remotePortId = isFrom ? cab.toPortId : cab.fromPortId;
    const remoteDev = rack.devices.find((d) => d.id === remoteDeviceId);
    const remotePort = remoteDev?.ports.find((p) => p.id === remotePortId);
    return {
      cable: cab,
      remoteDev,
      remotePort
    };
  };

  const handleRenamePort = (portId: string, newLabel: string) => {
    updateDeviceInRack((dev) => ({
      ...dev,
      ports: dev.ports.map((p) =>
        p.id === portId ? { ...p, label: newLabel } : p
      )
    }));
  };

  const handleChangePortType = (portId: string, newType: PortType) => {
    updateDeviceInRack((dev) => ({
      ...dev,
      ports: dev.ports.map((p) =>
        p.id === portId ? { ...p, type: newType } : p
      )
    }));
  };

  const handleChangePortZone = (portId: string, zone: PortZone) => {
    const defaultX = zone === 'left' ? 14 : zone === 'center' ? 44 : 78;
    updateDeviceInRack((dev) => {
      const basePorts = ensureDevicePortCoordinates(dev);
      return {
        ...dev,
        ports: basePorts.map((p) =>
          p.id === portId
            ? {
                ...p,
                zone,
                xPercent: defaultX
              }
            : p
        )
      };
    });
  };

  const handleAddPortInZoom = () => {
    const nextNum =
      device.ports.reduce((max, p) => Math.max(max, p.number), 0) + 1;
    const prefixMap: Record<PortType, string> = {
      rj45: 'GE',
      sfp: 'SFP+',
      pon: 'PON',
      console: 'CON',
      usb: 'USB',
      fxs: 'FXS',
      coax: 'COAX',
      keystone: 'P',
      power: 'PWR'
    };
    const finalLabel =
      newPortCustomLabel.trim() || `${prefixMap[newPortType]}${nextNum}`;
    const defaultX =
      newPortZone === 'left' ? 15 : newPortZone === 'center' ? 45 : 80;
    const newPortId = `${device.id}-p-${Date.now()}`;

    const newPort: DevicePort = {
      id: newPortId,
      number: nextNum,
      label: finalLabel,
      type: newPortType,
      zone: newPortZone,
      vlan: '1',
      speed: newPortType === 'sfp' ? '10G' : '1G',
      xPercent: defaultX,
      yPercent: 50
    };

    updateDeviceInRack((dev) => {
      const basePorts = ensureDevicePortCoordinates(dev);
      return {
        ...dev,
        ports: [...basePorts, newPort]
      };
    });
    setSelectedPortId(newPortId);
    setNewPortCustomLabel('');
    setStatusMessage(
      `Puerto #${nextNum} (${finalLabel}) añadido. Arrástrelo con el ratón a donde quiera.`
    );
  };

  const handleDeletePortInZoom = (portId: string) => {
    if (device.ports.length <= 1) return;
    const updatedDevices = rack.devices.map((d) => {
      if (d.id !== device.id) return d;
      const remaining = d.ports
        .filter((p) => p.id !== portId)
        .map((p, idx) => ({
          ...p,
          number: idx + 1
        }));
      return {
        ...d,
        ports: remaining
      };
    });
    const updatedCables = rack.cables.filter(
      (c) => c.fromPortId !== portId && c.toPortId !== portId
    );
    onUpdateRack({
      ...rack,
      devices: updatedDevices,
      cables: updatedCables
    });
    const nextSelected = device.ports.find((p) => p.id !== portId);
    setSelectedPortId(nextSelected?.id || null);
    setStatusMessage('Puerto eliminado del chasis.');
  };

  const handleAutoAlignPorts = (
    order?: PortNumberingOrder,
    perRowCount?: number,
    renumberLabels?: boolean
  ) => {
    updateDeviceInRack((dev) => {
      const targetOrder = order ?? dev.portNumberingOrder ?? 'vertical-odd-even';
      const targetPerRow =
        perRowCount ||
        (dev.portsPerRow && dev.portsPerRow[0]) ||
        Math.min(12, dev.ports.length);

      const total = dev.ports.length;
      const chunks: number[] = [];
      let rem = total;
      while (rem > 0) {
        const take = Math.min(targetPerRow, rem);
        chunks.push(take);
        rem -= take;
      }

      // Re-assign port rows according to targetOrder
      const sortedPorts = [...dev.ports].sort((a, b) => a.number - b.number);
      const remappedPorts = sortedPorts.map((p, idx) => {
        let rowNum = 1;
        if (chunks.length >= 2) {
          if (targetOrder === 'vertical-odd-even') {
            // Odd 1, 3, 5... top row; Even 2, 4, 6... bottom row
            rowNum = idx % 2 === 0 ? 1 : 2;
          } else if (targetOrder === 'vertical-even-odd') {
            rowNum = idx % 2 === 0 ? 2 : 1;
          } else {
            // Sequential: top row 1..targetPerRow; bottom row targetPerRow+1..
            rowNum = idx < targetPerRow ? 1 : 2;
          }
        }

        let label = p.label;
        if (renumberLabels) {
          const prefixMatch = p.label.match(/^[A-Za-z_-]+/);
          const prefix = prefixMatch ? prefixMatch[0] : 'P';
          label = `${prefix}${(idx + 1).toString().padStart(2, '0')}`;
        }

        return {
          ...p,
          number: idx + 1,
          row: rowNum,
          label,
          xPercent: undefined,
          yPercent: undefined
        };
      });

      const tempDev: RackDevice = {
        ...dev,
        portNumberingOrder: targetOrder,
        portsPerRow: chunks,
        ports: remappedPorts
      };

      return {
        ...tempDev,
        ports: ensureDevicePortCoordinates(tempDev)
      };
    });

    const orderName =
      (order ?? device.portNumberingOrder) === 'vertical-odd-even'
        ? '1 Arriba / 2 Abajo'
        : (order ?? device.portNumberingOrder) === 'vertical-even-odd'
        ? '2 Arriba / 1 Abajo'
        : 'Secuencial por Filas';
    setStatusMessage(
      `Puertos alineados en ${orderName} (${perRowCount || currentPerRow} por fila)${
        renumberLabels ? ' con renumeración de etiquetas' : ''
      }.`
    );
  };

  const defaultCategoryColor =
    device.category === 'firewall'
      ? '#7F1D1D'
      : device.category === 'router' || device.category === 'ont'
      ? '#0369A1'
      : device.category === 'patchpanel'
      ? '#0F172A'
      : device.category === 'switch'
      ? '#065F46'
      : device.category === 'server'
      ? '#1E293B'
      : '#78350F';

  const activeChassisColor = device.customColor || defaultCategoryColor;
  const canvasHeightPx = Math.round(
    Math.max(210, device.uSize * 125) * zoomScale
  );

  const currentPerRow =
    device.portsPerRow && device.portsPerRow.length > 0
      ? device.portsPerRow[0]
      : 12;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col overflow-hidden">
      {/* =================================================================== */}
      {/* TOP TAB / HEADER BAR FOR ZOOMED DEVICE                              */}
      {/* =================================================================== */}
      <div className="bg-[#0D1322] border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400">
            <ZoomIn className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-mono text-[11px] font-bold">
                VISTA ZOOM DE DISPOSITIVO · U{device.uStart}
                {device.uSize > 1 ? `-U${device.uStart + device.uSize - 1}` : ''}
                {device.shelfBay === 'left'
                  ? ' (Bandeja Izquierda 1/2)'
                  : device.shelfBay === 'right'
                  ? ' (Bandeja Derecha 1/2)'
                  : ' (Ancho Completo 19")'}
              </span>
              <h2 className="font-display text-lg font-bold text-white">
                {device.name}
              </h2>
              <span className="font-mono text-xs text-slate-400">
                — {device.model} ({CATEGORY_LABELS[device.category]})
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Arrastre cualquier puerto directamente con el ratón sobre el frontal ampliado, haga clic en un puerto para cambiar su nombre o agregue puertos nuevos en cualquier zona.
            </p>
          </div>
        </div>

        {/* Right Zoom Scale + Reset + Close */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Zoom Multiplier */}
          <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-700 text-xs font-mono">
            <span className="px-2 text-slate-400">Escala Zoom:</span>
            {([1, 1.25, 1.5] as const).map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => setZoomScale(sc)}
                className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-colors ${
                  zoomScale === sc
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {Math.round(sc * 100)}%
              </button>
            ))}
          </div>

          {/* Snap to Grid Toggle */}
          <button
            type="button"
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`px-3 py-2 rounded-lg border text-xs font-mono font-bold cursor-pointer transition-colors ${
              snapToGrid
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {snapToGrid ? 'Rejilla Imán: ACTIVA' : 'Movimiento Libre 100%'}
          </button>

          {/* Auto Align Button */}
          <button
            type="button"
            onClick={() => handleAutoAlignPorts()}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            title="Alinear todos los puertos en formación ordenada"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Auto-Ordenar Puertos</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Volver al Armario Rack</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MAIN BODY: ZOOMED INTERACTIVE CHASSIS + FULL EDITOR WORKBENCH       */}
      {/* =================================================================== */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1650px] w-full mx-auto">
        {statusMessage && (
          <div className="px-4 py-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-xs text-emerald-200 flex items-center justify-between">
            <span>{statusMessage}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-emerald-300 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* 1. GIANT INTERACTIVE FRONT-PANEL CHASSIS (ZOOM VIEW)              */}
        {/* ================================================================= */}
        <div className="bg-[#0B0F17] border-2 border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <Move className="w-4 h-4 text-amber-400" />
              <span className="text-white font-bold">
                FRONTAL FÍSICO AMPLIADO ({device.ports.length} PUERTOS)
              </span>
              <span className="text-amber-300">
                — Mantenga pulsado y arrastre cualquier puerto para moverlo libremente; haga clic para editar su nombre abajo
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span>
                Numeración:{' '}
                <strong className="text-cyan-300">
                  {device.portNumberingOrder === 'vertical-odd-even'
                    ? '1 Arriba / 2 Abajo (Vertical)'
                    : device.portNumberingOrder === 'vertical-even-odd'
                    ? '2 Arriba / 1 Abajo (Invertido)'
                    : '1, 2, 3... Seguido en Fila (Horizontal)'}
                </strong>
              </span>
              <span>·</span>
              <span>
                Puertos por fila:{' '}
                <strong className="text-blue-300">{currentPerRow}</strong>
              </span>
            </div>
          </div>

          {/* 19" Rack Ears + Giant Faceplate */}
          <div className="flex items-stretch rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl">
            {/* Left Rack Mounting Ear with Screw Holes */}
            <div className="w-14 shrink-0 bg-slate-950 border-r-2 border-slate-800 flex flex-col items-center justify-between py-4 font-mono text-xs text-slate-400">
              <div className="w-4 h-3 rounded-full border-2 border-slate-600 bg-slate-900" />
              <div className="text-center">
                <div className="font-bold text-white">U{device.uStart}</div>
                <div className="text-[10px] text-slate-500">{device.uSize}U</div>
              </div>
              <div className="w-4 h-3 rounded-full border-2 border-slate-600 bg-slate-900" />
            </div>

            {/* Device Chassis Body */}
            <div
              style={{
                minHeight: `${canvasHeightPx}px`,
                background: `linear-gradient(90deg, ${activeChassisColor}F2 0%, #0F172A 38%, #0B1120 100%)`
              }}
              className="flex-1 flex flex-col lg:flex-row items-stretch p-4 gap-4 min-w-0"
            >
              {/* Left Silk-Screen Branding & LEDs */}
              <div className="lg:w-56 shrink-0 bg-slate-950/75 border border-slate-800/90 rounded-xl p-3.5 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-white/10 font-mono text-[10px] uppercase tracking-wider text-white font-bold">
                      {CATEGORY_LABELS[device.category]}
                    </span>
                    {device.status === 'nominal' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        PWR / RUN
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400">
                        <AlertTriangle className="w-3 h-3" />
                        WARN
                      </span>
                    )}
                  </div>
                  <div className="font-display text-base font-extrabold text-white truncate">
                    {device.name}
                  </div>
                  <div className="font-mono text-xs text-slate-300 truncate">
                    {device.model}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 space-y-1 font-mono text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>IP Gestión:</span>
                    <span className="text-cyan-300 font-bold">
                      {device.ipAddress}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Consumo:</span>
                    <span className="text-amber-300">{device.powerWatts}W</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bandeja U{device.uStart}:</span>
                    <span className="text-white">
                      {device.shelfBay === 'left'
                        ? '1/2 Izquierda'
                        : device.shelfBay === 'right'
                        ? '1/2 Derecha'
                        : '19" Completa'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Giant Interactive Drag & Drop Port Canvas */}
              <div
                ref={canvasRef}
                style={{
                  minHeight: `${canvasHeightPx - 32}px`,
                  backgroundImage:
                    'radial-gradient(rgba(148, 163, 184, 0.16) 1px, transparent 1px)',
                  backgroundSize: '18px 18px'
                }}
                className="flex-1 relative bg-slate-950/85 border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-xl overflow-hidden select-none transition-colors"
              >
                {/* Subtle Zone Dividers (Izquierda / Centro / Derecha) */}
                <div className="absolute inset-0 pointer-events-none grid grid-cols-12">
                  <div className="col-span-3 border-r border-slate-800/60 p-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      Zona Izquierda (Serie / USB / PON / WAN)
                    </span>
                  </div>
                  <div className="col-span-4 border-r border-slate-800/60 p-2 text-center">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      Zona Central (LAN / DMZ / Puertos)
                    </span>
                  </div>
                  <div className="col-span-5 p-2 text-right">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      Zona Derecha (Switch / SFP+ / Uplinks)
                    </span>
                  </div>
                </div>

                {/* Draggable Zoomed Port Widgets */}
                {positionedPorts.map((port) => {
                  const isSelected = selectedPort?.id === port.id;
                  const isDragging = draggingPortId === port.id;
                  const connInfo = getPortCableInfo(port.id);
                  const cableHex = connInfo
                    ? COLOR_HEX_MAP[connInfo.cable.color]
                    : undefined;

                  const typeColors =
                    port.type === 'sfp'
                      ? 'bg-cyan-950/95 border-cyan-400 text-cyan-200'
                      : port.type === 'pon'
                      ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
                      : port.type === 'console'
                      ? 'bg-sky-950/95 border-sky-400 text-sky-200'
                      : port.type === 'usb'
                      ? 'bg-purple-950/95 border-purple-400 text-purple-200'
                      : port.type === 'fxs'
                      ? 'bg-amber-950/95 border-amber-400 text-amber-200'
                      : port.type === 'coax'
                      ? 'bg-orange-950/95 border-orange-400 text-orange-200'
                      : port.type === 'power'
                      ? 'bg-rose-950/95 border-rose-400 text-rose-200'
                      : 'bg-slate-900/95 border-slate-500 text-slate-100';

                  const isExternal = Boolean(port.externalOccupied);
                  const isExternalOp = port.externalStatus !== 'inoperativo';

                  return (
                    <div
                      key={port.id}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSelectedPortId(port.id);
                        setDraggingPortId(port.id);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPortId(port.id);
                        setTimeout(() => {
                          nameInputRef.current?.focus();
                          nameInputRef.current?.select();
                        }, 30);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${port.xPercent ?? 50}%`,
                        top: `${port.yPercent ?? 50}%`,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: cableHex || undefined,
                        borderColor: isSelected
                          ? '#FBBF24'
                          : cableHex
                          ? '#FFFFFF'
                          : isExternal
                          ? isExternalOp
                            ? '#10B981'
                            : '#EF4444'
                          : undefined
                      }}
                      title={`#${port.number} · ${port.label} (${
                        PORT_TYPE_META[port.type]?.label || port.type
                      })${
                        isExternal
                          ? ` [ENLACE EXTERNO: ${port.externalOrigin || 'Desconocido'} - ${
                              isExternalOp ? 'OPERATIVO (UP)' : 'INOPERATIVO (DOWN)'
                            }]`
                          : ''
                      } — Arrastrar para mover / Clic para editar`}
                      className={`px-2 py-1 rounded-md border-2 font-mono flex flex-col items-center justify-center min-w-[44px] cursor-grab active:cursor-grabbing transition-shadow ${
                        isSelected
                          ? 'ring-4 ring-amber-400/80 z-40 shadow-2xl scale-110'
                          : isDragging
                          ? 'z-40 scale-110 shadow-2xl'
                          : isExternal
                          ? isExternalOp
                            ? 'ring-2 ring-emerald-500/70 z-30 shadow-lg'
                            : 'ring-2 ring-red-500/80 z-30 shadow-lg'
                          : 'z-20 hover:scale-105 shadow-md'
                      } ${cableHex ? 'text-white' : typeColors}`}
                    >
                      <div className="flex items-center gap-1 text-[10px] font-extrabold leading-none">
                        <span>#{port.number.toString().padStart(2, '0')}</span>
                        <span className="text-[8px] opacity-80 uppercase">
                          {PORT_TYPE_META[port.type]?.shortTag || port.type}
                        </span>
                        {isExternal && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isExternalOp
                                ? 'bg-emerald-400 animate-pulse'
                                : 'bg-red-400'
                            }`}
                          />
                        )}
                      </div>
                      <div className="text-[10px] font-bold truncate max-w-[78px] leading-tight mt-0.5">
                        {port.label}
                      </div>
                      {connInfo ? (
                        <div className="text-[8px] bg-black/45 px-1 rounded mt-0.5 truncate max-w-[78px]">
                          → {connInfo.remoteDev?.name}
                        </div>
                      ) : isExternal ? (
                        <div
                          className={`text-[8px] px-1 rounded mt-0.5 truncate max-w-[82px] font-bold ${
                            isExternalOp
                              ? 'bg-emerald-950/90 text-emerald-300'
                              : 'bg-red-950/90 text-red-300'
                          }`}
                        >
                          {isExternalOp ? '● EXT OP' : '✕ EXT CAÍDO'}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Rack Mounting Ear */}
            <div className="w-14 shrink-0 bg-slate-950 border-l-2 border-slate-800 flex flex-col items-center justify-between py-4 font-mono text-xs text-slate-400">
              <div className="w-4 h-3 rounded-full border-2 border-slate-600 bg-slate-900" />
              <div className="font-bold text-slate-500">19&quot;</div>
              <div className="w-4 h-3 rounded-full border-2 border-slate-600 bg-slate-900" />
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. THREE-COLUMN WORKBENCH: SELECTED PORT + DEVICE + ALL PORTS     */}
        {/* ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUMN 1 (4 COLS): SELECTED PORT EDITOR & ADD NEW PORT */}
          <div className="lg:col-span-4 space-y-5">
            {/* Selected Port Card */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-400" />
                  <span>
                    {selectedPort
                      ? `Editar Puerto Seleccionado (#${selectedPort.number})`
                      : 'Seleccione un Puerto en el Chasis'}
                  </span>
                </h3>
                {selectedPort && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono text-[10px] font-bold">
                    X:{Math.round(selectedPort.xPercent ?? 50)}% · Y:
                    {Math.round(selectedPort.yPercent ?? 50)}%
                  </span>
                )}
              </div>

              {selectedPort ? (
                <div className="space-y-3.5 text-xs">
                  {/* Port Custom Name / Label */}
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Nombre / Etiqueta del Puerto (ej. WAN-FIBRA, TRUNK-SW2, IMPRESORA)
                    </label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={selectedPort.label}
                      onChange={(e) =>
                        handleRenamePort(selectedPort.id, e.target.value)
                      }
                      placeholder="Nombre personalizado del puerto..."
                      className="w-full px-3 py-2 bg-slate-950 border-2 border-amber-500/60 focus:border-amber-400 rounded-lg text-white font-mono text-sm font-bold focus:outline-none"
                    />
                  </div>

                  {/* Connector Type & Zone */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">
                        Tipo de Conector Físico
                      </label>
                      <select
                        value={selectedPort.type}
                        onChange={(e) =>
                          handleChangePortType(
                            selectedPort.id,
                            e.target.value as PortType
                          )
                        }
                        className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                      >
                        {(Object.keys(PORT_TYPE_META) as PortType[]).map(
                          (pt) => (
                            <option key={pt} value={pt}>
                              {PORT_TYPE_META[pt].label}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">
                        Mover a Zona Rápida
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        {(
                          [
                            { id: 'left', label: 'Izq' },
                            { id: 'center', label: 'Cen' },
                            { id: 'right', label: 'Der' }
                          ] as const
                        ).map((z) => (
                          <button
                            key={z.id}
                            type="button"
                            onClick={() =>
                              handleChangePortZone(selectedPort.id, z.id)
                            }
                            className={`py-2 rounded font-mono font-bold border cursor-pointer ${
                              (selectedPort.zone || 'right') === z.id
                                ? 'bg-blue-600 text-white border-blue-400'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            {z.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Fine X / Y Sliders */}
                  <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                      <span>Posición Horizontal (X):</span>
                      <span className="text-amber-300 font-bold">
                        {Math.round(selectedPort.xPercent ?? 50)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={97}
                      step={0.5}
                      value={selectedPort.xPercent ?? 50}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateDeviceInRack((dev) => ({
                          ...dev,
                          ports: ensureDevicePortCoordinates(dev).map((p) =>
                            p.id === selectedPort.id
                              ? { ...p, xPercent: val }
                              : p
                          )
                        }));
                      }}
                      className="w-full accent-amber-400 cursor-pointer"
                    />

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                      <span>Posición Vertical (Y):</span>
                      <span className="text-amber-300 font-bold">
                        {Math.round(selectedPort.yPercent ?? 50)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={90}
                      step={1}
                      value={selectedPort.yPercent ?? 50}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateDeviceInRack((dev) => ({
                          ...dev,
                          ports: ensureDevicePortCoordinates(dev).map((p) =>
                            p.id === selectedPort.id
                              ? { ...p, yPercent: val }
                              : p
                          )
                        }));
                      }}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  {/* Active Cable Connection Info for this Port */}
                  {(() => {
                    const conn = getPortCableInfo(selectedPort.id);
                    if (!conn) {
                      return (
                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-400">
                          Puerto libre (sin latiguillo conectado actualmente).
                        </div>
                      );
                    }
                    return (
                      <div className="p-3 rounded-lg bg-slate-900 border border-emerald-500/40 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <Cable className="w-3.5 h-3.5" />
                            CONECTADO ({conn.cable.label})
                          </span>
                          <span className="text-amber-300">
                            {conn.cable.vlan}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-white font-bold flex items-center gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                          <span>
                            [U{conn.remoteDev?.uStart}] {conn.remoteDev?.name} →
                            Puerto {conn.remotePort?.label} (#
                            {conn.remotePort?.number})
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* External or Unknown Source Cable Link Configuration */}
                  <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-200 font-bold flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedPort.externalOccupied)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            updateDeviceInRack((dev) => ({
                              ...dev,
                              ports: dev.ports.map((p) =>
                                p.id === selectedPort.id
                                  ? {
                                      ...p,
                                      externalOccupied: checked,
                                      externalStatus: p.externalStatus || 'operativo',
                                      externalOrigin:
                                        p.externalOrigin || 'Lugar desconocido / Enlace exterior'
                                    }
                                  : p
                              )
                            }));
                          }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-500"
                        />
                        <Globe className="w-4 h-4 text-cyan-400" />
                        <span>Cable Externo / Origen Desconocido</span>
                      </label>
                      {selectedPort.externalOccupied && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            selectedPort.externalStatus === 'inoperativo'
                              ? 'bg-red-950 text-red-300 border border-red-500/50'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                          }`}
                        >
                          {selectedPort.externalStatus === 'inoperativo'
                            ? 'INOPERATIVO'
                            : 'OPERATIVO'}
                        </span>
                      )}
                    </div>

                    {selectedPort.externalOccupied && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Estado Operativo del Puerto:
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                updateDeviceInRack((dev) => ({
                                  ...dev,
                                  ports: dev.ports.map((p) =>
                                    p.id === selectedPort.id
                                      ? { ...p, externalStatus: 'operativo' }
                                      : p
                                  )
                                }));
                              }}
                              className={`py-1.5 px-2 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-1.5 border cursor-pointer transition-colors ${
                                (selectedPort.externalStatus || 'operativo') === 'operativo'
                                  ? 'bg-emerald-950 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/40'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>OPERATIVO (UP)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                updateDeviceInRack((dev) => ({
                                  ...dev,
                                  ports: dev.ports.map((p) =>
                                    p.id === selectedPort.id
                                      ? { ...p, externalStatus: 'inoperativo' }
                                      : p
                                  )
                                }));
                              }}
                              className={`py-1.5 px-2 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-1.5 border cursor-pointer transition-colors ${
                                selectedPort.externalStatus === 'inoperativo'
                                  ? 'bg-red-950 border-red-400 text-red-200 ring-2 ring-red-500/40'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                              <span>INOPERATIVO (DOWN)</span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Lugar / Sitio de donde viene el cable:
                          </label>
                          <input
                            type="text"
                            value={selectedPort.externalOrigin || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateDeviceInRack((dev) => ({
                                ...dev,
                                ports: dev.ports.map((p) =>
                                  p.id === selectedPort.id
                                    ? { ...p, externalOrigin: val }
                                    : p
                                )
                              }));
                            }}
                            placeholder="Ej. Acometida Fibra ISP, Llega de Planta 2, Desconocido..."
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                          />
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {[
                              'Acometida Fibra ISP (WAN)',
                              'Procedencia Desconocida',
                              'Llega de Otra Planta / Sala',
                              'Roseta / Toma Despacho'
                            ].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  updateDeviceInRack((dev) => ({
                                    ...dev,
                                    ports: dev.ports.map((p) =>
                                      p.id === selectedPort.id
                                        ? { ...p, externalOrigin: preset }
                                        : p
                                    )
                                  }));
                                }}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                              >
                                + {preset}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Notas del Enlace Externo:
                          </label>
                          <input
                            type="text"
                            value={selectedPort.externalNotes || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateDeviceInRack((dev) => ({
                                ...dev,
                                ports: dev.ports.map((p) =>
                                  p.id === selectedPort.id
                                    ? { ...p, externalNotes: val }
                                    : p
                                )
                              }));
                            }}
                            placeholder="Ej. Latiguillo directo desde roseta pared"
                            className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-300 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Delete Port Button */}
                  <button
                    type="button"
                    disabled={device.ports.length <= 1}
                    onClick={() => handleDeletePortInZoom(selectedPort.id)}
                    className="w-full py-2 rounded-lg bg-red-950/60 hover:bg-red-900/70 disabled:opacity-40 text-red-200 border border-red-800/60 font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Puerto #{selectedPort.number}</span>
                  </button>
                </div>
              ) : null}
            </div>

            {/* Add New Port Card */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
              <h4 className="font-display text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Añadir Nuevo Puerto al Dispositivo</span>
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1">
                    Tipo de Puerto
                  </label>
                  <select
                    value={newPortType}
                    onChange={(e) => setNewPortType(e.target.value as PortType)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                  >
                    {(Object.keys(PORT_TYPE_META) as PortType[]).map((pt) => (
                      <option key={pt} value={pt}>
                        {PORT_TYPE_META[pt].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    Zona Inicial
                  </label>
                  <select
                    value={newPortZone}
                    onChange={(e) => setNewPortZone(e.target.value as PortZone)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                  >
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  Nombre del Puerto (opcional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPortCustomLabel}
                    onChange={(e) => setNewPortCustomLabel(e.target.value)}
                    placeholder="Ej. CONSOLA, WAN2, SFP-UPLINK..."
                    className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddPortInZoom}
                    className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 2 (4 COLS): DEVICE GENERAL PROPERTIES & MATRIX LAYOUT */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3.5 text-xs">
              <h3 className="font-display text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <Sliders className="w-4 h-4 text-blue-400" />
                <span>Propiedades del Equipo y Chasis</span>
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">
                    Nombre del Dispositivo
                  </label>
                  <input
                    type="text"
                    value={device.name}
                    onChange={(e) =>
                      updateDeviceInRack((dev) => ({
                        ...dev,
                        name: e.target.value
                      }))
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    Marca / Modelo
                  </label>
                  <input
                    type="text"
                    value={device.model}
                    onChange={(e) =>
                      updateDeviceInRack((dev) => ({
                        ...dev,
                        model: e.target.value
                      }))
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1">
                    Dirección IP
                  </label>
                  <input
                    type="text"
                    value={device.ipAddress}
                    onChange={(e) =>
                      updateDeviceInRack((dev) => ({
                        ...dev,
                        ipAddress: e.target.value
                      }))
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-cyan-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    Consumo (W)
                  </label>
                  <input
                    type="number"
                    value={device.powerWatts}
                    onChange={(e) =>
                      updateDeviceInRack((dev) => ({
                        ...dev,
                        powerWatts: Math.max(0, Number(e.target.value) || 0)
                      }))
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-amber-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    Bandeja en U{device.uStart}
                  </label>
                  <select
                    value={device.shelfBay || 'full'}
                    onChange={(e) =>
                      updateDeviceInRack((dev) => ({
                        ...dev,
                        shelfBay: e.target.value as ShelfBay
                      }))
                    }
                    className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                  >
                    <option value="full">19&quot; Completo</option>
                    <option value="left">1/2 Izquierda</option>
                    <option value="right">1/2 Derecha</option>
                  </select>
                </div>
              </div>

              {/* Port Matrix Auto-Formatting Controls */}
              <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Auto-Alineación de Filas y Numeración</span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAutoAlignPorts('vertical-odd-even')}
                    className={`p-2 rounded border text-left font-mono text-[10px] cursor-pointer ${
                      device.portNumberingOrder === 'vertical-odd-even'
                        ? 'bg-cyan-600/25 border-cyan-400 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div>1 Arriba / 2 Abajo</div>
                    <div className="text-[9px] text-slate-400">
                      Par/Impar Switch
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAutoAlignPorts('sequential')}
                    className={`p-2 rounded border text-left font-mono text-[10px] cursor-pointer ${
                      (device.portNumberingOrder || 'sequential') ===
                      'sequential'
                        ? 'bg-blue-600/25 border-blue-400 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div>Secuencial Fila</div>
                    <div className="text-[9px] text-slate-400">
                      1..N / N+1..2N
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAutoAlignPorts('vertical-even-odd')}
                    className={`p-2 rounded border text-left font-mono text-[10px] cursor-pointer ${
                      device.portNumberingOrder === 'vertical-even-odd'
                        ? 'bg-amber-600/25 border-amber-400 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div>2 Arriba / 1 Abajo</div>
                    <div className="text-[9px] text-slate-400">
                      Invertido
                    </div>
                  </button>
                </div>

                <div className="pt-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                    <span>Puertos por fila al auto-ordenar:</span>
                    <button
                      type="button"
                      onClick={() => handleAutoAlignPorts(undefined, undefined, true)}
                      className="text-amber-400 hover:text-amber-300 underline cursor-pointer"
                      title="Reasigna números y etiquetas (ej. GE01, GE02...) según el orden de las bocas"
                    >
                      Renumerar etiquetas
                    </button>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {[4, 8, 12, 16, 24, 48].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleAutoAlignPorts(undefined, n)}
                        className={`py-1 rounded font-mono text-[10px] font-bold border cursor-pointer ${
                          currentPerRow === n
                            ? 'bg-blue-600 text-white border-blue-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chassis Color Picker */}
              <div>
                <label className="block text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-blue-400" />
                  <span>Color del Chasis del Dispositivo</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DEVICE_COLOR_PALETTE.map((sw) => (
                    <button
                      key={sw.hex}
                      type="button"
                      onClick={() =>
                        updateDeviceInRack((dev) => ({
                          ...dev,
                          customColor: sw.hex
                        }))
                      }
                      style={{ backgroundColor: sw.hex }}
                      title={sw.name}
                      className={`w-6 h-6 rounded-md border cursor-pointer transition-transform ${
                        device.customColor === sw.hex
                          ? 'border-white scale-110 ring-2 ring-blue-400'
                          : 'border-slate-700 hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 3 (4 COLS): FAST BULK PORT RENAMING TABLE */}
          <div className="lg:col-span-4">
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Lista Rápida de Nombres de Puertos ({device.ports.length})</span>
                </h3>
                <span className="font-mono text-[10px] text-slate-400">
                  Edición directa en tabla
                </span>
              </div>

              <div className="max-h-[420px] overflow-y-auto space-y-1.5 pr-1">
                {positionedPorts.map((pt) => {
                  const isSel = selectedPort?.id === pt.id;
                  const conn = getPortCableInfo(pt.id);
                  const isExt = Boolean(pt.externalOccupied);
                  const isExtOp = pt.externalStatus !== 'inoperativo';
                  return (
                    <div
                      key={`bulk-pt-${pt.id}`}
                      onClick={() => setSelectedPortId(pt.id)}
                      className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                        isSel
                          ? 'bg-amber-950/30 border-amber-400/80'
                          : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <span className="w-7 text-center font-mono text-[11px] font-bold text-slate-400 shrink-0">
                        #{pt.number.toString().padStart(2, '0')}
                      </span>

                      <input
                        type="text"
                        value={pt.label}
                        onChange={(e) =>
                          handleRenamePort(pt.id, e.target.value)
                        }
                        className="flex-1 min-w-0 px-2 py-1 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded text-white font-mono text-xs font-bold focus:outline-none"
                      />

                      <select
                        value={pt.type}
                        onChange={(e) =>
                          handleChangePortType(
                            pt.id,
                            e.target.value as PortType
                          )
                        }
                        className="px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-300"
                      >
                        {(Object.keys(PORT_TYPE_META) as PortType[]).map(
                          (typeKey) => (
                            <option key={typeKey} value={typeKey}>
                              {PORT_TYPE_META[typeKey].shortTag}
                            </option>
                          )
                        )}
                      </select>

                      {conn ? (
                        <span
                          style={{
                            backgroundColor: COLOR_HEX_MAP[conn.cable.color]
                          }}
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-white shrink-0"
                          title={`Conectado a ${conn.remoteDev?.name} (${conn.remotePort?.label})`}
                        >
                          CON
                        </span>
                      ) : isExt ? (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${
                            isExtOp
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                              : 'bg-red-950 text-red-300 border border-red-500/50'
                          }`}
                          title={`Enlace externo: ${pt.externalOrigin || 'Desconocido'} [${isExtOp ? 'UP' : 'DOWN'}]`}
                        >
                          {isExtOp ? 'EXT OP' : 'EXT CAÍDO'}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 text-[9px] font-mono shrink-0">
                          LIBRE
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
