export type DeviceCategory = 'firewall' | 'router' | 'switch' | 'patchpanel' | 'server' | 'ups';

export type PortType = 'rj45' | 'sfp' | 'keystone' | 'console' | 'power';

export type CableColor = 'blue' | 'yellow' | 'emerald' | 'red' | 'orange' | 'purple' | 'cyan' | 'slate';

export type CableCategory = 'Cat6' | 'Cat6A' | 'Fibra OM4' | 'DAC 10G' | 'Alimentación';

export type UserRole = 'admin' | 'technician';

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
  uSize: number;  // Height in U (1, 2, 4)
  ipAddress: string;
  managementVlan: string;
  serialNumber: string;
  powerWatts: number;
  status: 'nominal' | 'warning' | 'alert';
  notes: string;
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
