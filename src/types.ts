export type DeviceCategory = 'firewall' | 'router' | 'switch' | 'patchpanel' | 'server' | 'ups';

export type PortType = 'rj45' | 'sfp' | 'keystone' | 'console' | 'power';

export type CableColor = 'blue' | 'yellow' | 'emerald' | 'red' | 'orange' | 'purple' | 'cyan' | 'slate';

export type CableCategory = 'Cat6' | 'Cat6A' | 'Fibra OM4' | 'DAC 10G' | 'Alimentación';

export type UserRole = 'admin' | 'technician';

/**
 * Port numbering schemes for multi-row switches and patch panels:
 * - 'sequential': Row 1 has 1..12, Row 2 has 13..24 (horizontal left-to-right per row)
 * - 'vertical-odd-even': Row 1 (top) has odd numbers 1, 3, 5..23; Row 2 (bottom) has even numbers 2, 4, 6..24 (1 arriba, 2 abajo)
 * - 'vertical-even-odd': Row 1 (top) has even numbers 2, 4, 6..24; Row 2 (bottom) has odd numbers 1, 3, 5..23
 */
export type PortNumberingOrder = 'sequential' | 'vertical-odd-even' | 'vertical-even-odd';

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
  vlan?: string;
  speed?: string;
}

export interface RackDevice {
  id: string;
  templateId: string;
  name: string;
  model: string;
  category: DeviceCategory;
  uStart: number; // Bottom U position (1 to rack.totalU)
  uSize: number;  // Height in U (1, 2, 3, 4)
  ipAddress: string;
  managementVlan: string;
  serialNumber: string;
  powerWatts: number;
  status: 'nominal' | 'warning' | 'alert';
  notes: string;
  customColor?: string;                   // Hex color for device faceplate / chassis
  portsPerRow?: number[];                 // e.g. [24] for 1-row 24p, [24, 24] for 2-row 48p
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
  totalU: number; // e.g., 42, 24, 48
  maxPowerWatts: number;
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
