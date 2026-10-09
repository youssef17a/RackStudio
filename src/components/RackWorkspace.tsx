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
  FileDown,
  Search,
  Sliders,
  Palette,
  Layers
} from 'lucide-react';
import {
  CompanyProject,
  RackUnit,
  RackDevice,
  HardwareTemplate,
  DeviceCategory,
  CableColor,
  CableCategory,
  PortType,
  DevicePort
} from '../types';
import {
  HARDWARE_CATALOG,
  CABLE_COLORS,
  CATEGORY_LABELS,
  DEVICE_COLOR_PALETTE,
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

interface PatchPanelSetupPending {
  template: HardwareTemplate;
  targetU: number;
  customName: string;
  rowCount: number;
  pointsPerRow: number[];
  colorHex: string;
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
  const [catalogSearch, setCatalogSearch] = useState<string>('');
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

  // Patch Panel Row & Points Configuration Modal State
  const [patchPanelPending, setPatchPanelPending] =
    useState<PatchPanelSetupPending | null>(null);

  // Custom Device Builder Modal State
  const [showCustomBuilder, setShowCustomBuilder] = useState<boolean>(false);
  const [customDevName, setCustomDevName] = useState('DISP-PERSONALIZADO-01');
  const [customDevBrand, setCustomDevBrand] = useState('Movistar / Fortinet / Propio');
  const [customDevCategory, setCustomDevCategory] = useState<DeviceCategory>('router');
  const [customDevUStart, setCustomDevUStart] = useState<number>(10);
  const [customDevUSize, setCustomDevUSize] = useState<number>(1);
  const [customDevColor, setCustomDevColor] = useState<string>('#0369A1');
  const [customDevIp, setCustomDevIp] = useState<string>('192.168.1.1/24');
  const [customDevWatts, setCustomDevWatts] = useState<number>(35);
  const [customDevRj45, setCustomDevRj45] = useState<number>(8);
  const [customDevSfp, setCustomDevSfp] = useState<number>(2);
  const [customDevRows, setCustomDevRows] = useState<number>(1);

  // Add Extra Ports to Mounted Device State
  const [addPortQty, setAddPortQty] = useState<number>(4);
  const [addPortType, setAddPortType] = useState<PortType>('rj45');
  const [addPortPrefix, setAddPortPrefix] = useState<string>('ETH');
  const [addPortRow, setAddPortRow] = useState<number>(1);

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

    // If installing a Patch Panel, open the row & points configurator modal first!
    if (template.category === 'patchpanel') {
      const sameCount =
        rack.devices.filter((d) => d.category === 'patchpanel').length + 1;
      const initialRows =
        template.portsPerRow && template.portsPerRow.length > 0
          ? [...template.portsPerRow]
          : [template.defaultPorts || 24];

      setPatchPanelPending({
        template,
        targetU,
        customName: `PATCH-PANEL-${sameCount.toString().padStart(2, '0')}`,
        rowCount: initialRows.length,
        pointsPerRow: initialRows,
        colorHex: template.defaultColor || '#0F172A'
      });
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

  const handleConfirmPatchPanelInstall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patchPanelPending) return;

    const { template, targetU, customName, pointsPerRow, colorHex } =
      patchPanelPending;
    const newDevice = createDeviceFromTemplate(
      template,
      targetU,
      undefined,
      pointsPerRow,
      colorHex
    );
    newDevice.name = customName.trim() || newDevice.name;
    const totalPoints = pointsPerRow.reduce((a, b) => a + b, 0);
    newDevice.notes = `Patch Panel (${pointsPerRow.length} ${
      pointsPerRow.length === 1 ? 'fila' : 'filas'
    }: ${pointsPerRow.join(' + ')} = ${totalPoints} puntos). Instalado en U${targetU}.`;

    onUpdateRack({
      ...rack,
      devices: [...rack.devices, newDevice]
    });
    setSelectedDeviceId(newDevice.id);
    setPatchPanelPending(null);
    showNotice(
      `Instalado ${newDevice.name} con ${pointsPerRow.length} fila(s) (${totalPoints} puntos) en U${targetU}`
    );
  };

  const handleQuickAddTemplate = (template: HardwareTemplate) => {
    const targetU = findFirstAvailableUFromTop(template.uSize);
    if (targetU === null) {
      showNotice(`El rack no dispone de ${template.uSize}U libres contiguos.`);
      return;
    }
    handleInstallTemplateAtU(template, targetU);
  };

  // Create a 100% Custom Device from the Custom Device Modal
  const handleCreateCustomDevice = (e: React.FormEvent) => {
    e.preventDefault();
    let targetU = customDevUStart;
    if (!isURangeAvailable(targetU, customDevUSize, null)) {
      const fallbackU = findFirstAvailableUFromTop(customDevUSize);
      if (fallbackU === null) {
        showNotice(`No hay ${customDevUSize}U libres en el armario.`);
        return;
      }
      targetU = fallbackU;
    }

    const devId = `dev-custom-${Date.now()}`;
    const ports: DevicePort[] = [];
    const totalRows = Math.max(1, Math.min(4, customDevRows));
    const basePerRow = Math.ceil(customDevRj45 / totalRows);
    const portsPerRowArr: number[] = [];

    let portNum = 1;
    for (let r = 1; r <= totalRows; r++) {
      let countThisRow = 0;
      for (let i = 0; i < basePerRow && portNum <= customDevRj45; i++) {
        const prefix =
          customDevCategory === 'patchpanel'
            ? 'P'
            : customDevCategory === 'server'
            ? 'eno'
            : 'GE';
        ports.push({
          id: `${devId}-p${portNum}`,
          number: portNum,
          label: `${prefix}${portNum.toString().padStart(2, '0')}`,
          type: customDevCategory === 'patchpanel' ? 'keystone' : 'rj45',
          row: r,
          vlan: '1',
          speed: '1G'
        });
        portNum++;
        countThisRow++;
      }
      if (countThisRow > 0) {
        portsPerRowArr.push(countThisRow);
      }
    }

    for (let s = 1; s <= customDevSfp; s++) {
      const n = portNum++;
      ports.push({
        id: `${devId}-sfp${s}`,
        number: n,
        label: `SFP+${s}`,
        type: 'sfp',
        row: totalRows,
        vlan: 'Trunk',
        speed: '10G'
      });
    }

    const customDevice: RackDevice = {
      id: devId,
      templateId: 'custom-user-device',
      name: customDevName.trim() || 'EQUIPO-PERSONALIZADO',
      model: customDevBrand.trim() || 'Hardware a Medida',
      category: customDevCategory,
      uStart: targetU,
      uSize: customDevUSize,
      ipAddress: customDevIp.trim() || '192.168.1.1/24',
      managementVlan: 'VLAN 10',
      serialNumber: `SN-CUST-${Math.floor(100000 + Math.random() * 900000)}`,
      powerWatts: customDevWatts,
      status: 'nominal',
      notes: `Dispositivo personalizado (${ports.length} puertos en ${totalRows} fila/s).`,
      customColor: customDevColor,
      portsPerRow: portsPerRowArr.length > 0 ? portsPerRowArr : [ports.length],
      ports
    };

    onUpdateRack({
      ...rack,
      devices: [...rack.devices, customDevice]
    });
    setSelectedDeviceId(customDevice.id);
    setShowCustomBuilder(false);
    showNotice(
      `Creado equipo personalizado "${customDevice.name}" (${ports.length} puertos) en U${targetU}`
    );
  };

  // Add Extra Ports to an already mounted device
  const handleAddPortsToSelectedDevice = () => {
    if (!selectedDevice || addPortQty < 1) return;
    const currentPorts = selectedDevice.ports;
    const nextStartNumber =
      currentPorts.reduce((max, p) => Math.max(max, p.number), 0) + 1;

    const addedPorts: DevicePort[] = [];
    for (let i = 0; i < addPortQty; i++) {
      const num = nextStartNumber + i;
      addedPorts.push({
        id: `${selectedDevice.id}-extra-${Date.now()}-${i}`,
        number: num,
        label: `${addPortPrefix.trim() || 'P'}${num.toString().padStart(2, '0')}`,
        type: addPortType,
        row: addPortRow,
        vlan: addPortType === 'sfp' ? 'Trunk' : '1',
        speed: addPortType === 'sfp' ? '10G' : '1G'
      });
    }

    const updatedDevice: RackDevice = {
      ...selectedDevice,
      ports: [...currentPorts, ...addedPorts]
    };

    onUpdateRack({
      ...rack,
      devices: rack.devices.map((d) =>
        d.id === selectedDevice.id ? updatedDevice : d
      )
    });
    showNotice(
      `Añadidos ${addPortQty} puerto(s) (${addPortType.toUpperCase()}) en Fila ${addPortRow} a ${selectedDevice.name}`
    );
  };

  // Remove the last port of the selected device (if not patched)
  const handleRemoveLastPortFromDevice = () => {
    if (!selectedDevice || selectedDevice.ports.length <= 1) return;
    const lastPort = selectedDevice.ports[selectedDevice.ports.length - 1];
    const hasCable = rack.cables.some(
      (c) => c.fromPortId === lastPort.id || c.toPortId === lastPort.id
    );
    if (hasCable) {
      showNotice(
        `El puerto ${lastPort.label} tiene un cable conectado. Desconéctelo antes de quitar el puerto.`
      );
      return;
    }

    const updatedDevice: RackDevice = {
      ...selectedDevice,
      ports: selectedDevice.ports.slice(0, -1)
    };
    onUpdateRack({
      ...rack,
      devices: rack.devices.map((d) =>
        d.id === selectedDevice.id ? updatedDevice : d
      )
    });
  };

  // Reconfigure rows/points of an already mounted Patch Panel
  const handleReconfigurePatchPanelRows = (
    device: RackDevice,
    newRowPoints: number[]
  ) => {
    const newPorts: DevicePort[] = [];
    let counter = 1;
    newRowPoints.forEach((pts, rIdx) => {
      const rowNum = rIdx + 1;
      for (let i = 1; i <= pts; i++) {
        // Keep existing port ID if within old ports array so existing cables stay attached
        const existingPort = device.ports[counter - 1];
        newPorts.push({
          id: existingPort ? existingPort.id : `${device.id}-p${counter}`,
          number: counter,
          label: `P${counter.toString().padStart(2, '0')}`,
          type: existingPort ? existingPort.type : 'keystone',
          row: rowNum,
          vlan: existingPort?.vlan || '10',
          speed: existingPort?.speed || '1G'
        });
        counter++;
      }
    });

    const validPortIds = new Set(newPorts.map((p) => p.id));
    const cleanedCables = rack.cables.filter((c) => {
      if (c.fromDeviceId === device.id && !validPortIds.has(c.fromPortId)) {
        return false;
      }
      if (c.toDeviceId === device.id && !validPortIds.has(c.toPortId)) {
        return false;
      }
      return true;
    });

    onUpdateRack({
      ...rack,
      devices: rack.devices.map((d) =>
        d.id === device.id
          ? {
              ...d,
              portsPerRow: newRowPoints,
              ports: newPorts
            }
          : d
      ),
      cables: cleanedCables
    });
    showNotice(
      `Actualizado ${device.name}: ${newRowPoints.length} fila(s) (${newRowPoints.join(' + ')} puntos)`
    );
  };

  const handleMoveDeviceToU = (deviceId: string, targetU: number) => {
    const dev = rack.devices.find((d) => d.id === deviceId);
    if (!dev) return;
    if (dev.uStart === targetU) return;

    if (!isURangeAvailable(targetU, dev.uSize, deviceId)) {
      showNotice(
        `Posición U${targetU} ocupada o fuera de rango para un chasis de ${dev.uSize}U.`
      );
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

    const existingCable = rack.cables.find(
      (c) =>
        (c.fromDeviceId === device.id && c.fromPortId === portId) ||
        (c.toDeviceId === device.id && c.toPortId === portId)
    );

    if (!pendingPort && existingCable) {
      setSelectedCableId(existingCable.id);
      return;
    }

    if (pendingPort && pendingPort.portId === portId) {
      setPendingPort(null);
      return;
    }

    if (existingCable) {
      setSelectedCableId(existingCable.id);
      showNotice(
        `El puerto ${device.name}:${portLabel} ya tiene conectado el latiguillo ${existingCable.label}.`
      );
      return;
    }

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

    const cableNum = (rack.cables.length + 1).toString().padStart(3, '0');
    const uDistance = Math.abs(
      (rack.devices.find((d) => d.id === pendingPort.deviceId)?.uStart || 1) -
        device.uStart
    );
    const estimatedLength = Math.max(
      0.5,
      Number((0.5 + uDistance * 0.15).toFixed(1))
    );

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

  const getCableForPort = (portId: string) => {
    return rack.cables.find(
      (c) => c.fromPortId === portId || c.toPortId === portId
    );
  };

  // Group a device's ports into visual rows
  const getDevicePortRows = (dev: RackDevice): DevicePort[][] => {
    // Check if ports have explicit row numbers
    const hasExplicitRows = dev.ports.some((p) => p.row && p.row > 1);
    if (hasExplicitRows) {
      const mapByRow = new Map<number, DevicePort[]>();
      for (const p of dev.ports) {
        const r = p.row || 1;
        if (!mapByRow.has(r)) mapByRow.set(r, []);
        mapByRow.get(r)!.push(p);
      }
      return Array.from(mapByRow.entries())
        .sort((a, b) => a[0] - b[0])
        .map((entry) => entry[1]);
    }

    // Or if dev.portsPerRow is specified with multiple entries
    if (dev.portsPerRow && dev.portsPerRow.length > 1) {
      const rows: DevicePort[][] = [];
      let cursor = 0;
      for (const count of dev.portsPerRow) {
        rows.push(dev.ports.slice(cursor, cursor + count));
        cursor += count;
      }
      if (cursor < dev.ports.length) {
        rows[rows.length - 1].push(...dev.ports.slice(cursor));
      }
      return rows.filter((r) => r.length > 0);
    }

    return [dev.ports];
  };

  const filteredCatalog = HARDWARE_CATALOG.filter((t) => {
    const matchesCategory =
      catalogFilter === 'all' || t.category === catalogFilter;
    const q = catalogSearch.trim().toLowerCase();
    const matchesQuery =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.brand.toLowerCase().includes(q) ||
      t.model.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  const usedU = rack.devices.reduce((acc, d) => acc + d.uSize, 0);
  const totalWatts = rack.devices.reduce((acc, d) => acc + d.powerWatts, 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 p-6 max-w-[1600px] mx-auto items-start">
      {/* =================================================================== */}
      {/* LEFT PANEL (3 COLS): EXPANDED CATALOG + CUSTOM DEVICE + PATCHING    */}
      {/* =================================================================== */}
      <div className="xl:col-span-3 space-y-5">
        {/* Hardware Catalog Card */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="font-display text-sm font-bold text-white">
                Catálogo de Equipos y Marcas
              </h2>
              <p className="text-[11px] text-slate-400">
                Fortinet, Movistar HGU, Cisco, MikroTik, Aruba...
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const freeU = findFirstAvailableUFromTop(1) || 10;
                setCustomDevUStart(freeU);
                setShowCustomBuilder(true);
              }}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium rounded-lg flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sliders className="w-3 h-3" />
              <span>+ Equipo a Medida</span>
            </button>
          </div>

          {/* Search Input for Brands / Models */}
          <div className="relative mb-2.5">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Buscar marca (Movistar, Fortinet, Cisco, NAS...)"
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap gap-1 p-1 bg-slate-900 rounded-lg mb-3 border border-slate-800/80">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'firewall', label: 'FW' },
                { id: 'router', label: 'Router/ISP' },
                { id: 'patchpanel', label: 'Patch' },
                { id: 'switch', label: 'Switch' },
                { id: 'server', label: 'Server/NAS' },
                { id: 'ups', label: 'SAI/PDU' }
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
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
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
                className="group p-2.5 rounded-lg bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 transition-colors cursor-grab active:cursor-grabbing flex items-start justify-between gap-2"
              >
                <div className="min-w-0 flex items-start gap-2">
                  <span
                    className="w-2.5 h-6 rounded-sm shrink-0 mt-0.5 border border-white/20"
                    style={{ backgroundColor: tpl.defaultColor || '#1E293B' }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-100">
                      <span className="truncate">{tpl.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {tpl.brand} · <span className="font-mono text-slate-300">{tpl.uSize}U</span> ·{' '}
                      <span className="font-mono text-slate-300">
                        {tpl.defaultPorts + (tpl.sfpUplinks || 0)} puertos
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickAddTemplate(tpl)}
                  title="Montar en el armario"
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
              {showCablesOverlay ? (
                <Eye className="w-3 h-3 text-blue-400" />
              ) : (
                <EyeOff className="w-3 h-3 text-slate-400" />
              )}
              <span>{showCablesOverlay ? 'Ocultar Cables' : 'Ver Cables'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Haga clic en cualquier puerto libre de un <strong>Patch Panel</strong>, <strong>Switch</strong>, <strong>Router</strong>, <strong>Firewall</strong> o <strong>Servidor</strong> y luego en el puerto destino para tirar el cable.
          </p>

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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const freeU = findFirstAvailableUFromTop(1) || 10;
                setCustomDevUStart(freeU);
                setShowCustomBuilder(true);
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>Dispositivo Personalizado</span>
            </button>
            <button
              type="button"
              onClick={onExportPDF}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileDown className="w-4 h-4" />
              <span>Exportar Plano PDF</span>
            </button>
          </div>
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
                const sagOffset = Math.min(
                  75,
                  Math.max(24, dy * 0.25 + dx * 0.1 + (idx % 5) * 6)
                );
                const midY = Math.max(cab.y1, cab.y2) + sagOffset;
                const dPath = `M ${cab.x1} ${cab.y1} C ${cab.x1} ${midY}, ${cab.x2} ${midY}, ${cab.x2} ${cab.y2}`;

                return (
                  <g key={cab.id}>
                    <path
                      d={dPath}
                      fill="none"
                      stroke="#090D16"
                      strokeWidth={isSelected ? 5.5 : 4}
                      strokeLinecap="round"
                      opacity={0.85}
                    />
                    <path
                      d={dPath}
                      fill="none"
                      stroke={cab.colorHex}
                      strokeWidth={isSelected ? 3.2 : 2.1}
                      strokeLinecap="round"
                      opacity={isSelected ? 1 : 0.85}
                    />
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
            {Array.from({ length: rack.totalU }, (_, i) => rack.totalU - i).map(
              (uNumber) => {
                const slotInfo = uSlotMap[uNumber];

                if (slotInfo && slotInfo.type === 'covered') {
                  return null;
                }

                if (slotInfo && slotInfo.type === 'start_top') {
                  const dev = slotInfo.device;
                  const isSelected = selectedDeviceId === dev.id;
                  const portRows = getDevicePortRows(dev);
                  const rowHeightPx = Math.max(
                    dev.uSize * 38,
                    portRows.length * 28 + 14
                  );

                  const defaultCategoryColor =
                    dev.category === 'firewall'
                      ? '#7F1D1D'
                      : dev.category === 'router'
                      ? '#312E81'
                      : dev.category === 'patchpanel'
                      ? '#0F172A'
                      : dev.category === 'switch'
                      ? '#065F46'
                      : dev.category === 'server'
                      ? '#1E293B'
                      : '#78350F';

                  const activeChassisColor = dev.customColor || defaultCategoryColor;

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
                      style={{
                        minHeight: `${rowHeightPx}px`,
                        background: `linear-gradient(90deg, ${activeChassisColor}E6 0%, #0F172A 65%, #0F172A 100%)`
                      }}
                      className={`relative flex items-stretch transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-blue-400 z-10'
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
                          <GripVertical className="w-3.5 h-3.5 text-slate-400 cursor-grab shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-white truncate max-w-[165px]">
                                {dev.name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-300 hidden sm:inline">
                                {dev.ipAddress}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-300/90 truncate">
                              {dev.model} · {CATEGORY_LABELS[dev.category]} ({dev.uSize}U · {dev.ports.length}p)
                            </div>
                          </div>
                        </div>

                        {/* Right Physical Port Matrix Organized by Rows */}
                        <div className="flex flex-col gap-1 items-end justify-center z-30">
                          {portRows.map((rowPorts, rIndex) => (
                            <div
                              key={`row-${dev.id}-${rIndex}`}
                              className="flex flex-wrap items-center gap-1 justify-end"
                            >
                              {portRows.length > 1 && (
                                <span className="text-[9px] font-mono text-slate-400 mr-1">
                                  F{rIndex + 1}:
                                </span>
                              )}
                              {rowPorts.map((port) => {
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
                                    onClick={(e) =>
                                      handlePortClick(e, dev, port.id, port.label)
                                    }
                                    title={`${dev.name} — Puerto ${port.label} (${port.type.toUpperCase()})${
                                      connCable
                                        ? ` · Conectado: ${connCable.label} (${connCable.vlan})`
                                        : ' · Libre (Clic para parchear)'
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
                          ))}
                        </div>
                      </div>

                      {/* Right Rack Rail */}
                      <div className="w-8 shrink-0 bg-slate-950/90 border-l border-slate-800 flex items-center justify-center font-mono text-[10px] text-slate-500 tabular-nums">
                        {uNumber.toString().padStart(2, '0')}
                      </div>
                    </div>
                  );
                }

                // Empty U Slot
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
                    <div className="w-10 h-full bg-slate-950/60 border-r border-slate-800/80 flex items-center justify-center font-mono text-[10px] text-slate-600 tabular-nums">
                      {uNumber.toString().padStart(2, '0')}
                    </div>

                    <div className="flex-1 px-3 flex items-center justify-between text-[10px] font-mono text-slate-700">
                      <span>
                        {isHovered
                          ? `Soltar aquí para montar en U${uNumber}`
                          : 'Bahía 19" Libre'}
                      </span>
                      <span className="hidden sm:inline">U{uNumber}</span>
                    </div>

                    <div className="w-8 h-full bg-slate-950/60 border-l border-slate-800/80 flex items-center justify-center font-mono text-[10px] text-slate-600 tabular-nums">
                      {uNumber.toString().padStart(2, '0')}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* RIGHT PANEL (3 COLS): DEVICE INSPECTOR, COLOR, PORTS & PATCH MATRIX */}
      {/* =================================================================== */}
      <div className="xl:col-span-3 space-y-5">
        {/* Selected Device Inspector */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
              {selectedDevice?.category === 'firewall' && (
                <Shield className="w-4 h-4 text-red-400" />
              )}
              {selectedDevice?.category === 'router' && (
                <RouterIcon className="w-4 h-4 text-indigo-400" />
              )}
              {selectedDevice?.category === 'switch' && (
                <Network className="w-4 h-4 text-emerald-400" />
              )}
              {selectedDevice?.category === 'patchpanel' && (
                <Cable className="w-4 h-4 text-blue-400" />
              )}
              {selectedDevice?.category === 'server' && (
                <ServerIcon className="w-4 h-4 text-purple-400" />
              )}
              <span>Inspector y Personalización</span>
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
            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Hostname / Nombre en Rack
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
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Marca / Modelo de Chasis
                  </label>
                  <input
                    type="text"
                    value={selectedDevice.model}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateRack({
                        ...rack,
                        devices: rack.devices.map((d) =>
                          d.id === selectedDevice.id ? { ...d, model: val } : d
                        )
                      });
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Custom Device Color Picker */}
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-blue-400" />
                    <span>Color Distintivo del Dispositivo</span>
                  </span>
                  <input
                    type="color"
                    value={selectedDevice.customColor || '#1E293B'}
                    onChange={(e) => {
                      const hex = e.target.value;
                      onUpdateRack({
                        ...rack,
                        devices: rack.devices.map((d) =>
                          d.id === selectedDevice.id
                            ? { ...d, customColor: hex }
                            : d
                        )
                      });
                    }}
                    className="w-6 h-5 rounded cursor-pointer bg-transparent border-0"
                    title="Elegir cualquier color RGB"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DEVICE_COLOR_PALETTE.map((swatch) => (
                    <button
                      key={swatch.id}
                      type="button"
                      onClick={() =>
                        onUpdateRack({
                          ...rack,
                          devices: rack.devices.map((d) =>
                            d.id === selectedDevice.id
                              ? { ...d, customColor: swatch.hex }
                              : d
                          )
                        })
                      }
                      title={swatch.name}
                      style={{ backgroundColor: swatch.hex }}
                      className={`w-5 h-5 rounded-md border transition-transform cursor-pointer ${
                        selectedDevice.customColor === swatch.hex
                          ? 'border-white scale-110 ring-2 ring-blue-400'
                          : 'border-slate-600 hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* If Patch Panel: Row & Points per Row Editor */}
              {selectedDevice.category === 'patchpanel' && (
                <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-800/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-blue-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span>Filas y Puntos del Patch Panel</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const currentRows =
                          selectedDevice.portsPerRow &&
                          selectedDevice.portsPerRow.length > 0
                            ? [...selectedDevice.portsPerRow]
                            : [selectedDevice.ports.length];
                        if (currentRows.length < 4) {
                          handleReconfigurePatchPanelRows(selectedDevice, [
                            ...currentRows,
                            12
                          ]);
                        }
                      }}
                      className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-medium cursor-pointer whitespace-nowrap shrink-0"
                    >
                      + Añadir Fila
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {(selectedDevice.portsPerRow &&
                    selectedDevice.portsPerRow.length > 0
                      ? selectedDevice.portsPerRow
                      : [selectedDevice.ports.length]
                    ).map((pts, idx, arr) => (
                      <div
                        key={`pp-row-edit-${idx}`}
                        className="flex items-center justify-between gap-2 bg-slate-900/90 px-2.5 py-1.5 rounded border border-slate-800"
                      >
                        <span className="font-mono text-[11px] text-slate-300">
                          Fila {idx + 1} (Puntos):
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={48}
                            value={pts}
                            onChange={(e) => {
                              const val = Math.max(
                                1,
                                Math.min(48, Number(e.target.value) || 1)
                              );
                              const nextRows = [...arr];
                              nextRows[idx] = val;
                              handleReconfigurePatchPanelRows(
                                selectedDevice,
                                nextRows
                              );
                            }}
                            className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white text-center"
                          />
                          {arr.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextRows = arr.filter((_, i) => i !== idx);
                                handleReconfigurePatchPanelRows(
                                  selectedDevice,
                                  nextRows
                                );
                              }}
                              className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                              title="Quitar esta fila"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add / Remove Extra Ports on Any Device */}
              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-200">
                    Ampliar o Quitar Puertos ({selectedDevice.ports.length} actuales)
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveLastPortFromDevice}
                    className="text-[10px] font-mono text-red-400 hover:text-red-300 underline cursor-pointer"
                  >
                    -1 Puerto
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Cant.
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={addPortQty}
                      onChange={(e) =>
                        setAddPortQty(
                          Math.max(1, Math.min(24, Number(e.target.value) || 1))
                        )
                      }
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Tipo
                    </label>
                    <select
                      value={addPortType}
                      onChange={(e) => setAddPortType(e.target.value as PortType)}
                      className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                    >
                      <option value="rj45">RJ45 GbE</option>
                      <option value="sfp">SFP+ Fibra</option>
                      <option value="keystone">Keystone</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Fila
                    </label>
                    <select
                      value={addPortRow}
                      onChange={(e) => setAddPortRow(Number(e.target.value))}
                      className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white"
                    >
                      <option value={1}>Fila 1</option>
                      <option value={2}>Fila 2</option>
                      <option value={3}>Fila 3</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={addPortPrefix}
                    onChange={(e) => setAddPortPrefix(e.target.value)}
                    placeholder="Prefijo (ej. GE, WAN, P)"
                    className="flex-1 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddPortsToSelectedDevice}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Añadir Puertos</span>
                  </button>
                </div>
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
                          d.id === selectedDevice.id
                            ? { ...d, ipAddress: val }
                            : d
                        )
                      });
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Altura en Rack (U)
                  </label>
                  <select
                    value={selectedDevice.uSize}
                    onChange={(e) => {
                      const newU = Number(e.target.value);
                      if (
                        isURangeAvailable(
                          selectedDevice.uStart,
                          newU,
                          selectedDevice.id
                        )
                      ) {
                        onUpdateRack({
                          ...rack,
                          devices: rack.devices.map((d) =>
                            d.id === selectedDevice.id
                              ? { ...d, uSize: newU }
                              : d
                          )
                        });
                      } else {
                        showNotice(
                          `No hay espacio libre encima de U${selectedDevice.uStart} para ampliar a ${newU}U.`
                        );
                      }
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value={1}>1U</option>
                    <option value={2}>2U</option>
                    <option value={3}>3U</option>
                    <option value={4}>4U</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Notas Técnicas / Servicio
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

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">Estado Operativo:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateRack({
                        ...rack,
                        devices: rack.devices.map((d) =>
                          d.id === selectedDevice.id
                            ? { ...d, status: 'nominal' }
                            : d
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
                          d.id === selectedDevice.id
                            ? { ...d, status: 'warning' }
                            : d
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
              Seleccione cualquier dispositivo en el rack para personalizar su color, agregar puertos o configurar filas.
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

          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
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

      {/* =================================================================== */}
      {/* MODAL 1: PATCH PANEL ROWS & POINTS PER ROW CONFIGURATOR             */}
      {/* =================================================================== */}
      {patchPanelPending && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="px-5 py-4 bg-[#0D1322] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h3 className="font-display text-sm font-bold text-white">
                  Configurar Filas y Puntos del Patch Panel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPatchPanelPending(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleConfirmPatchPanelInstall}
              className="p-5 space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Nombre / Etiqueta del Patch Panel (Posición U{patchPanelPending.targetU})
                </label>
                <input
                  type="text"
                  required
                  value={patchPanelPending.customName}
                  onChange={(e) =>
                    setPatchPanelPending({
                      ...patchPanelPending,
                      customName: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  ¿Cuántas filas tiene este Patch Panel?
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((rCount) => (
                    <button
                      key={rCount}
                      type="button"
                      onClick={() => {
                        const nextPoints: number[] = [];
                        for (let i = 0; i < rCount; i++) {
                          nextPoints.push(
                            patchPanelPending.pointsPerRow[i] || 24
                          );
                        }
                        setPatchPanelPending({
                          ...patchPanelPending,
                          rowCount: rCount,
                          pointsPerRow: nextPoints
                        });
                      }}
                      className={`py-2 rounded-lg font-mono font-bold border cursor-pointer ${
                        patchPanelPending.rowCount === rCount
                          ? 'bg-blue-600 text-white border-blue-400'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {rCount} {rCount === 1 ? 'Fila' : 'Filas'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-slate-300 font-medium">
                  ¿Cuántos puntos (tomas RJ45 / Fibra) tiene cada fila?
                </label>
                {patchPanelPending.pointsPerRow.map((pts, idx) => (
                  <div
                    key={`modal-row-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800"
                  >
                    <span className="font-mono text-slate-200">
                      Fila #{idx + 1}:
                    </span>
                    <div className="flex items-center gap-2">
                      {[8, 12, 16, 24].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            const copy = [...patchPanelPending.pointsPerRow];
                            copy[idx] = preset;
                            setPatchPanelPending({
                              ...patchPanelPending,
                              pointsPerRow: copy
                            });
                          }}
                          className={`px-2 py-1 rounded font-mono text-[11px] cursor-pointer ${
                            pts === preset
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {preset}p
                        </button>
                      ))}
                      <input
                        type="number"
                        min={1}
                        max={48}
                        value={pts}
                        onChange={(e) => {
                          const val = Math.max(
                            1,
                            Math.min(48, Number(e.target.value) || 1)
                          );
                          const copy = [...patchPanelPending.pointsPerRow];
                          copy[idx] = val;
                          setPatchPanelPending({
                            ...patchPanelPending,
                            pointsPerRow: copy
                          });
                        }}
                        className="w-14 px-2 py-1 bg-slate-950 border border-slate-700 rounded font-mono text-white text-center"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Color del Chasis del Patch Panel
                </label>
                <div className="flex flex-wrap gap-2">
                  {DEVICE_COLOR_PALETTE.map((sw) => (
                    <button
                      key={sw.id}
                      type="button"
                      onClick={() =>
                        setPatchPanelPending({
                          ...patchPanelPending,
                          colorHex: sw.hex
                        })
                      }
                      style={{ backgroundColor: sw.hex }}
                      title={sw.name}
                      className={`w-6 h-6 rounded-md border cursor-pointer ${
                        patchPanelPending.colorHex === sw.hex
                          ? 'border-white scale-110 ring-2 ring-blue-400'
                          : 'border-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPatchPanelPending(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer"
                >
                  Montar Patch Panel (
                  {patchPanelPending.pointsPerRow.reduce((a, b) => a + b, 0)}{' '}
                  Puntos)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: CUSTOM DEVICE BUILDER (ANY BRAND, PORTS, ROWS, COLOR)      */}
      {/* =================================================================== */}
      {showCustomBuilder && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111827] border border-slate-700 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="px-5 py-4 bg-[#0D1322] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <h3 className="font-display text-sm font-bold text-white">
                  Crear Dispositivo Personalizado a Medida
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomBuilder(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateCustomDevice}
              className="p-5 space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Nombre / Hostname en Rack
                  </label>
                  <input
                    type="text"
                    required
                    value={customDevName}
                    onChange={(e) => setCustomDevName(e.target.value)}
                    placeholder="Ej. ROUTER-MOVISTAR-HGU"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Marca y Modelo
                  </label>
                  <input
                    type="text"
                    required
                    value={customDevBrand}
                    onChange={(e) => setCustomDevBrand(e.target.value)}
                    placeholder="Ej. Movistar HGU Askey"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Categoría
                  </label>
                  <select
                    value={customDevCategory}
                    onChange={(e) =>
                      setCustomDevCategory(e.target.value as DeviceCategory)
                    }
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="firewall">Firewall</option>
                    <option value="router">Router / Operador</option>
                    <option value="switch">Switch</option>
                    <option value="patchpanel">Patch Panel</option>
                    <option value="server">Servidor / NAS</option>
                    <option value="ups">SAI / PDU</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Posición U Inicial
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={rack.totalU}
                    value={customDevUStart}
                    onChange={(e) =>
                      setCustomDevUStart(Number(e.target.value) || 1)
                    }
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Altura Chasis (U)
                  </label>
                  <select
                    value={customDevUSize}
                    onChange={(e) => setCustomDevUSize(Number(e.target.value))}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  >
                    <option value={1}>1U</option>
                    <option value={2}>2U</option>
                    <option value={3}>3U</option>
                    <option value={4}>4U</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Puertos RJ45 / Tomas
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={96}
                    value={customDevRj45}
                    onChange={(e) =>
                      setCustomDevRj45(
                        Math.max(0, Math.min(96, Number(e.target.value) || 0))
                      )
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Puertos SFP+ (Fibra)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={customDevSfp}
                    onChange={(e) =>
                      setCustomDevSfp(
                        Math.max(0, Math.min(24, Number(e.target.value) || 0))
                      )
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Filas de Puertos
                  </label>
                  <select
                    value={customDevRows}
                    onChange={(e) => setCustomDevRows(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                  >
                    <option value={1}>1 Fila</option>
                    <option value={2}>2 Filas</option>
                    <option value={3}>3 Filas</option>
                    <option value={4}>4 Filas</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Dirección IP / Gestión
                  </label>
                  <input
                    type="text"
                    value={customDevIp}
                    onChange={(e) => setCustomDevIp(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Consumo Eléctrico (W)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={3000}
                    value={customDevWatts}
                    onChange={(e) =>
                      setCustomDevWatts(Number(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-300 font-medium">
                    Color del Dispositivo en el Rack
                  </label>
                  <input
                    type="color"
                    value={customDevColor}
                    onChange={(e) => setCustomDevColor(e.target.value)}
                    className="w-7 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {DEVICE_COLOR_PALETTE.map((sw) => (
                    <button
                      key={sw.id}
                      type="button"
                      onClick={() => setCustomDevColor(sw.hex)}
                      style={{ backgroundColor: sw.hex }}
                      title={sw.name}
                      className={`w-6 h-6 rounded-md border cursor-pointer ${
                        customDevColor === sw.hex
                          ? 'border-white scale-110 ring-2 ring-blue-400'
                          : 'border-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCustomBuilder(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer"
                >
                  Instalar Dispositivo en Rack
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
