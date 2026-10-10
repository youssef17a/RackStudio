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
  Eye,
  EyeOff,
  X,
  FileDown,
  Search,
  Sliders,
  Palette,
  Layers,
  ArrowUpDown
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
  PortZone,
  DevicePort,
  PortNumberingOrder,
  CustomPortBlockSpec
} from '../types';
import {
  HARDWARE_CATALOG,
  CABLE_COLORS,
  CATEGORY_LABELS,
  DEVICE_COLOR_PALETTE,
  PORT_TYPE_META,
  createDeviceFromTemplate,
  createDeviceFromPortBlocks,
  getOrganizedDeviceZones
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
  numberingOrder: PortNumberingOrder;
  colorHex: string;
}

interface HoverCableOrPortInfo {
  text: string;
  subtext: string;
  colorHex?: string;
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
  const [hoveredCableId, setHoveredCableId] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverCableOrPortInfo | null>(null);
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

  // Custom Device Builder Modal State (Multi-Zone Faceplate Designer)
  const [showCustomBuilder, setShowCustomBuilder] = useState<boolean>(false);
  const [customDevName, setCustomDevName] = useState('EQUIPO-A-MEDIDA-01');
  const [customDevBrand, setCustomDevBrand] = useState('Fortinet / Cisco / Movistar');
  const [customDevCategory, setCustomDevCategory] = useState<DeviceCategory>('router');
  const [customDevUStart, setCustomDevUStart] = useState<number>(10);
  const [customDevUSize, setCustomDevUSize] = useState<number>(1);
  const [customDevColor, setCustomDevColor] = useState<string>('#0369A1');
  const [customDevIp, setCustomDevIp] = useState<string>('192.168.1.1/24');
  const [customDevWatts, setCustomDevWatts] = useState<number>(45);
  const [customDevNumbering, setCustomDevNumbering] =
    useState<PortNumberingOrder>('vertical-odd-even');
  const [customPortBlocks, setCustomPortBlocks] = useState<CustomPortBlockSpec[]>([
    {
      id: 'blk-1',
      labelPrefix: 'CON',
      type: 'console',
      count: 1,
      zone: 'left',
      rows: 1
    },
    {
      id: 'blk-2',
      labelPrefix: 'USB',
      type: 'usb',
      count: 1,
      zone: 'left',
      rows: 1
    },
    {
      id: 'blk-3',
      labelPrefix: 'WAN',
      type: 'pon',
      count: 1,
      zone: 'center',
      rows: 1
    },
    {
      id: 'blk-4',
      labelPrefix: 'LAN',
      type: 'rj45',
      count: 8,
      zone: 'right',
      rows: 1
    },
    {
      id: 'blk-5',
      labelPrefix: 'SFP+',
      type: 'sfp',
      count: 2,
      zone: 'right',
      rows: 1
    }
  ]);

  // Add Extra Ports to Mounted Device State
  const [addPortQty, setAddPortQty] = useState<number>(1);
  const [addPortType, setAddPortType] = useState<PortType>('rj45');
  const [addPortPrefix, setAddPortPrefix] = useState<string>('GE');
  const [addPortZone, setAddPortZone] = useState<PortZone>('right');
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
        numberingOrder: template.defaultNumberingOrder || 'sequential',
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

