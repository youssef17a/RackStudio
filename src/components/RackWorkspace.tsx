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
  ArrowUpDown,
  Move,
  Columns2,
  Settings2,
  ZoomIn
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
  CustomPortBlockSpec,
  ShelfBay
} from '../types';
import {
  HARDWARE_CATALOG,
  CABLE_COLORS,
  CATEGORY_LABELS,
  DEVICE_COLOR_PALETTE,
  PORT_TYPE_META,
  createDeviceFromTemplate,
  createDeviceFromPortBlocks,
  getOrganizedDeviceZones,
  ensureDevicePortCoordinates
} from '../constants';
import { DeviceZoomEditorModal } from './DeviceZoomEditorModal';

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
  const [zoomedDeviceId, setZoomedDeviceId] = useState<string | null>(null);
  const [selectedCableId, setSelectedCableId] = useState<string | null>(null);
  const [hoveredCableId, setHoveredCableId] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverCableOrPortInfo | null>(null);
  const [showCablesOverlay, setShowCablesOverlay] = useState<boolean>(true);
  const [cableFilterColor, setCableFilterColor] = useState<CableColor | 'all'>('all');

  // Custom Rack Configurator Modal State
  const [showRackCustomizer, setShowRackCustomizer] = useState<boolean>(false);
  const [editRackName, setEditRackName] = useState<string>(rack.name);
  const [editRackCode, setEditRackCode] = useState<string>(rack.locationCode);
  const [editRackTotalU, setEditRackTotalU] = useState<number>(rack.totalU);
  const [editRackWidthMm, setEditRackWidthMm] = useState<number>(rack.widthMm || 600);
  const [editRackDepthMm, setEditRackDepthMm] = useState<number>(rack.depthMm || 800);
  const [editRackType, setEditRackType] = useState<'floor' | 'wall' | 'open-frame' | 'custom'>(
    rack.rackType || 'floor'
  );
  const [editRackPower, setEditRackPower] = useState<number>(rack.maxPowerWatts || 3500);
  const [editRackColor, setEditRackColor] = useState<string>(rack.frameColor || '#0B0F17');
  const [editRackUDir, setEditRackUDir] = useState<'bottom-up' | 'top-down'>(
    rack.uNumberingDirection || 'bottom-up'
  );

  // Sync local rack customizer state when switching active rack
  useEffect(() => {
    setEditRackName(rack.name);
    setEditRackCode(rack.locationCode);
    setEditRackTotalU(rack.totalU);
    setEditRackWidthMm(rack.widthMm || 600);
    setEditRackDepthMm(rack.depthMm || 800);
    setEditRackType(rack.rackType || 'floor');
    setEditRackPower(rack.maxPowerWatts || 3500);
    setEditRackColor(rack.frameColor || '#0B0F17');
    setEditRackUDir(rack.uNumberingDirection || 'bottom-up');
  }, [rack.id]);

  // Graphical Freeform Port Dragging Mode (Directly inside Rack + Custom Builder)
  const [graphicalPortMoveMode, setGraphicalPortMoveMode] = useState<boolean>(false);
  const [draggingRackPort, setDraggingRackPort] = useState<{
    deviceId: string;
    portId: string;
  } | null>(null);
  const faceplateCanvasRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Custom Device Builder Graphical Canvas State
  const [customPreviewPorts, setCustomPreviewPorts] = useState<DevicePort[]>([]);
  const [draggingCustomPortId, setDraggingCustomPortId] = useState<string | null>(null);
  const customCanvasRef = useRef<HTMLDivElement | null>(null);

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
  const [customDevShelfBay, setCustomDevShelfBay] = useState<ShelfBay>('full');
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

  // Checks if a U range is available for a given shelfBay ('full' | 'left' | 'right')
  const isURangeAvailable = (
    uStart: number,
    uSize: number,
    ignoreDeviceId?: string | null,
    targetBay: ShelfBay = 'full'
  ): boolean => {
    const uEnd = uStart + uSize - 1;
    if (uStart < 1 || uEnd > rack.totalU) return false;

    for (const dev of rack.devices) {
      if (ignoreDeviceId && dev.id === ignoreDeviceId) continue;
      const devEnd = dev.uStart + dev.uSize - 1;
      const overlapsU = !(uEnd < dev.uStart || uStart > devEnd);
      if (!overlapsU) continue;

      const existingBay: ShelfBay = dev.shelfBay || 'full';
      if (targetBay === 'full' || existingBay === 'full') {
        return false;
      }
      if (targetBay === existingBay) {
        return false;
      }
    }
    return true;
  };

  const findFirstAvailableUFromTop = (
    uSize: number,
    targetBay: ShelfBay = 'full'
  ): number | null => {
    for (let u = rack.totalU - uSize + 1; u >= 1; u--) {
      if (isURangeAvailable(u, uSize, null, targetBay)) {
        return u;
      }
    }
    return null;
  };

  const handleInstallTemplateAtU = (
    template: HardwareTemplate,
    targetU: number,
    preferredBay?: ShelfBay
  ) => {
    // Check if there is already a single device at targetU that can share the shelf (2 devices on same U!)
    const overlappingDevices = rack.devices.filter((d) => {
      const dEnd = d.uStart + d.uSize - 1;
      const tEnd = targetU + template.uSize - 1;
      return !(tEnd < d.uStart || targetU > dEnd);
    });

    let updatedExistingDevices = [...rack.devices];
    let assignedBay: ShelfBay = preferredBay || 'full';

    if (preferredBay && preferredBay !== 'full') {
      if (!isURangeAvailable(targetU, template.uSize, null, preferredBay)) {
        // If existing is 'full' and single 1U device, convert it to the opposite half-shelf automatically!
        if (
          overlappingDevices.length === 1 &&
          overlappingDevices[0].uStart === targetU &&
          overlappingDevices[0].uSize === template.uSize
        ) {
          const otherBay: ShelfBay = preferredBay === 'left' ? 'right' : 'left';
          updatedExistingDevices = rack.devices.map((d) =>
            d.id === overlappingDevices[0].id ? { ...d, shelfBay: otherBay } : d
          );
          assignedBay = preferredBay;
        } else {
          showNotice(
            `La bandeja ${preferredBay === 'left' ? 'Izquierda' : 'Derecha'} en U${targetU} ya está ocupada.`
          );
          return;
        }
      }
    } else if (!isURangeAvailable(targetU, template.uSize, null, 'full')) {
      // User dropped or installed onto an already occupied U slot!
      // If there's 1 device at that U with the same uSize, automatically place them side-by-side on the same shelf!
      if (
        overlappingDevices.length === 1 &&
        overlappingDevices[0].uStart === targetU &&
        overlappingDevices[0].uSize === template.uSize &&
        template.category !== 'patchpanel'
      ) {
        const existingDev = overlappingDevices[0];
        const existingBay = existingDev.shelfBay || 'full';
        if (existingBay === 'full' || existingBay === 'left') {
          updatedExistingDevices = rack.devices.map((d) =>
            d.id === existingDev.id ? { ...d, shelfBay: 'left' } : d
          );
          assignedBay = 'right';
        } else {
          assignedBay = 'left';
        }
      } else {
        showNotice(
          `No hay espacio libre en U${targetU} (máximo 2 dispositivos en la misma estantería U).`
        );
        return;
      }
    }

    if (template.category === 'patchpanel' && assignedBay === 'full') {
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
    newDevice.shelfBay = assignedBay;

    const updatedRack: RackUnit = {
      ...rack,
      devices: [...updatedExistingDevices, newDevice]
    };
    onUpdateRack(updatedRack);
    setSelectedDeviceId(newDevice.id);
    if (assignedBay !== 'full') {
      showNotice(
        `Compartiendo estantería U${targetU}: Instalado ${newDevice.name} en bandeja ${
          assignedBay === 'left' ? 'IZQUIERDA (1/2)' : 'DERECHA (2/2)'
        }`
      );
    } else {
      showNotice(`Instalado ${newDevice.name} en posición U${targetU}`);
    }
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

  // Synchronize customPreviewPorts whenever customPortBlocks or customDevNumbering changes
  useEffect(() => {
    const validBlocks = customPortBlocks.filter((b) => b.count > 0);
    const { ports: rawPorts } = createDeviceFromPortBlocks(
      'preview-dev',
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

    const mockDev: RackDevice = {
      id: 'preview-dev',
      templateId: 'preview',
      name: customDevName,
      model: customDevBrand,
      category: customDevCategory,
      uStart: customDevUStart,
      uSize: customDevUSize,
      ipAddress: customDevIp,
      managementVlan: 'VLAN 10',
      serialNumber: 'SN-PREV',
      powerWatts: customDevWatts,
      status: 'nominal',
      notes: '',
      portNumberingOrder: customDevNumbering,
      ports: rawPorts
    };

    const computed = ensureDevicePortCoordinates(mockDev);
    setCustomPreviewPorts(computed);
  }, [customPortBlocks, customDevNumbering]);

  // Global mousemove / mouseup listeners for smooth graphical port dragging inside Rack or Custom Designer
  useEffect(() => {
    if (!draggingRackPort && !draggingCustomPortId) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggingRackPort) {
        const container = faceplateCanvasRefs.current[draggingRackPort.deviceId];
        if (!container) return;
        const rect = container.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const rawX = ((e.clientX - rect.left) / rect.width) * 100;
        const rawY = ((e.clientY - rect.top) / rect.height) * 100;
        const clampedX = Number(Math.max(2, Math.min(97, rawX)).toFixed(1));
        const clampedY = Number(Math.max(16, Math.min(84, rawY)).toFixed(1));
        const newZone: PortZone =
          clampedX < 28 ? 'left' : clampedX < 64 ? 'center' : 'right';

        const targetDev = rack.devices.find(
          (d) => d.id === draggingRackPort.deviceId
        );
        if (!targetDev) return;

        const initializedPorts = ensureDevicePortCoordinates(targetDev);
        const updatedPorts = initializedPorts.map((p) =>
          p.id === draggingRackPort.portId
            ? {
                ...p,
                xPercent: clampedX,
                yPercent: clampedY,
                zone: newZone
              }
            : p
        );

        onUpdateRack({
          ...rack,
          devices: rack.devices.map((d) =>
            d.id === draggingRackPort.deviceId
              ? { ...d, ports: updatedPorts }
              : d
          )
        });
      } else if (draggingCustomPortId && customCanvasRef.current) {
        const rect = customCanvasRef.current.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const rawX = ((e.clientX - rect.left) / rect.width) * 100;
        const rawY = ((e.clientY - rect.top) / rect.height) * 100;
        const clampedX = Number(Math.max(2, Math.min(97, rawX)).toFixed(1));
        const clampedY = Number(Math.max(16, Math.min(84, rawY)).toFixed(1));
        const newZone: PortZone =
          clampedX < 28 ? 'left' : clampedX < 64 ? 'center' : 'right';

        setCustomPreviewPorts((prev) =>
          prev.map((p) =>
            p.id === draggingCustomPortId
              ? {
                  ...p,
                  xPercent: clampedX,
                  yPercent: clampedY,
                  zone: newZone
                }
              : p
          )
        );
      }
    };

    const handleGlobalMouseUp = () => {
      if (draggingRackPort) {
        setDraggingRackPort(null);
        setTimeout(recalculateCableCoordinates, 20);
      }
      if (draggingCustomPortId) {
        setDraggingCustomPortId(null);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingRackPort, draggingCustomPortId, rack]);

  const handleResetDevicePortCoordinates = (deviceId: string) => {
    const targetDev = rack.devices.find((d) => d.id === deviceId);
    if (!targetDev) return;
    const resetPorts = targetDev.ports.map((p) => ({
      ...p,
      xPercent: undefined,
      yPercent: undefined
    }));
    onUpdateRack({
      ...rack,
      devices: rack.devices.map((d) =>
        d.id === deviceId ? { ...d, ports: resetPorts } : d
      )
    });
    showNotice(`Restaurada alineación automática de puertos en ${targetDev.name}`);
  };

  const handleCreateCustomDevice = (e: React.FormEvent) => {
    e.preventDefault();
    let targetU = customDevUStart;
    let updatedExistingDevices = [...rack.devices];
    let assignedBay: ShelfBay = customDevShelfBay;

    if (!isURangeAvailable(targetU, customDevUSize, null, assignedBay)) {
      const overlapping = rack.devices.filter((d) => {
        const dEnd = d.uStart + d.uSize - 1;
        const tEnd = targetU + customDevUSize - 1;
        return !(tEnd < d.uStart || targetU > dEnd);
      });

      if (
        overlapping.length === 1 &&
        overlapping[0].uStart === targetU &&
        overlapping[0].uSize === customDevUSize
      ) {
        const existingDev = overlapping[0];
        const existingBay = existingDev.shelfBay || 'full';
        if (assignedBay === 'left') {
          updatedExistingDevices = rack.devices.map((d) =>
            d.id === existingDev.id ? { ...d, shelfBay: 'right' } : d
          );
        } else {
          updatedExistingDevices = rack.devices.map((d) =>
            d.id === existingDev.id ? { ...d, shelfBay: 'left' } : d
          );
          assignedBay = existingBay === 'right' ? 'left' : 'right';
        }
      } else {
        const fallbackU = findFirstAvailableUFromTop(customDevUSize, assignedBay);
        if (fallbackU === null) {
          showNotice(`No hay ${customDevUSize}U libres en el armario.`);
          return;
        }
        targetU = fallbackU;
      }
    }

    const devId = `dev-custom-${Date.now()}`;
    const finalPorts: DevicePort[] = customPreviewPorts.map((p, idx) => ({
      ...p,
      id: `${devId}-p${idx + 1}`,
      number: idx + 1
    }));

    const customDevice: RackDevice = {
      id: devId,
      templateId: 'custom-user-device',
      name: customDevName.trim() || 'EQUIPO-PERSONALIZADO',
      model: customDevBrand.trim() || 'Hardware a Medida',
      category: customDevCategory,
      uStart: targetU,
      uSize: customDevUSize,
      shelfBay: assignedBay,
      ipAddress: customDevIp.trim() || '192.168.1.1/24',
      managementVlan: 'VLAN 10',
      serialNumber: `SN-CUST-${Math.floor(100000 + Math.random() * 900000)}`,
      powerWatts: customDevWatts,
      status: 'nominal',
      notes: `Dispositivo personalizado con ${finalPorts.length} puertos posicionados gráficamente.`,
      customColor: customDevColor,
      portNumberingOrder: customDevNumbering,
      ports: finalPorts
    };

    onUpdateRack({
      ...rack,
      devices: [...updatedExistingDevices, customDevice]
    });
    setSelectedDeviceId(customDevice.id);
    setShowCustomBuilder(false);
    showNotice(
      `Creado equipo personalizado "${customDevice.name}" (${finalPorts.length} puertos) en U${targetU}${
        assignedBay !== 'full'
          ? ` [Estantería ${assignedBay === 'left' ? 'Izquierda 1/2' : 'Derecha 2/2'}]`
          : ''
      }`
    );
  };

  const handleSaveCustomRackSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const minRequiredU = rack.devices.reduce(
      (maxU, d) => Math.max(maxU, d.uStart + d.uSize - 1),
      4
    );
    const safeTotalU = Math.max(
      minRequiredU,
      Math.min(60, Number(editRackTotalU) || rack.totalU)
    );

    if (Number(editRackTotalU) < minRequiredU) {
      showNotice(
        `El armario se ajustó a ${safeTotalU}U porque hay un equipo montado en U${minRequiredU}.`
      );
    } else {
      showNotice(
        `Rack actualizado a medida: ${editRackName} (${safeTotalU}U · ${editRackWidthMm}×${editRackDepthMm}mm)`
      );
    }

    onUpdateRack({
      ...rack,
      name: editRackName.trim() || rack.name,
      locationCode: editRackCode.trim() || rack.locationCode,
      totalU: safeTotalU,
      widthMm: editRackWidthMm,
      depthMm: editRackDepthMm,
      rackType: editRackType,
      maxPowerWatts: Math.max(200, Number(editRackPower) || 3500),
      frameColor: editRackColor,
      uNumberingDirection: editRackUDir
    });
    setShowRackCustomizer(false);
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

  const handleMoveDeviceToU = (
    deviceId: string,
    targetU: number,
    preferredBay?: ShelfBay
  ) => {
    const dev = rack.devices.find((d) => d.id === deviceId);
    if (!dev) return;
    if (dev.uStart === targetU && (!preferredBay || dev.shelfBay === preferredBay)) {
      return;
    }

    const overlapping = rack.devices.filter((d) => {
      if (d.id === deviceId) return false;
      const dEnd = d.uStart + d.uSize - 1;
      const tEnd = targetU + dev.uSize - 1;
      return !(tEnd < d.uStart || targetU > dEnd);
    });

    if (overlapping.length === 0) {
      const nextBay: ShelfBay = preferredBay || dev.shelfBay || 'full';
      const updatedDevices = rack.devices.map((d) =>
        d.id === deviceId ? { ...d, uStart: targetU, shelfBay: nextBay } : d
      );
      onUpdateRack({
        ...rack,
        devices: updatedDevices
      });
      showNotice(`Reubicado ${dev.name} a U${targetU}`);
      return;
    }

    // Allow sharing the same U shelf if there is only 1 existing device of the same uSize!
    if (
      overlapping.length === 1 &&
      overlapping[0].uStart === targetU &&
      overlapping[0].uSize === dev.uSize
    ) {
      const otherDev = overlapping[0];
      const otherBay: ShelfBay =
        preferredBay === 'left'
          ? 'right'
          : preferredBay === 'right'
          ? 'left'
          : otherDev.shelfBay === 'right'
          ? 'right'
          : 'left';
      const targetBay: ShelfBay = otherBay === 'left' ? 'right' : 'left';

      const updatedDevices = rack.devices.map((d) => {
        if (d.id === otherDev.id) return { ...d, shelfBay: otherBay };
        if (d.id === deviceId)
          return { ...d, uStart: targetU, shelfBay: targetBay };
        return d;
      });
      onUpdateRack({
        ...rack,
        devices: updatedDevices
      });
      showNotice(
        `Compartiendo estantería U${targetU}: ${otherDev.name} (Izq) + ${dev.name} (Der)`
      );
      return;
    }

    showNotice(
      `Posición U${targetU} ya tiene el máximo de dispositivos o alturas incompatibles.`
    );
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

  // Build uSlotMap supporting up to 2 side-by-side devices on the same U shelf
  const uSlotMap: Record<
    number,
    { type: 'start_top' | 'covered'; devices: RackDevice[] }
  > = {};
  for (const dev of rack.devices) {
    const topU = dev.uStart + dev.uSize - 1;
    for (let u = dev.uStart; u <= topU; u++) {
      if (u === topU) {
        if (!uSlotMap[u] || uSlotMap[u].type === 'covered') {
          uSlotMap[u] = { type: 'start_top', devices: [dev] };
        } else {
          uSlotMap[u].devices.push(dev);
          uSlotMap[u].devices.sort((a, b) =>
            (a.shelfBay === 'right' ? 1 : 0) - (b.shelfBay === 'right' ? 1 : 0)
          );
        }
      } else if (!uSlotMap[u]) {
        uSlotMap[u] = { type: 'covered', devices: [dev] };
      }
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

  // Calculate unique U slots occupied (so 2 firewalls on the same U shelf count as 1U of rack height)
  const occupiedUSet = new Set<number>();
  rack.devices.forEach((d) => {
    for (let u = d.uStart; u < d.uStart + d.uSize; u++) {
      occupiedUSet.add(u);
    }
  });
  const usedU = occupiedUSet.size;
  const totalWatts = rack.devices.reduce((acc, d) => acc + d.powerWatts, 0);

  // Helper to render a single port button with distinct styling per port type (PON, USB, Console, SFP+, FXS, RJ45, Power)
  const renderPortButton = (
    dev: RackDevice,
    port: DevicePort,
    rowLen: number,
    isFreeformPositioned?: boolean
  ) => {
    const connCable = getCableForPort(port.id);
    const isPending = pendingPort?.portId === port.id;
    const isHoveredCablePort = connCable && hoveredCableId === connCable.id;
    const isBeingDragged =
      draggingRackPort?.deviceId === dev.id &&
      draggingRackPort?.portId === port.id;
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

    const inlineStyle: React.CSSProperties = {};
    if (connCable) {
      inlineStyle.backgroundColor = portColorHex;
      inlineStyle.borderColor = '#ffffff';
    }
    if (
      isFreeformPositioned &&
      typeof port.xPercent === 'number' &&
      typeof port.yPercent === 'number'
    ) {
      inlineStyle.position = 'absolute';
      inlineStyle.left = `${port.xPercent}%`;
      inlineStyle.top = `${port.yPercent}%`;
      inlineStyle.transform = 'translate(-50%, -50%)';
    }

    return (
      <button
        key={port.id}
        ref={(el) => {
          portRefs.current[port.id] = el;
        }}
        type="button"
        title={
          graphicalPortMoveMode
            ? `Arrastre con el ratón para mover el puerto #${port.number} [${port.label}] a cualquier parte del chasis`
            : `Puerto #${port.number} [${port.label}] — ${
                PORT_TYPE_META[port.type]?.label || port.type
              }`
        }
        onMouseDown={(e) => {
          if (graphicalPortMoveMode) {
            e.stopPropagation();
            e.preventDefault();
            setSelectedDeviceId(dev.id);
            setDraggingRackPort({ deviceId: dev.id, portId: port.id });
          }
        }}
        onMouseEnter={() => {
          if (graphicalPortMoveMode) {
            setHoverInfo({
              text: `MODO MOVER PUERTO: Mantenga pulsado el botón izquierdo y mueva el cursor para colocar [${port.label} #${port.number}] donde quiera`,
              subtext: `Posición actual: X=${port.xPercent ?? '--'}% · Y=${
                port.yPercent ?? '--'
              }%`
            });
            return;
          }
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
              text: `Puerto #${port.number} [${port.label}] (${
                PORT_TYPE_META[port.type]?.shortTag || port.type.toUpperCase()
              }) — [U${dev.uStart}] ${dev.name}`,
              subtext: `Libre · clic para conectar cable`
            });
          }
        }}
        onMouseLeave={() => {
          setHoveredCableId(null);
          setHoverInfo(null);
        }}
        onClick={(e) => {
          if (graphicalPortMoveMode) {
            e.stopPropagation();
            return;
          }
          handlePortClick(e, dev, port.id, port.label);
        }}
        style={inlineStyle}
        className={`h-[19px] ${
          rowLen > 16
            ? 'w-[17px] text-[8px]'
            : showShortText
            ? 'min-w-[22px] px-1 text-[8px]'
            : 'w-[21px] text-[9px]'
        } rounded-[3px] font-mono font-bold flex items-center justify-center border transition-colors ${
          graphicalPortMoveMode
            ? 'cursor-grab active:cursor-grabbing ring-1 ring-amber-400/80'
            : 'cursor-pointer'
        } tabular-nums shrink-0 truncate ${
          isBeingDragged
            ? 'bg-amber-400 text-slate-950 border-white ring-2 ring-white z-50 shadow-xl'
            : isPending || isHoveredCablePort
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
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold text-white">
                {rack.name}
              </h2>
              <span className="text-xs font-mono text-slate-400">
                · {rack.locationCode}
              </span>
              {rack.widthMm && rack.depthMm && (
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
                  {rack.totalU}U · {rack.widthMm}×{rack.depthMm}mm
                </span>
              )}
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

          <div className="flex flex-wrap items-center gap-2">
            {/* Custom Rack Settings Button */}
            <button
              type="button"
              onClick={() => setShowRackCustomizer(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Rack a Medida ({rack.totalU}U)</span>
            </button>

            {/* Graphical Port Drag Mode Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !graphicalPortMoveMode;
                setGraphicalPortMoveMode(next);
                setPendingPort(null);
                showNotice(
                  next
                    ? 'Modo Mover Puertos con el Ratón ACTIVADO: Arrastre cualquier puerto sobre su dispositivo para colocarlo donde quiera.'
                    : 'Modo Mover Puertos desactivado (Modo conexión de latiguillos activo).'
                );
              }}
              className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                graphicalPortMoveMode
                  ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg ring-2 ring-amber-400/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40'
              }`}
            >
              <Move className="w-3.5 h-3.5" />
              <span>
                {graphicalPortMoveMode
                  ? 'Moviendo Puertos (Activo)'
                  : 'Mover Puertos'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const freeU = findFirstAvailableUFromTop(1) || 10;
                setCustomDevUStart(freeU);
                setCustomDevShelfBay('full');
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
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>

        {/* Fixed-Height Status & Live Hover HUD Strip (Never shifts rack vertically on hover) */}
        <div className="min-h-[44px] flex items-center">
          {graphicalPortMoveMode ? (
            <div className="w-full p-2.5 px-3.5 rounded-xl bg-amber-950/90 border border-amber-500/90 flex items-center justify-between gap-3">
              <div className="text-xs text-amber-100 flex items-center gap-2 min-w-0">
                <Move className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">
                  <strong>MODO EDICIÓN GRÁFICA DE PUERTOS:</strong> Pinche y arrastre con el cursor cualquier puerto para moverlo libremente por el frontal del equipo (Izquierda, Centro, Derecha, Arriba o Abajo).
                </span>
              </div>
              <button
                type="button"
                onClick={() => setGraphicalPortMoveMode(false)}
                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>Terminar de Mover</span>
              </button>
            </div>
          ) : pendingPort ? (
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
                <Columns2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>
                  <strong className="text-cyan-300">2 Equipos en la misma U:</strong> Arrastre un segundo equipo sobre cualquier U ocupada o pulse «+ 2º Equipo en U» para compartir bandeja.
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
          style={{
            backgroundColor: rack.frameColor || '#0B0F17'
          }}
          className="relative border-2 border-slate-800 rounded-xl p-3 shadow-2xl select-none"
        >
          {/* Top Rack Bezel Plate */}
          <div className="flex items-center justify-between px-4 py-1.5 mb-2 bg-slate-900/90 border border-slate-800 rounded text-[11px] font-mono text-slate-400">
            <span>
              {rack.rackType === 'wall'
                ? 'ARMARIO MURAL 19"'
                : rack.rackType === 'open-frame'
                ? 'BASTIDOR ABIERTO 19"'
                : rack.rackType === 'custom'
                ? 'RACK PERSONALIZADO A MEDIDA'
                : 'CHASSIS EIA-310-D · 19" RACK'}{' '}
              {rack.widthMm && rack.depthMm
                ? `(${rack.widthMm}×${rack.depthMm}mm)`
                : ''}
            </span>
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

          {/* Rack U Slots Loop (Supports Bottom-Up U42->U1 or Top-Down U1->U42) */}
          <div className="divide-y divide-slate-800/70 border border-slate-800 rounded bg-[#090D16] overflow-hidden">
            {Array.from({ length: rack.totalU }, (_, i) =>
              rack.uNumberingDirection === 'top-down' ? i + 1 : rack.totalU - i
            ).map((uNumber) => {
              const slotInfo = uSlotMap[uNumber];

              if (slotInfo && slotInfo.type === 'covered') {
                return null;
              }

              if (slotInfo && slotInfo.type === 'start_top') {
                const slotDevices = slotInfo.devices;
                const isDualShelf =
                  slotDevices.length > 1 ||
                  (slotDevices.length === 1 &&
                    slotDevices[0].shelfBay &&
                    slotDevices[0].shelfBay !== 'full');

                const maxUHeight = Math.max(
                  ...slotDevices.map((d) => d.uSize),
                  1
                );
                const maxZoneRows = Math.max(
                  ...slotDevices.map((d) => getOrganizedDeviceZones(d).maxRows),
                  1
                );
                const rowHeightPx = Math.max(
                  maxUHeight * 38,
                  maxZoneRows * 24 + 16
                );

                // Helper to render one device chassis (either full 19" width or 50% shelf bay)
                const renderSingleDeviceFaceplate = (
                  dev: RackDevice,
                  isHalfBay: boolean
                ) => {
                  const isSelected = selectedDeviceId === dev.id;
                  const { leftRows, centerRows, rightRows } =
                    getOrganizedDeviceZones(dev);

                  const hasFreeformCoords = dev.ports.some(
                    (p) =>
                      typeof p.xPercent === 'number' &&
                      typeof p.yPercent === 'number'
                  );
                  const useFreeformCanvas =
                    graphicalPortMoveMode || hasFreeformCoords;
                  const positionedPorts = useFreeformCanvas
                    ? ensureDevicePortCoordinates(dev)
                    : dev.ports;

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

                  const activeChassisColor =
                    dev.customColor || defaultCategoryColor;

                  return (
                    <div
                      key={`dev-bay-${dev.id}`}
                      draggable={!graphicalPortMoveMode}
                      onDragStart={(e) => {
                        if (graphicalPortMoveMode) {
                          e.preventDefault();
                          return;
                        }
                        setDraggedDeviceId(dev.id);
                        setDraggedTemplate(null);
                        e.dataTransfer.setData('text/plain', dev.id);
                      }}
                      onDragEnd={() => {
                        setDraggedDeviceId(null);
                        setHoverU(null);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDeviceId(dev.id);
                        setSelectedCableId(null);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedDeviceId(dev.id);
                        setZoomedDeviceId(dev.id);
                      }}
                      style={{
                        background: `linear-gradient(90deg, ${activeChassisColor}E6 0%, #0F172A 60%, #0F172A 100%)`
                      }}
                      className={`group relative flex-1 min-w-0 px-2 py-1.5 flex items-stretch justify-between gap-1.5 overflow-hidden transition-colors cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-inset ring-blue-400 z-10'
                          : 'hover:brightness-110'
                      }`}
                    >
                      {/* Brand + Type + Quick Zoom Button */}
                      <div
                        className={`flex items-center gap-1 shrink-0 ${
                          isHalfBay ? 'w-[86px]' : 'w-[104px]'
                        }`}
                        title={`${dev.name} — ${dev.model} (${dev.ipAddress}) · Doble clic o lupa para hacer Zoom`}
                      >
                        <GripVertical className="w-3 h-3 text-slate-400 cursor-grab shrink-0" />
                        <div className="min-w-0 flex-1 leading-tight">
                          <div className="font-mono text-[10px] font-bold text-white truncate">
                            {isHalfBay ? dev.name : shortBrand}
                          </div>
                          <div className="text-[8px] font-mono uppercase tracking-wider text-slate-300/90 truncate flex items-center gap-1">
                            <span>{CATEGORY_LABELS[dev.category]}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDeviceId(dev.id);
                            setZoomedDeviceId(dev.id);
                          }}
                          title="Hacer Zoom en este dispositivo (abrir vista ampliada para mover puertos y editar nombres)"
                          className="p-1 rounded bg-blue-600/80 hover:bg-blue-500 text-white shadow cursor-pointer shrink-0 transition-transform hover:scale-110"
                        >
                          <ZoomIn className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Interactive Port Canvas */}
                      <div
                        ref={(el) => {
                          faceplateCanvasRefs.current[dev.id] = el;
                        }}
                        className={`flex-1 relative z-30 min-w-0 ${
                          useFreeformCanvas
                            ? 'min-h-[30px]'
                            : 'flex items-center justify-between gap-1.5'
                        } ${
                          graphicalPortMoveMode
                            ? 'bg-slate-950/45 border border-dashed border-amber-400/60 rounded'
                            : ''
                        }`}
                      >
                        {useFreeformCanvas ? (
                          <>
                            {graphicalPortMoveMode && (
                              <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-2 text-[8px] font-mono uppercase text-amber-300/30 select-none">
                                <span>⬅ Izq</span>
                                <span>Cen</span>
                                <span>Der ➡</span>
                              </div>
                            )}
                            {positionedPorts.map((p) =>
                              renderPortButton(
                                dev,
                                p,
                                isHalfBay
                                  ? Math.max(14, positionedPorts.length)
                                  : positionedPorts.length > 24
                                  ? 20
                                  : 10,
                                true
                              )
                            )}
                          </>
                        ) : (
                          <>
                            {leftRows.length > 0 ? (
                              <div className="flex flex-col gap-1 items-start justify-center shrink-0 pr-1 border-r border-slate-700/60">
                                {leftRows.map((rPorts, rIdx) => (
                                  <div
                                    key={`zleft-${dev.id}-${rIdx}`}
                                    className="flex flex-nowrap items-center gap-[2px]"
                                  >
                                    {rPorts.map((p) =>
                                      renderPortButton(
                                        dev,
                                        p,
                                        isHalfBay ? 18 : rPorts.length
                                      )
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div />
                            )}

                            {centerRows.length > 0 && (
                              <div className="flex flex-col gap-1 items-center justify-center shrink-0 px-0.5">
                                {centerRows.map((rPorts, rIdx) => (
                                  <div
                                    key={`zcenter-${dev.id}-${rIdx}`}
                                    className="flex flex-nowrap items-center gap-[2px]"
                                  >
                                    {rPorts.map((p) =>
                                      renderPortButton(
                                        dev,
                                        p,
                                        isHalfBay ? 18 : rPorts.length
                                      )
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {rightRows.length > 0 && (
                              <div
                                className={`flex flex-col gap-1 items-end justify-center shrink-0 ${
                                  centerRows.length > 0
                                    ? 'pl-1 border-l border-slate-700/60'
                                    : ''
                                }`}
                              >
                                {rightRows.map((rPorts, rIdx) => (
                                  <div
                                    key={`zright-${dev.id}-${rIdx}`}
                                    className="flex flex-nowrap items-center gap-[2px] justify-end"
                                  >
                                    {rPorts.map((p) =>
                                      renderPortButton(
                                        dev,
                                        p,
                                        isHalfBay ? 18 : rPorts.length
                                      )
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                };

                const leftBayDevice = isDualShelf
                  ? slotDevices.find((d) => d.shelfBay === 'left') ||
                    (slotDevices.length === 2 ? slotDevices[0] : undefined)
                  : slotDevices[0];
                const rightBayDevice = isDualShelf
                  ? slotDevices.find(
                      (d) =>
                        d.id !== leftBayDevice?.id &&
                        (d.shelfBay === 'right' || slotDevices.length === 2)
                    )
                  : undefined;

                return (
                  <div
                    key={`u-row-${uNumber}`}
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
                    style={{ minHeight: `${rowHeightPx}px` }}
                    className="relative flex items-stretch bg-[#090D16]"
                  >
                    {/* Left Rack Rail */}
                    <div className="w-9 shrink-0 bg-slate-950/90 border-r border-slate-800 flex flex-col items-center justify-center font-mono text-[10px] text-slate-400 tabular-nums">
                      <span>{uNumber.toString().padStart(2, '0')}</span>
                      {maxUHeight > 1 && (
                        <span className="text-[9px] text-slate-600">
                          ..{slotDevices[0].uStart.toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>

                    {/* Shelf Content: Either 1 Full-Width Device OR 2 Side-by-Side Devices on Same U Shelf */}
                    {isDualShelf ? (
                      <div className="flex-1 grid grid-cols-2 divide-x-2 divide-amber-500/50 min-w-0">
                        {/* LEFT HALF SHELF (1/2) */}
                        {leftBayDevice ? (
                          renderSingleDeviceFaceplate(leftBayDevice, true)
                        ) : (
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setHoverU(null);
                              if (draggedTemplate) {
                                handleInstallTemplateAtU(
                                  draggedTemplate,
                                  uNumber,
                                  'left'
                                );
                              } else if (draggedDeviceId) {
                                handleMoveDeviceToU(
                                  draggedDeviceId,
                                  uNumber,
                                  'left'
                                );
                              }
                            }}
                            onClick={() => {
                              setCustomDevUStart(uNumber);
                              setCustomDevShelfBay('left');
                              setShowCustomBuilder(true);
                            }}
                            className="flex items-center justify-between px-2.5 bg-slate-950/70 hover:bg-blue-950/40 text-[10px] font-mono text-slate-400 hover:text-blue-300 cursor-pointer transition-colors"
                          >
                            <span>+ Hueco Izquierdo Libre (U{uNumber})</span>
                            <span className="px-1.5 py-0.5 rounded bg-blue-600/20 border border-blue-500/40 text-blue-300 text-[9px]">
                              + Añadir 2º Equipo
                            </span>
                          </div>
                        )}

                        {/* RIGHT HALF SHELF (2/2) */}
                        {rightBayDevice ? (
                          renderSingleDeviceFaceplate(rightBayDevice, true)
                        ) : (
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setHoverU(null);
                              if (draggedTemplate) {
                                handleInstallTemplateAtU(
                                  draggedTemplate,
                                  uNumber,
                                  'right'
                                );
                              } else if (draggedDeviceId) {
                                handleMoveDeviceToU(
                                  draggedDeviceId,
                                  uNumber,
                                  'right'
                                );
                              }
                            }}
                            onClick={() => {
                              setCustomDevUStart(uNumber);
                              setCustomDevShelfBay('right');
                              setShowCustomBuilder(true);
                            }}
                            className="flex items-center justify-between px-2.5 bg-slate-950/70 hover:bg-blue-950/40 text-[10px] font-mono text-slate-400 hover:text-blue-300 cursor-pointer transition-colors"
                          >
                            <span>+ Hueco Derecho Libre (U{uNumber})</span>
                            <span className="px-1.5 py-0.5 rounded bg-blue-600/20 border border-blue-500/40 text-blue-300 text-[9px]">
                              + Añadir 2º Equipo
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      renderSingleDeviceFaceplate(slotDevices[0], false)
                    )}

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
            })}
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
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoomedDeviceId(selectedDevice.id)}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 shadow transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Abrir pestaña de Zoom del dispositivo para mover puertos y editar nombres en grande"
                >
                  <ZoomIn className="w-3 h-3" />
                  <span>Zoom Equipo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteDevice(selectedDevice.id)}
                  className="px-2 py-1 rounded bg-red-950/70 hover:bg-red-900 text-red-200 text-[11px] flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Desmontar</span>
                </button>
              </div>
            )}
          </div>

          {selectedDevice ? (
            <div className="space-y-3.5 text-xs">
              {/* Quick Banner to Launch Full Zoom Tab */}
              <button
                type="button"
                onClick={() => setZoomedDeviceId(selectedDevice.id)}
                className="w-full p-2.5 rounded-lg bg-gradient-to-r from-blue-600/30 via-indigo-600/25 to-cyan-600/30 hover:from-blue-600/45 hover:to-cyan-600/45 border border-blue-500/60 text-left flex items-center justify-between gap-2 cursor-pointer transition-all shadow"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-md bg-blue-600 text-white shrink-0">
                    <ZoomIn className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-xs font-bold text-white truncate">
                      Abrir Zoom del Dispositivo ({selectedDevice.name})
                    </div>
                    <div className="text-[10px] text-blue-200 truncate">
                      Editar en grande, arrastrar puertos y renombrar etiquetas
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-500 text-white font-mono text-[10px] font-bold shrink-0">
                  Ampliar
                </span>
              </button>
              {/* Dual-Device Shelf Mode (2 Equipos en la misma U) */}
              <div className="p-3 rounded-lg bg-cyan-950/35 border border-cyan-600/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-cyan-200 flex items-center gap-1.5">
                    <Columns2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Bandeja / Estantería en U{selectedDevice.uStart}</span>
                  </span>
                  <span className="font-mono text-[10px] text-cyan-300">
                    {selectedDevice.shelfBay === 'left'
                      ? 'Mitad Izq (1/2)'
                      : selectedDevice.shelfBay === 'right'
                      ? 'Mitad Der (2/2)'
                      : 'Ancho 19" Completo'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  Coloque 2 dispositivos en la misma U (ej. 2 firewalls HA o ONT + Router en la misma bandeja):
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'full', label: '19" Completo' },
                      { id: 'left', label: '⬅ Mitad Izq' },
                      { id: 'right', label: 'Mitad Der ➡' }
                    ] as const
                  ).map((bayOpt) => (
                    <button
                      key={bayOpt.id}
                      type="button"
                      onClick={() => {
                        if (bayOpt.id === 'full') {
                          // Check if there is a second device sharing this U
                          const partner = rack.devices.find(
                            (d) =>
                              d.id !== selectedDevice.id &&
                              d.uStart === selectedDevice.uStart
                          );
                          if (partner) {
                            showNotice(
                              `Desmonte o mueva primero "${partner.name}" para que ${selectedDevice.name} ocupe toda la U${selectedDevice.uStart}.`
                            );
                            return;
                          }
                        }
                        onUpdateRack({
                          ...rack,
                          devices: rack.devices.map((d) =>
                            d.id === selectedDevice.id
                              ? { ...d, shelfBay: bayOpt.id }
                              : d
                          )
                        });
                      }}
                      className={`py-1.5 px-2 rounded font-mono text-[10px] font-bold border transition-colors cursor-pointer ${
                        (selectedDevice.shelfBay || 'full') === bayOpt.id
                          ? 'bg-cyan-600 text-white border-cyan-300 shadow'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-500'
                      }`}
                    >
                      {bayOpt.label}
                    </button>
                  ))}
                </div>

                {/* One-Click Clone / Add 2nd Device on Same U Shelf */}
                {rack.devices.filter((d) => d.uStart === selectedDevice.uStart)
                  .length < 2 && (
                  <div className="pt-1 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const cloneId = `dev-${Date.now()}`;
                        const clonedPorts = selectedDevice.ports.map((p) => ({
                          ...p,
                          id: `${cloneId}-p${p.number}`
                        }));
                        const secondDev: RackDevice = {
                          ...selectedDevice,
                          id: cloneId,
                          name: `${selectedDevice.name}-HA2`,
                          shelfBay:
                            selectedDevice.shelfBay === 'right'
                              ? 'left'
                              : 'right',
                          serialNumber: `${selectedDevice.serialNumber}-B`,
                          ports: clonedPorts
                        };
                        const updatedList = rack.devices.map((d) =>
                          d.id === selectedDevice.id
                            ? {
                                ...d,
                                shelfBay: (selectedDevice.shelfBay === 'right'
                                  ? 'right'
                                  : 'left') as ShelfBay
                              }
                            : d
                        );
                        onUpdateRack({
                          ...rack,
                          devices: [...updatedList, secondDev]
                        });
                        setSelectedDeviceId(secondDev.id);
                        showNotice(
                          `Añadido 2º equipo "${secondDev.name}" compartiendo la estantería U${selectedDevice.uStart}`
                        );
                      }}
                      className="flex-1 py-1.5 px-2 rounded bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-500/60 text-cyan-200 font-mono text-[10px] font-bold cursor-pointer"
                    >
                      + Duplicar en la misma U (Ej. 2º Firewall HA)
                    </button>
                  </div>
                )}
              </div>

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

              {/* Graphical Freeform Port Dragging Control in Inspector */}
              <div className="p-3 rounded-lg bg-amber-950/35 border border-amber-600/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-amber-200 flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5 text-amber-400" />
                    <span>Posición Gráfica de Puertos</span>
                  </span>
                  {selectedDevice.ports.some(
                    (p) => typeof p.xPercent === 'number'
                  ) && (
                    <button
                      type="button"
                      onClick={() =>
                        handleResetDevicePortCoordinates(selectedDevice.id)
                      }
                      className="text-[10px] font-mono text-amber-300 hover:text-white underline cursor-pointer"
                    >
                      Auto-Alinear
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  Mueva cualquier puerto libremente con el cursor por el frontal del dispositivo en el rack.
                </p>
                <button
                  type="button"
                  onClick={() => setGraphicalPortMoveMode(!graphicalPortMoveMode)}
                  className={`w-full py-1.5 px-3 rounded-lg font-mono text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    graphicalPortMoveMode
                      ? 'bg-amber-500 text-slate-950 border-white shadow-md'
                      : 'bg-slate-900 hover:bg-amber-500/20 text-amber-300 border-amber-500/60'
                  }`}
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>
                    {graphicalPortMoveMode
                      ? 'Modo Mover con el Cursor: ACTIVO (Arrastre en el Rack)'
                      : 'Activar Mover Puertos con el Cursor'}
                  </span>
                </button>
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
                                        ? {
                                            ...portItem,
                                            zone: nextZone,
                                            xPercent: undefined,
                                            yPercent: undefined
                                          }
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
          <div className="bg-[#111827] border border-slate-700 rounded-xl max-w-3xl w-full overflow-hidden shadow-2xl my-6">
            <div className="px-5 py-4 bg-[#0D1322] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <div>
                  <h3 className="font-display text-sm font-bold text-white">
                    Diseñador Gráfico de Dispositivo Personalizado
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Arrastre los puertos directamente con el cursor sobre el chasis o añada bloques por zonas
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
              {/* INTERACTIVE GRAPHICAL 19" FACEPLATE CANVAS — DRAG PORTS WITH THE CURSOR */}
              <div className="p-3.5 rounded-xl bg-[#090D16] border-2 border-amber-500/70 space-y-2 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      LIENZO GRÁFICO INTERACTIVO — Pinche y mueva cualquier puerto con el cursor donde quiera:
                    </span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {customPreviewPorts.length} puertos activos
                  </span>
                </div>

                {/* Simulated 19" Rack Chassis Faceplate */}
                <div
                  style={{
                    minHeight: `${Math.max(66, customDevUSize * 46)}px`,
                    background: `linear-gradient(90deg, ${customDevColor}E6 0%, #0F172A 55%, #0F172A 100%)`
                  }}
                  className="relative flex items-stretch rounded-lg border border-slate-700 overflow-hidden select-none"
                >
                  {/* Left Rack Ear */}
                  <div className="w-9 shrink-0 bg-slate-950/90 border-r border-slate-800 flex flex-col items-center justify-center font-mono text-[10px] text-slate-400">
                    <span>U{customDevUStart.toString().padStart(2, '0')}</span>
                  </div>

                  {/* Brand & Type Badge */}
                  <div className="flex items-center gap-1.5 px-2.5 shrink-0 w-[96px] border-r border-slate-800/70">
                    <div className="min-w-0 leading-tight">
                      <div className="font-mono text-[11px] font-bold text-white truncate">
                        {customDevBrand.split('/')[0].trim().split(' ')[0] ||
                          'Custom'}
                      </div>
                      <div className="text-[8px] font-mono uppercase tracking-wider text-slate-300 truncate">
                        {CATEGORY_LABELS[customDevCategory]}
                      </div>
                    </div>
                  </div>

                  {/* Interactive 2D Drag Area */}
                  <div
                    ref={customCanvasRef}
                    className="flex-1 relative min-h-[60px] bg-slate-950/35"
                  >
                    {/* Subtle Zone Guides */}
                    <div className="absolute inset-0 pointer-events-none grid grid-cols-3 divide-x divide-dashed divide-slate-700/40">
                      <div className="px-2 py-1 text-[8px] font-mono uppercase text-slate-500/70">
                        Zona Izquierda (Serie/USB/PON)
                      </div>
                      <div className="px-2 py-1 text-[8px] font-mono uppercase text-slate-500/70 text-center">
                        Zona Central (WAN/Voz/Switch)
                      </div>
                      <div className="px-2 py-1 text-[8px] font-mono uppercase text-slate-500/70 text-right">
                        Zona Derecha (LAN/SFP+)
                      </div>
                    </div>

                    {customPreviewPorts.map((port) => {
                      const isDraggingThis = draggingCustomPortId === port.id;
                      const isDefaultNumeric = /^(GE|P|PORT|eno)\d+$/i.test(
                        port.label
                      );
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
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-400'
                          : port.type === 'console'
                          ? 'bg-sky-950 text-sky-300 border-sky-400'
                          : port.type === 'usb'
                          ? 'bg-indigo-950 text-indigo-300 border-indigo-400'
                          : port.type === 'fxs'
                          ? 'bg-purple-950 text-purple-300 border-purple-400'
                          : port.type === 'sfp'
                          ? 'bg-slate-950 text-cyan-300 border-cyan-400'
                          : port.type === 'power'
                          ? 'bg-amber-950 text-amber-300 border-amber-400'
                          : 'bg-slate-900 text-white border-slate-500';

                      return (
                        <button
                          key={port.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setDraggingCustomPortId(port.id);
                          }}
                          style={{
                            position: 'absolute',
                            left: `${port.xPercent ?? 50}%`,
                            top: `${port.yPercent ?? 50}%`,
                            transform: 'translate(-50%, -50%)'
                          }}
                          title={`Arrastre con el ratón: #${port.number} [${port.label}] (X=${port.xPercent}%, Y=${port.yPercent}%)`}
                          className={`h-[21px] ${
                            showShortText
                              ? 'min-w-[24px] px-1 text-[8px]'
                              : 'w-[22px] text-[9px]'
                          } rounded-[3px] font-mono font-bold flex items-center justify-center border cursor-grab active:cursor-grabbing tabular-nums select-none ${
                            isDraggingThis
                              ? 'bg-amber-400 text-slate-950 border-white ring-2 ring-white z-50 shadow-xl'
                              : `${typeStyle} hover:ring-2 hover:ring-amber-300 z-20`
                          }`}
                        >
                          {displayTag}
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Rack Ear */}
                  <div className="w-8 shrink-0 bg-slate-950/90 border-l border-slate-800 flex items-center justify-center font-mono text-[10px] text-slate-500">
                    U{customDevUStart.toString().padStart(2, '0')}
                  </div>
                </div>
              </div>

              {/* Quick Hardware Archetype Presets */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">
                  Plantillas Rápidas de Distribución Física (clic para cargar y luego mover con el ratón):
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
                      Añada grupos de puertos y luego muévalos libremente con el ratón en el lienzo superior.
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

                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
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

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
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
                  <label className="block text-cyan-300 font-medium mb-1">
                    Bandeja en U
                  </label>
                  <select
                    value={customDevShelfBay}
                    onChange={(e) =>
                      setCustomDevShelfBay(e.target.value as ShelfBay)
                    }
                    className="w-full px-2 py-1.5 bg-slate-900 border border-cyan-500/60 rounded-lg text-white font-mono"
                  >
                    <option value="full">19&quot; Completo</option>
                    <option value="left">⬅ Mitad Izq (1/2)</option>
                    <option value="right">Mitad Der (2/2) ➡</option>
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

      {/* =================================================================== */}
      {/* MODAL 3: CUSTOM RACK CONFIGURATOR (RACK A MEDIDA Y PERSONALIZADO)   */}
      {/* =================================================================== */}
      {showRackCustomizer && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111827] border border-cyan-500/60 rounded-xl max-w-xl w-full overflow-hidden shadow-2xl">
            <div className="px-5 py-4 bg-[#0D1322] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Settings2 className="w-4 h-4 text-cyan-400" />
                <div>
                  <h3 className="font-display text-sm font-bold text-white">
                    Configurar Rack a Medida y Personalizado
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Ajuste la altura en U exacta (de 4U a 60U), dimensiones físicas, potencia, numeración y color
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRackCustomizer(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveCustomRackSettings}
              className="p-5 space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Nombre del Armario Rack
                  </label>
                  <input
                    type="text"
                    required
                    value={editRackName}
                    onChange={(e) => setEditRackName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Código Sala / Ubicación
                  </label>
                  <input
                    type="text"
                    required
                    value={editRackCode}
                    onChange={(e) => setEditRackCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              {/* Custom U Height Selector with Presets + Exact Input */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">
                    Altura Exacta del Armario en Unidades (U)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-mono font-bold">
                    {editRackTotalU}U ({Math.round(editRackTotalU * 44.45)} mm útiles)
                  </span>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-400 mb-1.5">
                    Tamaños comerciales habituales o escriba cualquier número (4U a 60U):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[6, 9, 12, 15, 18, 22, 24, 32, 36, 42, 45, 48, 52].map(
                      (uPreset) => (
                        <button
                          key={uPreset}
                          type="button"
                          onClick={() => setEditRackTotalU(uPreset)}
                          className={`px-2.5 py-1 rounded font-mono text-xs font-bold border transition-colors cursor-pointer ${
                            editRackTotalU === uPreset
                              ? 'bg-cyan-600 text-white border-cyan-300'
                              : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {uPreset}U
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Unidades (U) a Medida [4 - 60]
                    </label>
                    <input
                      type="number"
                      min={4}
                      max={60}
                      value={editRackTotalU}
                      onChange={(e) =>
                        setEditRackTotalU(
                          Math.max(4, Math.min(60, Number(e.target.value) || 12))
                        )
                      }
                      className="w-full px-3 py-1.5 bg-slate-950 border border-cyan-500/70 rounded-lg text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Sentido Numeración Bastidor
                    </label>
                    <select
                      value={editRackUDir}
                      onChange={(e) =>
                        setEditRackUDir(
                          e.target.value as 'bottom-up' | 'top-down'
                        )
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                    >
                      <option value="bottom-up">
                        Estándar (U{editRackTotalU} Arriba → U01 Abajo)
                      </option>
                      <option value="top-down">
                        Invertido (U01 Arriba → U{editRackTotalU} Abajo)
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Physical Dimensions & Power */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Tipo de Armario
                  </label>
                  <select
                    value={editRackType}
                    onChange={(e) =>
                      setEditRackType(
                        e.target.value as
                          | 'floor'
                          | 'wall'
                          | 'open-frame'
                          | 'custom'
                      )
                    }
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="floor">Suelo Cerrado</option>
                    <option value="wall">Mural Pared</option>
                    <option value="open-frame">Bastidor Abierto</option>
                    <option value="custom">A Medida Especial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Ancho (mm)
                  </label>
                  <input
                    type="number"
                    min={450}
                    max={1200}
                    step={10}
                    value={editRackWidthMm}
                    onChange={(e) =>
                      setEditRackWidthMm(Number(e.target.value) || 600)
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Fondo (mm)
                  </label>
                  <input
                    type="number"
                    min={300}
                    max={1400}
                    step={10}
                    value={editRackDepthMm}
                    onChange={(e) =>
                      setEditRackDepthMm(Number(e.target.value) || 800)
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Potencia Máx (W)
                  </label>
                  <input
                    type="number"
                    min={200}
                    max={30000}
                    step={100}
                    value={editRackPower}
                    onChange={(e) =>
                      setEditRackPower(Number(e.target.value) || 3500)
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              {/* Rack Frame Color */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="text-slate-300 font-medium">
                  Color del Chasis / Bastidor del Rack:
                </span>
                <div className="flex items-center gap-2">
                  {[
                    { hex: '#0B0F17', name: 'Negro Grafito' },
                    { hex: '#1E293B', name: 'Gris Antracita' },
                    { hex: '#172554', name: 'Azul Industrial' },
                    { hex: '#27272A', name: 'Acero Oscuro' },
                    { hex: '#022C22', name: 'Verde Telecom' }
                  ].map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setEditRackColor(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                      className={`w-6 h-6 rounded-md border cursor-pointer ${
                        editRackColor === c.hex
                          ? 'border-white scale-110 ring-2 ring-cyan-400'
                          : 'border-slate-600'
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={editRackColor}
                    onChange={(e) => setEditRackColor(e.target.value)}
                    className="w-7 h-6 rounded cursor-pointer bg-transparent border-0"
                    title="Color personalizado RGB"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRackCustomizer(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
                >
                  Guardar Rack a Medida ({editRackTotalU}U)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* FULL-SCREEN DEVICE ZOOM & GRAPHICAL PORT EDITOR TAB/MODAL           */}
      {/* =================================================================== */}
      {zoomedDeviceId &&
        (() => {
          const zoomedDev = rack.devices.find((d) => d.id === zoomedDeviceId);
          if (!zoomedDev) return null;
          return (
            <DeviceZoomEditorModal
              rack={rack}
              device={zoomedDev}
              onUpdateRack={onUpdateRack}
              onClose={() => setZoomedDeviceId(null)}
            />
          );
        })()}
    </div>
  );
};
