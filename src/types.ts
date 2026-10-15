export type DeviceCategory =
  | 'firewall'
  | 'router'
  | 'switch'
  | 'patchpanel'
  | 'server'
  | 'ups'
  | 'ont'
  | 'pbx'
  | 'nvr';

export type PortType =
  | 'rj45'
  | 'sfp'
  | 'keystone'
  | 'console'
  | 'usb'
  | 'pon'
  | 'fxs'
  | 'coax'
  | 'power';

/**
 * Horizontal zone on the device faceplate where a port or group of ports sits:
 * - 'left': Left section (typical for Console, USB, Management, PON optical, or isolated WAN ports)
 * - 'center': Main middle bank of ports (with visual gap from left and right sections)
 * - 'right': Right section (typical for main switching matrix or SFP+ uplinks)
 */
export type PortZone = 'left' | 'center' | 'right';

export type CableColor =
  | 'blue'
  | 'yellow'
  | 'emerald'
  | 'red'
  | 'orange'
  | 'purple'
  | 'cyan'
  | 'slate';

export type CableCategory =
  | 'Cat6'
  | 'Cat6A'
  | 'Fibra OM4'
  | 'Fibra OS2 PON'
  | 'DAC 10G'
  | 'Consola Serial'
  | 'Teléfono RJ11'
  | 'Alimentación';

export type UserRole = 'admin' | 'technician';

/**
 * Port numbering schemes for multi-row switches and patch panels:
 * - 'sequential': Row 1 has 1..12, Row 2 has 13..24 (horizontal left-to-right per row)
 * - 'vertical-odd-even': Row 1 (top) has odd numbers 1, 3, 5..23; Row 2 (bottom) has even numbers 2, 4, 6..24 (1 arriba, 2 abajo)
 * - 'vertical-even-odd': Row 1 (top) has even numbers 2, 4, 6..24; Row 2 (bottom) has odd numbers 1, 3, 5..23
 */
export type PortNumberingOrder =
  | 'sequential'
  | 'vertical-odd-even'
  | 'vertical-even-odd';

export interface SystemUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

export interface DevicePort {
  id: string;
  number: number;
  label: string;
  type: PortType;
  row?: number; // 1-indexed row for multi-row patch panels or switches
  zone?: PortZone; // 'left' | 'center' | 'right' placement on faceplate
  xPercent?: number; // Optional freeform horizontal position (0% to 100%) on the device faceplate
  yPercent?: number; // Optional freeform vertical position (0% to 100%) on the device faceplate
  groupId?: string; // Optional block/group identifier for visual separation between port banks
  vlan?: string;
  speed?: string;
  // External or unknown origin connection (cable from another room/site or unknown location)
  externalOccupied?: boolean;
  externalStatus?: 'operativo' | 'inoperativo';
  externalOrigin?: string; // e.g. "Acometida exterior Fibra ISP", "Origen desconocido", "Llega de Planta 2"
  externalNotes?: string;
}

export interface CustomPortBlockSpec {
  id: string;
  labelPrefix: string;
  type: PortType;
  count: number;
  zone: PortZone;
  rows: number;
  numberingOrder?: PortNumberingOrder;
}

export type ShelfBay = 'full' | 'left' | 'right';

export interface RackDevice {
  id: string;
  templateId: string;
  name: string;
  model: string;
  category: DeviceCategory;
  uStart: number; // Bottom U position (1 to rack.totalU)
  uSize: number; // Height in U (1, 2, 3, 4)
  shelfBay?: ShelfBay; // 'full' (19" full width) or 'left' / 'right' (2 devices on same U shelf)
  ipAddress: string;
  managementVlan: string;
  serialNumber: string;
  powerWatts: number;
  status: 'nominal' | 'warning' | 'alert';
  notes: string;
  customColor?: string; // Hex color for device faceplate / chassis
  portsPerRow?: number[]; // e.g. [24] for 1-row 24p, [24, 24] for 2-row 48p
  portNumberingOrder?: PortNumberingOrder; // Order of ports across rows
  ports: DevicePort[];
}

export interface PatchCable {
  id: string;
  label: string;
  fromDeviceId: string;
  fromPortId: string;
  toDeviceId: string;
  toPortId: string;
  color: CableColor;
  category: CableCategory;
  vlan: string;
  lengthMeters: number;
}

export interface RackUnit {
  id: string;
  name: string;
  locationCode: string;
  totalU: number; // Custom height from 4U to 60U (e.g., 6, 9, 12, 18, 24, 42, 48)
  maxPowerWatts: number;
  widthMm?: number; // e.g. 600mm or 800mm
  depthMm?: number; // e.g. 450mm, 600mm, 800mm, 1000mm
  rackType?: 'floor' | 'wall' | 'open-frame' | 'custom';
  frameColor?: string; // Custom hex color for rack chassis/rails
  uNumberingDirection?: 'bottom-up' | 'top-down'; // U1 abajo o U1 arriba
  devices: RackDevice[];
  cables: PatchCable[];
}

export interface CompanyProject {
  id: string;
  companyName: string;
  projectName: string;
  siteAddress: string;
  technicalContact: string;
  updatedAt: string;
  racks: RackUnit[];
}

export interface HardwareTemplate {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: DeviceCategory;
  uSize: number;
  defaultPorts: number;
  portType: PortType;
  sfpUplinks?: number;
  portsPerRow?: number[];
  defaultNumberingOrder?: PortNumberingOrder;
  portBlocks?: CustomPortBlockSpec[]; // Optional realistic port blocks across left/center/right zones
  defaultColor?: string;
  powerWatts: number;
  defaultIp: string;
  description: string;
}

export interface ServerStorageInfo {
  storagePath: string;
  usersPath: string;
  hostname: string;
  platform: string;
  osRelease: string;
  lastSaved: string;
  fileSizeBytes: number;
  totalProjects: number;
  totalDevices: number;
  totalCables: number;
  totalUsers: number;
}