    const {
      template,
      targetU,
      customName,
      pointsPerRow,
      numberingOrder,
      colorHex
    } = patchPanelPending;
    const newDevice = createDeviceFromTemplate(
      template,
      targetU,
      undefined,
      pointsPerRow,
      colorHex,
      numberingOrder
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
    const validBlocks = customPortBlocks.filter((b) => b.count > 0);
    const { ports } = createDeviceFromPortBlocks(
      devId,
      validBlocks.length > 0
        ? validBlocks
        : [
            {
              id: 'default-blk',
              labelPrefix: 'GE',
              type: 'rj45',
              count: 8,
              zone: 'right',
              rows: 1
            }
          ]
    );

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
      notes: `Dispositivo personalizado con ${ports.length} puertos distribuidos en zonas.`,
      customColor: customDevColor,
      portNumberingOrder: customDevNumbering,
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

  const applyCustomBuilderPreset = (
    presetType: 'ont' | 'firewall' | 'switch24' | 'switch48' | 'pbx' | 'server'
  ) => {
    if (presetType === 'ont') {
      setCustomDevCategory('ont');
      setCustomDevBrand('Movistar / Huawei ONT');
      setCustomDevName('ONT-FIBRA-01');
      setCustomDevColor('#0369A1');
      setCustomPortBlocks([
        { id: 'p1', labelPrefix: 'PON', type: 'pon', count: 1, zone: 'left', rows: 1 },
        { id: 'p2', labelPrefix: 'TEL', type: 'fxs', count: 2, zone: 'left', rows: 1 },
        { id: 'p3', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'center', rows: 1 },
        { id: 'p4', labelPrefix: 'LAN', type: 'rj45', count: 4, zone: 'right', rows: 1 }
      ]);
    } else if (presetType === 'firewall') {
      setCustomDevCategory('firewall');
      setCustomDevBrand('Fortinet FortiGate');
      setCustomDevName('FW-FORTIGATE-01');
      setCustomDevColor('#7F1D1D');
      setCustomPortBlocks([
        { id: 'p1', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
        { id: 'p2', labelPrefix: 'CON', type: 'console', count: 1, zone: 'left', rows: 1 },
        { id: 'p3', labelPrefix: 'WAN', type: 'rj45', count: 2, zone: 'center', rows: 1 },
        { id: 'p4', labelPrefix: 'DMZ', type: 'rj45', count: 1, zone: 'center', rows: 1 },
        { id: 'p5', labelPrefix: 'LAN', type: 'rj45', count: 8, zone: 'right', rows: 1 },
        { id: 'p6', labelPrefix: 'SFP+', type: 'sfp', count: 2, zone: 'right', rows: 1 }
      ]);
    } else if (presetType === 'switch24') {
      setCustomDevCategory('switch');
      setCustomDevBrand('Cisco / Aruba Switch');
      setCustomDevName('SW-ACCESO-24P');
      setCustomDevColor('#065F46');
      setCustomPortBlocks([
        { id: 'p1', labelPrefix: 'CON', type: 'console', count: 1, zone: 'left', rows: 1 },
        { id: 'p2', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
        { id: 'p3', labelPrefix: 'GE', type: 'rj45', count: 24, zone: 'center', rows: 2 },
        { id: 'p4', labelPrefix: 'SFP+', type: 'sfp', count: 4, zone: 'right', rows: 2 }
      ]);
    } else if (presetType === 'switch48') {
      setCustomDevCategory('switch');
      setCustomDevBrand('Cisco / Ubiquiti 48P');
      setCustomDevName('SW-CORE-48P');
      setCustomDevColor('#065F46');
      setCustomPortBlocks([
        { id: 'p1', labelPrefix: 'CON', type: 'console', count: 1, zone: 'left', rows: 1 },
        { id: 'p2', labelPrefix: 'GE', type: 'rj45', count: 48, zone: 'center', rows: 4 },
        { id: 'p3', labelPrefix: 'SFP+', type: 'sfp', count: 4, zone: 'right', rows: 2 }
      ]);
    } else if (presetType === 'pbx') {
      setCustomDevCategory('pbx');
      setCustomDevBrand('Grandstream / Yeastar PBX');
      setCustomDevName('PBX-CENTRALITA-01');
      setCustomDevColor('#312E81');
      setCustomPortBlocks([
        { id: 'p1', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
        { id: 'p2', labelPrefix: 'FXS', type: 'fxs', count: 4, zone: 'center', rows: 1 },
        { id: 'p3', labelPrefix: 'FXO', type: 'fxs', count: 4, zone: 'center', rows: 1 },
        { id: 'p4', labelPrefix: 'NET', type: 'rj45', count: 3, zone: 'right', rows: 1 }
      ]);
    } else if (presetType === 'server') {
      setCustomDevCategory('server');
      setCustomDevBrand('Dell / HPE Server');
      setCustomDevName('SRV-UBUNTU-01');
      setCustomDevColor('#1E293B');
      setCustomPortBlocks([
        { id: 'p1', labelPrefix: 'iDRAC', type: 'console', count: 1, zone: 'left', rows: 1 },
        { id: 'p2', labelPrefix: 'USB', type: 'usb', count: 2, zone: 'left', rows: 1 },
        { id: 'p3', labelPrefix: 'eno', type: 'rj45', count: 4, zone: 'center', rows: 1 },
        { id: 'p4', labelPrefix: '10G', type: 'sfp', count: 2, zone: 'right', rows: 1 }
      ]);
    }
  };

  const handleAddPortsToSelectedDevice = () => {
    if (!selectedDevice || addPortQty < 1) return;
    const currentPorts = selectedDevice.ports;
    const nextStartNumber =
      currentPorts.reduce((max, p) => Math.max(max, p.number), 0) + 1;

    const addedPorts: DevicePort[] = [];
    for (let i = 0; i < addPortQty; i++) {
      const num = nextStartNumber + i;
      const defaultSingleLabel =
        addPortQty === 1 && !/\d$/.test(addPortPrefix.trim())
          ? addPortPrefix.trim() || 'P'
          : `${addPortPrefix.trim() || 'P'}${num.toString().padStart(2, '0')}`;
      addedPorts.push({
        id: `${selectedDevice.id}-extra-${Date.now()}-${i}`,
        number: num,
        label: defaultSingleLabel,
        type: addPortType,
        zone: addPortZone,
        row: addPortRow,
        vlan: addPortType === 'sfp' ? 'Trunk' : '1',
        speed:
          addPortType === 'sfp'
            ? '10G'
            : addPortType === 'pon'
            ? '2.5G GPON'
            : addPortType === 'console'
            ? '115200 bps'
            : addPortType === 'usb'
            ? 'USB 3.0'
            : '1G'
      });
    }

    const updatedPorts = [...currentPorts, ...addedPorts];
    const updatedDevice: RackDevice = {
      ...selectedDevice,
      ports: updatedPorts
    };

    onUpdateRack({
      ...rack,
      devices: rack.devices.map((d) =>
        d.id === selectedDevice.id ? updatedDevice : d
      )
    });
    showNotice(
      `Añadido(s) ${addPortQty} puerto(s) (${PORT_TYPE_META[addPortType].shortTag}) en zona ${
        addPortZone === 'left'
          ? 'Izquierda'
          : addPortZone === 'center'
          ? 'Centro'
          : 'Derecha'
      } de ${selectedDevice.name}`
    );
  };

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

    const updatedPorts = selectedDevice.ports.slice(0, -1);
    const updatedDevice: RackDevice = {
      ...selectedDevice,
      ports: updatedPorts
    };
    onUpdateRack({
      ...rack,
      devices: rack.devices.map((d) =>
        d.id === selectedDevice.id ? updatedDevice : d
      )
    });
  };

  const handleReconfigureDeviceRows = (
    device: RackDevice,
    newRowPoints: number[]
  ) => {
    const newPorts: DevicePort[] = [];
    const prefix =
      device.category === 'patchpanel'
        ? 'P'
        : device.category === 'server'
        ? 'eno'
        : 'GE';
    let counter = 1;
    newRowPoints.forEach((pts, rIdx) => {
      const rowNum = rIdx + 1;
      for (let i = 1; i <= pts; i++) {
        const existingPort = device.ports[counter - 1];
        newPorts.push({
          id: existingPort ? existingPort.id : `${device.id}-p${counter}`,
          number: counter,
          label: existingPort
            ? existingPort.label
            : `${prefix}${counter.toString().padStart(2, '0')}`,
          type: existingPort
            ? existingPort.type
            : device.category === 'patchpanel'
            ? 'keystone'
            : 'rj45',
          zone: existingPort?.zone || 'right',
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
      `Actualizado ${device.name}: ${newRowPoints.length} fila(s) (${newRowPoints.join(' + ')} puertos)`
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
        fromDesc: `[U${fromDev?.uStart}] ${fromDev?.name || ''} : ${fromPort?.label || ''} (#${fromPort?.number})`,
        toDesc: `[U${toDev?.uStart}] ${toDev?.name || ''} : ${toPort?.label || ''} (#${toPort?.number})`
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

  // Helper to render a single port button with distinct styling per port type (PON, USB, Console, SFP+, FXS, RJ45, Power)
  const renderPortButton = (dev: RackDevice, port: DevicePort, rowLen: number) => {
    const connCable = getCableForPort(port.id);
    const isPending = pendingPort?.portId === port.id;
    const isHoveredCablePort = connCable && hoveredCableId === connCable.id;
    const portColorHex = connCable ? COLOR_HEX_MAP[connCable.color] : undefined;

    const isDefaultNumeric = /^(GE|P|PORT|eno)\d+$/i.test(port.label);
    const showShortText =
      !isDefaultNumeric ||
      port.type === 'console' ||
      port.type === 'usb' ||
      port.type === 'pon' ||
      port.type === 'fxs';

    const displayTag = showShortText
      ? port.label.substring(0, 4)
      : port.number.toString().padStart(2, '0');

    const typeStyle =
      port.type === 'pon'
        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/90 hover:bg-emerald-900'
        : port.type === 'console'
        ? 'bg-sky-950/90 text-sky-300 border-sky-500/80 hover:bg-sky-900'
        : port.type === 'usb'
        ? 'bg-indigo-950/90 text-indigo-300 border-indigo-500/80 hover:bg-indigo-900'
        : port.type === 'fxs'
        ? 'bg-purple-950/90 text-purple-300 border-purple-500/80 hover:bg-purple-900'
        : port.type === 'sfp'
        ? 'bg-slate-950 text-cyan-300 border-cyan-700/90 hover:border-cyan-300 hover:bg-cyan-950/60'
        : port.type === 'power'
        ? 'bg-amber-950/80 text-amber-300 border-amber-600/80 hover:bg-amber-900'
        : port.type === 'keystone'
        ? 'bg-slate-950 text-slate-300 border-slate-700 hover:border-blue-400 hover:bg-slate-800'
        : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-blue-400 hover:bg-slate-800';

    return (
      <button
        key={port.id}
        ref={(el) => {
          portRefs.current[port.id] = el;
        }}
        type="button"
        title={`Puerto #${port.number} [${port.label}] — ${PORT_TYPE_META[port.type]?.label || port.type}`}
        onMouseEnter={() => {
          if (connCable) {
            setHoveredCableId(connCable.id);
            const fromD = rack.devices.find((d) => d.id === connCable.fromDeviceId);
            const fromP = fromD?.ports.find((p) => p.id === connCable.fromPortId);
            const toD = rack.devices.find((d) => d.id === connCable.toDeviceId);
            const toP = toD?.ports.find((p) => p.id === connCable.toPortId);
            setHoverInfo({
              text: `${connCable.label}: [U${fromD?.uStart}] ${fromD?.name} (${fromP?.label} #${fromP?.number}) ⟷ [U${toD?.uStart}] ${toD?.name} (${toP?.label} #${toP?.number})`,
              subtext: `${connCable.category} · ${connCable.vlan} · ${connCable.lengthMeters}m`,
              colorHex: COLOR_HEX_MAP[connCable.color]
            });
          } else {
            setHoveredCableId(null);
            setHoverInfo({
              text: `Puerto #${port.number} [${port.label}] (${PORT_TYPE_META[port.type]?.shortTag || port.type.toUpperCase()}) — [U${dev.uStart}] ${dev.name}`,
              subtext: `Libre · clic para conectar cable`
            });
          }
        }}
        onMouseLeave={() => {
          setHoveredCableId(null);
          setHoverInfo(null);
        }}
        onClick={(e) => handlePortClick(e, dev, port.id, port.label)}
        style={
          connCable
            ? {
                backgroundColor: portColorHex,
                borderColor: '#ffffff'
              }
            : undefined
        }
        className={`h-[19px] ${
          rowLen > 16
            ? 'w-[17px] text-[8px]'
            : showShortText
            ? 'min-w-[22px] px-1 text-[8px]'
            : 'w-[21px] text-[9px]'
        } rounded-[3px] font-mono font-bold flex items-center justify-center border transition-colors cursor-pointer tabular-nums shrink-0 truncate ${
          isPending || isHoveredCablePort
            ? 'bg-amber-500 text-slate-950 border-white ring-2 ring-amber-300 z-40'
            : connCable
            ? 'text-white shadow-sm hover:brightness-125'
            : typeStyle
        }`}
      >
        {displayTag}
      </button>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 p-4 lg:p-6 max-w-[1840px] mx-auto items-start">
      {/* =================================================================== */}
      {/* LEFT PANEL (3 COLS): EXPANDED CATALOG + CUSTOM DEVICE + PATCHING    */}
      {/* =================================================================== */}
      <div className="xl:col-span-3 space-y-5">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="font-display text-sm font-bold text-white">
                Catálogo de Equipos y Marcas
              </h2>
              <p className="text-[11px] text-slate-400">
                ONTs, Routers, Switches 4-52p, Firewalls, PBX, NVR...
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
              <span>+ Diseñar Equipo</span>
            </button>
          </div>

          <div className="relative mb-2.5">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Buscar (ONT, Movistar, Fortinet, 48p, PBX, NVR...)"
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-1 p-1 bg-slate-900 rounded-lg mb-3 border border-slate-800/80">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'ont', label: 'ONT / Fibra ISP' },
                { id: 'router', label: 'Router' },
                { id: 'firewall', label: 'Firewall' },
                { id: 'switch', label: 'Switch (4-52p)' },
                { id: 'patchpanel', label: 'Patch Panel' },
                { id: 'pbx', label: 'PBX VoIP' },
                { id: 'nvr', label: 'CCTV NVR' },
                { id: 'server', label: 'Server/NAS' },
                { id: 'ups', label: 'SAI/PDU' }
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCatalogFilter(tab.id)}
                className={`px-2 py-1 text-[10px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  catalogFilter === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

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
                        {tpl.portBlocks
                          ? tpl.portBlocks.reduce((s, b) => s + b.count, 0)
                          : tpl.defaultPorts + (tpl.sfpUplinks || 0)}{' '}
                        puertos
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                      {tpl.description}
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

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Color del Cable
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
                  Tipo de Cable
                </label>
                <select
                  value={activeCableCategory}
                  onChange={(e) => setActiveCableCategory(e.target.value as CableCategory)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Cat6A">Cat6A RJ45</option>
                  <option value="Cat6">Cat6 UTP</option>
                  <option value="Fibra OM4">Fibra OM4 LC</option>
                  <option value="Fibra OS2 PON">Fibra OS2 SC/APC PON</option>
                  <option value="DAC 10G">DAC SFP+ 10G</option>
                  <option value="Consola Serial">Consola Serial RS232</option>
                  <option value="Teléfono RJ11">Línea Voz RJ11</option>
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
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* CENTER PANEL (6 COLS WIDE): INTERACTIVE 42U 19" RACK + PATCH CABLES */}
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

        {/* Fixed-Height Status & Live Hover HUD Strip (Never shifts rack vertically on hover) */}
        <div className="min-h-[44px] flex items-center">
          {pendingPort ? (
            <div className="w-full p-2.5 px-3.5 rounded-xl bg-blue-950/95 border border-blue-500/80 flex items-center justify-between gap-3">
              <div className="text-xs text-blue-100 flex items-center gap-2 min-w-0">
                <Cable className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate">
                  Origen:{' '}
                  <strong className="font-mono text-white">
                    {pendingPort.deviceName} [{pendingPort.portLabel}]
                  </strong>{' '}
                  — Pulse sobre el puerto destino para tirar el cable.
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
          ) : hoverInfo ? (
            <div className="w-full p-2.5 px-3.5 rounded-xl bg-slate-900/95 border border-amber-500/80 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {hoverInfo.colorHex && (
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: hoverInfo.colorHex }}
                  />
                )}
                <span className="font-mono font-bold text-white truncate">
                  {hoverInfo.text}
                </span>
              </div>
              <span className="font-mono text-[11px] text-amber-300 shrink-0">
                {hoverInfo.subtext}
              </span>
            </div>
          ) : feedbackBanner ? (
            <div className="w-full p-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 flex items-center justify-between">
              <span className="truncate">{feedbackBanner}</span>
              <button
                type="button"
                onClick={() => setFeedbackBanner(null)}
                className="text-slate-400 hover:text-white shrink-0 ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="w-full p-2.5 px-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-2 truncate">
                <Cable className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>
                  Leyenda Puertos: <strong className="text-emerald-400 font-mono">PON</strong> Fibra ISP ·{' '}
                  <strong className="text-sky-400 font-mono">CON</strong> Consola Serie ·{' '}
                  <strong className="text-indigo-400 font-mono">USB</strong> ·{' '}
                  <strong className="text-purple-400 font-mono">TEL</strong> RJ11 Voz ·{' '}
                  <strong className="text-cyan-400 font-mono">SFP+</strong> 10G
                </span>
              </span>
              <span className="font-mono text-[11px] text-slate-500 shrink-0">
                EIA-310-D
              </span>
            </div>
          )}
        </div>

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
                  hoveredCableId === cab.id ||
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
                      stroke="transparent"
                      strokeWidth={10}
                      className="pointer-events-auto cursor-pointer"
                      onMouseEnter={() => {
                        setHoveredCableId(cab.id);
                        setHoverInfo({
                          text: `${cab.label}: ${cab.fromDesc} ⟷ ${cab.toDesc}`,
                          subtext: `${cab.category} · ${cab.vlan}`,
                          colorHex: cab.colorHex
                        });
                      }}
                      onMouseLeave={() => {
                        setHoveredCableId(null);
                        setHoverInfo(null);
                      }}
                      onClick={() => setSelectedCableId(cab.id)}
                    />
                    <path
                      d={dPath}
                      fill="none"
                      stroke="#090D16"
                      strokeWidth={isSelected ? 6 : 4}
                      strokeLinecap="round"
                      opacity={0.85}
                    />
                    <path
                      d={dPath}
                      fill="none"
                      stroke={cab.colorHex}
                      strokeWidth={isSelected ? 3.5 : 2.1}
                      strokeLinecap="round"
                      opacity={isSelected ? 1 : 0.85}
                    />
                    <circle
                      cx={cab.x1}
                      cy={cab.y1}
                      r={isSelected ? 4.5 : 3}
                      fill={cab.colorHex}
                      stroke="#090D16"
                      strokeWidth={1}
                    />
                    <circle
                      cx={cab.x2}
                      cy={cab.y2}
                      r={isSelected ? 4.5 : 3}
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
          <div className="divide-y divide-slate-800/70 border border-slate-800 rounded bg-[#090D16] overflow-hidden">
            {Array.from({ length: rack.totalU }, (_, i) => rack.totalU - i).map(
              (uNumber) => {
                const slotInfo = uSlotMap[uNumber];

                if (slotInfo && slotInfo.type === 'covered') {
                  return null;
                }

                if (slotInfo && slotInfo.type === 'start_top') {
                  const dev = slotInfo.device;
                  const isSelected = selectedDeviceId === dev.id;
                  const { leftRows, centerRows, rightRows, maxRows } =
                    getOrganizedDeviceZones(dev);

                  const rowHeightPx = Math.max(
                    dev.uSize * 38,
                    maxRows * 24 + 14
                  );

                  const shortBrand = dev.model
                    .split('/')[0]
                    .trim()
                    .split(' ')[0];

                  const defaultCategoryColor =
                    dev.category === 'firewall'
                      ? '#7F1D1D'
                      : dev.category === 'router' || dev.category === 'ont'
                      ? '#0369A1'
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
                        background: `linear-gradient(90deg, ${activeChassisColor}E6 0%, #0F172A 55%, #0F172A 100%)`
                      }}
                      className={`relative flex items-stretch transition-colors cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-inset ring-blue-400 z-10'
                          : 'hover:brightness-110'
                      }`}
                    >
                      {/* Left Rack Rail */}
                      <div className="w-9 shrink-0 bg-slate-950/90 border-r border-slate-800 flex flex-col items-center justify-center font-mono text-[10px] text-slate-400 tabular-nums">
                        <span>{uNumber.toString().padStart(2, '0')}</span>
                        {dev.uSize > 1 && (
                          <span className="text-[9px] text-slate-600">
                            ..{dev.uStart.toString().padStart(2, '0')}
                          </span>
                        )}
                      </div>

                      {/* Device Chassis Faceplate: Brand + Type Badge + 3 Realistic Zones (Left / Center / Right) */}
                      <div className="flex-1 px-2 py-1.5 flex items-center justify-between gap-2 min-w-0 overflow-hidden">
                        {/* Minimal Brand & Type Badge */}
                        <div
                          className="flex items-center gap-1 shrink-0 w-[86px]"
                          title={`${dev.name} — ${dev.model} (${dev.ipAddress})`}
                        >
                          <GripVertical className="w-3 h-3 text-slate-400 cursor-grab shrink-0" />
                          <div className="min-w-0 leading-tight">
                            <div className="font-mono text-[10px] font-bold text-white truncate">
                              {shortBrand}
                            </div>
                            <div className="text-[8px] font-mono uppercase tracking-wider text-slate-300/90 truncate">
                              {CATEGORY_LABELS[dev.category]}
                            </div>
                          </div>
                        </div>

                        {/* 3-Zone Physical Faceplate Container (Left Auxiliary, Center Main Bank, Right Uplinks/LAN) */}
                        <div className="flex-1 flex items-center justify-between gap-2 z-30 min-w-0">
                          {/* ZONE 1: LEFT PORTS (Console, USB, PON, Mgmt, etc.) */}
                          {leftRows.length > 0 ? (
                            <div className="flex flex-col gap-1 items-start justify-center shrink-0 pr-1.5 border-r border-slate-700/60">
                              {leftRows.map((rPorts, rIdx) => (
                                <div
                                  key={`zleft-${dev.id}-${rIdx}`}
                                  className="flex flex-nowrap items-center gap-[3px]"
                                >
                                  {rPorts.map((p) =>
                                    renderPortButton(dev, p, rPorts.length)
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div />
                          )}

                          {/* ZONE 2: CENTER PORTS (Separated Main Switch Bank / WAN / FXS) */}
                          {centerRows.length > 0 && (
                            <div className="flex flex-col gap-1 items-center justify-center shrink-0 px-1">
                              {centerRows.map((rPorts, rIdx) => (
                                <div
                                  key={`zcenter-${dev.id}-${rIdx}`}
                                  className="flex flex-nowrap items-center gap-[3px]"
                                >
                                  {rPorts.map((p) =>
                                    renderPortButton(dev, p, rPorts.length)
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* ZONE 3: RIGHT PORTS (LAN Ports / SFP+ Uplinks / Patch Panel Row) */}
                          {rightRows.length > 0 && (
                            <div
                              className={`flex flex-col gap-1 items-end justify-center shrink-0 ${
                                centerRows.length > 0
                                  ? 'pl-1.5 border-l border-slate-700/60'
                                  : ''
                              }`}
                            >
                              {rightRows.map((rPorts, rIdx) => (
                                <div
                                  key={`zright-${dev.id}-${rIdx}`}
                                  className="flex flex-nowrap items-center gap-[3px] justify-end"
                                >
                                  {rightRows.length > 1 &&
                                    leftRows.length === 0 &&
                                    centerRows.length === 0 && (
                                      <span className="text-[8px] font-mono text-slate-400 mr-0.5 shrink-0">
                                        F{rIdx + 1}
                                      </span>
                                    )}
                                  {rPorts.map((p) =>
                                    renderPortButton(dev, p, rPorts.length)
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
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
                    <div className="w-9 h-full bg-slate-950/60 border-r border-slate-800/80 flex items-center justify-center font-mono text-[10px] text-slate-600 tabular-nums">
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
      {/* RIGHT PANEL (3 COLS): DEVICE INSPECTOR, ZONES, PORT NAMES & PORTS   */}
      {/* =================================================================== */}
      <div className="xl:col-span-3 space-y-5">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
              {selectedDevice?.category === 'firewall' && (
                <Shield className="w-4 h-4 text-red-400" />
              )}
              {(selectedDevice?.category === 'router' ||
                selectedDevice?.category === 'ont') && (
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

              {/* Port Numbering Order Selector (1 Arriba / 2 Abajo vs Secuencial) */}
              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
                    <span>Orden de Numeración de Puertos</span>
                  </span>
                </div>
                <select
                  value={selectedDevice.portNumberingOrder || 'sequential'}
                  onChange={(e) => {
                    const nextOrder = e.target.value as PortNumberingOrder;
                    let nextRows = selectedDevice.portsPerRow;
                    const regCount = selectedDevice.ports.filter(
                      (p) =>
                        p.type !== 'sfp' ||
                        selectedDevice.category === 'patchpanel'
                    ).length;
                    if (
                      nextOrder !== 'sequential' &&
                      (!nextRows || nextRows.length < 2) &&
                      regCount >= 4
                    ) {
                      const half = Math.ceil(regCount / 2);
                      nextRows = [half, regCount - half];
                    }

                    onUpdateRack({
                      ...rack,
                      devices: rack.devices.map((d) =>
                        d.id === selectedDevice.id
                          ? {
                              ...d,
                              portNumberingOrder: nextOrder,
                              portsPerRow: nextRows
                            }
                          : d
                      )
                    });
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="vertical-odd-even">
                    Vertical: 1 Arriba / 2 Abajo (Impares F1, Pares F2)
                  </option>
                  <option value="sequential">
                    Horizontal Secuencial (Fila 1: 1..12, Fila 2: 13..24)
                  </option>
                  <option value="vertical-even-odd">
                    Vertical Invertido: 2 Arriba / 1 Abajo (Pares F1, Impares F2)
                  </option>
                </select>
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

              {/* Custom Port Names, Zone (Left/Center/Right) & Type Editor */}
              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-200">
                    Nombrar y Posicionar Puertos ({selectedDevice.ports.length})
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Nombre · Zona · Tipo
                  </span>
                </div>
                <div className="max-h-[195px] overflow-y-auto space-y-1.5 pr-1">
                  {selectedDevice.ports.map((p) => (
                    <div
                      key={`rename-port-${p.id}`}
                      className="flex items-center gap-1.5 bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80"
                    >
                      <span className="font-mono text-[10px] text-slate-400 w-7 shrink-0">
                        #{p.number.toString().padStart(2, '0')}
                      </span>
                      <input
                        type="text"
                        value={p.label}
                        onChange={(e) => {
                          const newLabel = e.target.value;
                          onUpdateRack({
                            ...rack,
                            devices: rack.devices.map((d) =>
                              d.id === selectedDevice.id
                                ? {
                                    ...d,
                                    ports: d.ports.map((portItem) =>
                                      portItem.id === p.id
                                        ? { ...portItem, label: newLabel }
                                        : portItem
                                    )
                                  }
                                : d
                            )
                          });
                        }}
                        placeholder={`P${p.number.toString().padStart(2, '0')}`}
                        className="flex-1 min-w-0 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[11px] font-mono text-white focus:outline-none focus:border-blue-500"
                      />
                      <select
                        value={p.zone || 'right'}
                        title="Posición en el frontal del equipo (Izquierda, Centro o Derecha)"
                        onChange={(e) => {
                          const nextZone = e.target.value as PortZone;
                          onUpdateRack({
                            ...rack,
                            devices: rack.devices.map((d) =>
                              d.id === selectedDevice.id
                                ? {
                                    ...d,
                                    ports: d.ports.map((portItem) =>
                                      portItem.id === p.id
                                        ? { ...portItem, zone: nextZone }
                                        : portItem
                                    )
                                  }
                                : d
                            )
                          });
                        }}
                        className="px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-200"
                      >
                        <option value="left">Izq</option>
                        <option value="center">Cen</option>
                        <option value="right">Der</option>
                      </select>
                      <select
                        value={p.type}
                        title="Tipo físico de puerto"
                        onChange={(e) => {
                          const nextType = e.target.value as PortType;
                          onUpdateRack({
                            ...rack,
                            devices: rack.devices.map((d) =>
                              d.id === selectedDevice.id
                                ? {
                                    ...d,
                                    ports: d.ports.map((portItem) =>
                                      portItem.id === p.id
                                        ? { ...portItem, type: nextType }
                                        : portItem
                                    )
                                  }
                                : d
                            )
                          });
                        }}
                        className="px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-cyan-300"
                      >
                        <option value="rj45">RJ45</option>
                        <option value="sfp">SFP+</option>
                        <option value="pon">PON</option>
                        <option value="console">CON</option>
                        <option value="usb">USB</option>
                        <option value="fxs">TEL</option>
                        <option value="keystone">KEY</option>
                        <option value="power">PWR</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add / Remove Extra Ports on Any Device in Any Zone (Left, Center, Right) */}
              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-200">
                    Añadir Puerto en Cualquier Parte ({selectedDevice.ports.length}p)
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
                      Tipo Puerto
                    </label>
                    <select
                      value={addPortType}
                      onChange={(e) => {
                        const t = e.target.value as PortType;
                        setAddPortType(t);
                        if (t === 'console') setAddPortPrefix('CON');
                        else if (t === 'usb') setAddPortPrefix('USB');
                        else if (t === 'pon') setAddPortPrefix('PON');
                        else if (t === 'fxs') setAddPortPrefix('TEL');
                        else if (t === 'sfp') setAddPortPrefix('SFP+');
                        else setAddPortPrefix('GE');
                      }}
                      className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                    >
                      <option value="rj45">RJ45 Ethernet</option>
                      <option value="sfp">SFP+ Fibra</option>
                      <option value="pon">PON Fibra ISP</option>
                      <option value="console">Consola Serie</option>
                      <option value="usb">Puerto USB</option>
                      <option value="fxs">Teléfono RJ11</option>
                      <option value="keystone">Keystone</option>
                      <option value="power">Eléctrico IEC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Posición
                    </label>
                    <select
                      value={addPortZone}
                      onChange={(e) => setAddPortZone(e.target.value as PortZone)}
                      className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white"
                    >
                      <option value="left">Izquierda</option>
                      <option value="center">Centro</option>
                      <option value="right">Derecha</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={addPortPrefix}
                    onChange={(e) => setAddPortPrefix(e.target.value)}
                    placeholder="Nombre (ej. CON, USB, WAN, GE)"
                    className="flex-1 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddPortsToSelectedDevice}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Añadir</span>
                  </button>
                </div>
              </div>

              {/* Row & Points per Row Editor */}
              <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-800/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-blue-200 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span>Filas y Puntos por Fila</span>
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
                        handleReconfigureDeviceRows(selectedDevice, [
                          ...currentRows,
                          12
                        ]);
                      }
                    }}
                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-medium cursor-pointer whitespace-nowrap shrink-0"
                  >
                    + Nueva Fila
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
                        Fila {idx + 1} (Puertos):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={24}
                          value={pts}
                          onChange={(e) => {
                            const val = Math.max(
                              1,
                              Math.min(24, Number(e.target.value) || 1)
                            );
                            const nextRows = [...arr];
                            nextRows[idx] = val;
                            handleReconfigureDeviceRows(
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
                              handleReconfigureDeviceRows(
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
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4 text-center">
              Seleccione cualquier dispositivo en el rack para organizar sus puertos (Izquierda, Centro, Derecha), nombrar puertos o cambiar su color.
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
                    onMouseEnter={() => setHoveredCableId(cab.id)}
                    onMouseLeave={() => setHoveredCableId(null)}
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
      {/* MODAL 1: PATCH PANEL ROWS, POINTS PER ROW & NUMBERING CONFIGURATOR  */}
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
                            patchPanelPending.pointsPerRow[i] || 12
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
                  ¿Cuántos puntos tiene cada fila?
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
                        max={24}
                        value={pts}
                        onChange={(e) => {
                          const val = Math.max(
                            1,
                            Math.min(24, Number(e.target.value) || 1)
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
      {/* MODAL 2: MULTI-ZONE CUSTOM DEVICE DESIGNER (LEFT / CENTER / RIGHT)  */}
      {/* =================================================================== */}
      {showCustomBuilder && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111827] border border-slate-700 rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl my-6">
            <div className="px-5 py-4 bg-[#0D1322] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <div>
                  <h3 className="font-display text-sm font-bold text-white">
                    Diseñador de Dispositivo Personalizado por Zonas
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Coloque puertos en la Izquierda, Centro o Derecha (Consola Serie, USB, Fibra PON, RJ11 Voz, RJ45, SFP+)
                  </p>
                </div>
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
              className="p-5 space-y-4 text-xs"
            >
              {/* Quick Hardware Archetype Presets */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">
                  Plantillas Rápidas de Distribución Física (clic para cargar y personalizar):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'ont', label: 'ONT / Router Fibra (PON Izq + TEL + 4 LAN Der)' },
                    { id: 'firewall', label: 'Firewall (USB/CON Izq + WAN Cen + LAN/SFP Der)' },
                    { id: 'switch24', label: 'Switch 24P (CON Izq + 24 GE Cen + 4 SFP+ Der)' },
                    { id: 'switch48', label: 'Switch 48P (CON Izq + 48 GE Cen + 4 SFP+ Der)' },
                    { id: 'pbx', label: 'Centralita VoIP (USB Izq + FXS/FXO Cen + LAN Der)' },
                    { id: 'server', label: 'Servidor (iDRAC/USB Izq + 4 GbE Cen + 2 SFP+ Der)' }
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        applyCustomBuilderPreset(
                          preset.id as
                            | 'ont'
                            | 'firewall'
                            | 'switch24'
                            | 'switch48'
                            | 'pbx'
                            | 'server'
                        )
                      }
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white border border-slate-700 text-[11px] transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Hostname / Nombre
                  </label>
                  <input
                    type="text"
                    required
                    value={customDevName}
                    onChange={(e) => setCustomDevName(e.target.value)}
                    placeholder="Ej. ONT-MOVISTAR-01"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Marca (Visible en Chasis)
                  </label>
                  <input
                    type="text"
                    required
                    value={customDevBrand}
                    onChange={(e) => setCustomDevBrand(e.target.value)}
                    placeholder="Ej. Movistar / Fortinet / Cisco"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Tipo de Dispositivo
                  </label>
                  <select
                    value={customDevCategory}
                    onChange={(e) =>
                      setCustomDevCategory(e.target.value as DeviceCategory)
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="ont">ONT / Fibra Operador</option>
                    <option value="router">Router Corporativo</option>
                    <option value="firewall">Firewall / NGFW</option>
                    <option value="switch">Switch</option>
                    <option value="patchpanel">Patch Panel</option>
                    <option value="pbx">Centralita VoIP PBX</option>
                    <option value="nvr">Grabador CCTV NVR</option>
                    <option value="server">Servidor / NAS</option>
                    <option value="ups">SAI / PDU</option>
                  </select>
                </div>
              </div>

              {/* Port Blocks Designer by Zone (Left, Center, Right) */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white text-xs">
                      Bloques de Puertos en el Frontal del Dispositivo
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Elija en qué parte del equipo va cada grupo de puertos (Izquierda, Centro o Derecha), su tipo y cantidad.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomPortBlocks([
                        ...customPortBlocks,
                        {
                          id: `blk-${Date.now()}`,
                          labelPrefix: 'GE',
                          type: 'rj45',
                          count: 4,
                          zone: 'right',
                          rows: 1
                        }
                      ])
                    }
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-medium flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Añadir Grupo de Puertos</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[210px] overflow-y-auto pr-1">
                  {customPortBlocks.map((blk, idx) => (
                    <div
                      key={blk.id}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-950 p-2 rounded-lg border border-slate-800"
                    >
                      <div className="col-span-3">
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Posición en Equipo
                        </label>
                        <select
                          value={blk.zone}
                          onChange={(e) => {
                            const next = [...customPortBlocks];
                            next[idx] = {
                              ...blk,
                              zone: e.target.value as PortZone
                            };
                            setCustomPortBlocks(next);
                          }}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white font-medium"
                        >
                          <option value="left">⬅ Izquierda</option>
                          <option value="center">↔ Centro (Separado)</option>
                          <option value="right">➡ Derecha</option>
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Tipo de Puerto
                        </label>
                        <select
                          value={blk.type}
                          onChange={(e) => {
                            const t = e.target.value as PortType;
                            const defaultPref =
                              t === 'console'
                                ? 'CON'
                                : t === 'usb'
                                ? 'USB'
                                : t === 'pon'
                                ? 'PON'
                                : t === 'fxs'
                                ? 'TEL'
                                : t === 'sfp'
                                ? 'SFP+'
                                : t === 'power'
                                ? 'IEC'
                                : 'LAN';
                            const next = [...customPortBlocks];
                            next[idx] = {
                              ...blk,
                              type: t,
                              labelPrefix: defaultPref
                            };
                            setCustomPortBlocks(next);
                          }}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-cyan-300"
                        >
                          <option value="rj45">RJ45 (LAN/WAN)</option>
                          <option value="sfp">SFP / SFP+ Fibra</option>
                          <option value="pon">PON Fibra (Verde)</option>
                          <option value="console">Consola Serie</option>
                          <option value="usb">Puerto USB</option>
                          <option value="fxs">Teléfono RJ11 (FXS)</option>
                          <option value="keystone">Keystone Patch</option>
                          <option value="power">Eléctrico IEC</option>
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Etiqueta
                        </label>
                        <input
                          type="text"
                          value={blk.labelPrefix}
                          onChange={(e) => {
                            const next = [...customPortBlocks];
                            next[idx] = { ...blk, labelPrefix: e.target.value };
                            setCustomPortBlocks(next);
                          }}
                          placeholder="WAN / LAN"
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Cantidad
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={48}
                          value={blk.count}
                          onChange={(e) => {
                            const next = [...customPortBlocks];
                            next[idx] = {
                              ...blk,
                              count: Math.max(
                                1,
                                Math.min(48, Number(e.target.value) || 1)
                              )
                            };
                            setCustomPortBlocks(next);
                          }}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white text-center"
                        />
                      </div>

                      <div className="col-span-1">
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Filas
                        </label>
                        <select
                          value={blk.rows}
                          onChange={(e) => {
                            const next = [...customPortBlocks];
                            next[idx] = {
                              ...blk,
                              rows: Number(e.target.value)
                            };
                            setCustomPortBlocks(next);
                          }}
                          className="w-full px-1 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white"
                        >
                          <option value={1}>1F</option>
                          <option value={2}>2F</option>
                          <option value={4}>4F</option>
                        </select>
                      </div>

                      <div className="col-span-1 flex justify-end pt-4">
                        {customPortBlocks.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setCustomPortBlocks(
                                customPortBlocks.filter((_, i) => i !== idx)
                              )
                            }
                            className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                            title="Quitar bloque"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Posición U
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={rack.totalU}
                    value={customDevUStart}
                    onChange={(e) =>
                      setCustomDevUStart(Number(e.target.value) || 1)
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Altura (U)
                  </label>
                  <select
                    value={customDevUSize}
                    onChange={(e) => setCustomDevUSize(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  >
                    <option value={1}>1U</option>
                    <option value={2}>2U</option>
                    <option value={3}>3U</option>
                    <option value={4}>4U</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    IP Gestión
                  </label>
                  <input
                    type="text"
                    value={customDevIp}
                    onChange={(e) => setCustomDevIp(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Orden Numeración
                  </label>
                  <select
                    value={customDevNumbering}
                    onChange={(e) =>
                      setCustomDevNumbering(e.target.value as PortNumberingOrder)
                    }
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="vertical-odd-even">1 Arriba / 2 Abajo</option>
                    <option value="sequential">Secuencial Fila</option>
                  </select>
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

              <div className="pt-2 flex justify-end gap-2">
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
                  Montar Equipo Personalizado (
                  {customPortBlocks.reduce((acc, b) => acc + b.count, 0)} Puertos)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
