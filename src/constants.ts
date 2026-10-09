import { HardwareTemplate, CableColor, DeviceCategory, DevicePort, RackDevice } from './types';

export const HARDWARE_CATALOG: HardwareTemplate[] = [
  // Firewalls
  {
    id: 'tpl-fw-fg100f',
    name: 'Firewall Perimetral NGFW',
    brand: 'Fortinet',
    model: 'FortiGate 100F',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 12,
    portType: 'rj45',
    sfpUplinks: 4,
    powerWatts: 115,
    defaultIp: '10.10.0.1/24',
    description: 'Firewall NGFW 1U con 12x GE RJ45 + 4x 10G SFP+ SD-WAN'
  },
  {
    id: 'tpl-fw-pa440',
    name: 'Firewall Zero-Trust',
    brand: 'Palo Alto',
    model: 'PA-440 Rackmount',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 8,
    portType: 'rj45',
    sfpUplinks: 2,
    powerWatts: 65,
    defaultIp: '10.20.0.1/24',
    description: 'Cortafuegos empresarial ML-Powered con 8 puertos GbE y 2 SFP'
  },
  // Routers
  {
    id: 'tpl-rt-ccr2004',
    name: 'Router Core BGP/MPLS',
    brand: 'MikroTik',
    model: 'CCR2004-16G-2S+',
    category: 'router',
    uSize: 1,
    defaultPorts: 16,
    portType: 'rj45',
    sfpUplinks: 2,
    powerWatts: 48,
    defaultIp: '10.10.0.2/24',
    description: 'Cloud Core Router 16x Gigabit Ethernet + 2x 10G SFP+ cages'
  },
  {
    id: 'tpl-rt-isr4331',
    name: 'Router WAN Agregación',
    brand: 'Cisco',
    model: 'ISR 4331 Sec-K9',
    category: 'router',
    uSize: 1,
    defaultPorts: 6,
    portType: 'rj45',
    sfpUplinks: 2,
    powerWatts: 125,
    defaultIp: '172.16.0.1/30',
    description: 'Router de servicios integrados para enlaces dedicados fibra/MPLS'
  },
  // Patch Panels
  {
    id: 'tpl-pp-24cat6a',
    name: 'Patch Panel 24P Cat6A Blindado',
    brand: 'Panduit',
    model: 'CPP24FMWBLY 24-Port',
    category: 'patchpanel',
    uSize: 1,
    defaultPorts: 24,
    portType: 'keystone',
    sfpUplinks: 0,
    powerWatts: 0,
    defaultIp: 'Pasivo (Nivel 1)',
    description: 'Panel de parcheo modular 24 puertos Keystone RJ45 numerados 01-24'
  },
  {
    id: 'tpl-pp-12fiber',
    name: 'Bandeja Fibra Óptica ODF 12P',
    brand: 'Corning',
    model: 'LANscape 1U LC-Duplex',
    category: 'patchpanel',
    uSize: 1,
    defaultPorts: 12,
    portType: 'sfp',
    sfpUplinks: 0,
    powerWatts: 0,
    defaultIp: 'Pasivo (Óptico)',
    description: 'Distribuidor óptico 1U para acometidas troncales OM4/OS2'
  },
  // Switches
  {
    id: 'tpl-sw-c9300-24',
    name: 'Switch Core L3 PoE+ 24P',
    brand: 'Cisco',
    model: 'Catalyst 9300-24P',
    category: 'switch',
    uSize: 1,
    defaultPorts: 24,
    portType: 'rj45',
    sfpUplinks: 4,
    powerWatts: 350,
    defaultIp: '10.10.1.10/24',
    description: 'Switch apilable 24 puertos PoE+ y 4 uplinks 10G SFP+'
  },
  {
    id: 'tpl-sw-usw-pro-24',
    name: 'Switch Acceso Distribución 24P',
    brand: 'Ubiquiti',
    model: 'USW-Pro-24-PoE',
    category: 'switch',
    uSize: 1,
    defaultPorts: 24,
    portType: 'rj45',
    sfpUplinks: 2,
    powerWatts: 280,
    defaultIp: '10.10.1.11/24',
    description: 'Switch L2/L3 gestionable con 24x GbE RJ45 y 2x 10G SFP+'
  },
  // Servers
  {
    id: 'tpl-srv-ubuntu-1u',
    name: 'Ubuntu Server 24.04 LTS (1U)',
    brand: 'Dell EMC',
    model: 'PowerEdge R660 XS',
    category: 'server',
    uSize: 1,
    defaultPorts: 4,
    portType: 'rj45',
    sfpUplinks: 2,
    powerWatts: 420,
    defaultIp: '10.10.10.20/24',
    description: 'Servidor 1U Dual Xeon, 128GB RAM, 4x 1GbE + iDRAC + 2x 10G SFP+'
  },
  {
    id: 'tpl-srv-proxmox-2u',
    name: 'Hipervisor KVM / Ubuntu Cluster (2U)',
    brand: 'HPE',
    model: 'ProLiant DL380 Gen11',
    category: 'server',
    uSize: 2,
    defaultPorts: 6,
    portType: 'rj45',
    sfpUplinks: 2,
    powerWatts: 680,
    defaultIp: '10.10.10.30/24',
    description: 'Chasis 2U 12 bahías NVMe para virtualización intensiva y contenedores'
  },
  {
    id: 'tpl-srv-nas-4u',
    name: 'Storage ZFS / Backup Vault (4U)',
    brand: 'Supermicro',
    model: 'SuperStorage 6049P-E1CR24L',
    category: 'server',
    uSize: 4,
    defaultPorts: 4,
    portType: 'rj45',
    sfpUplinks: 4,
    powerWatts: 850,
    defaultIp: '10.10.10.50/24',
    description: 'Cabina de almacenamiento masivo 4U 24 bahías SAS/SATA ZFS en Ubuntu'
  },
  // UPS
  {
    id: 'tpl-ups-apc-2u',
    name: 'SAI / UPS Smart-UPS 3000VA',
    brand: 'APC Schneider',
    model: 'SMT3000RMI2U',
    category: 'ups',
    uSize: 2,
    defaultPorts: 2,
    portType: 'rj45',
    sfpUplinks: 0,
    powerWatts: 90,
    defaultIp: '10.10.99.5/24',
    description: 'Sistema de alimentación ininterrumpida 2U con tarjeta de red SNMP'
  }
];

export const CABLE_COLORS: { id: CableColor; name: string; hex: string; purpose: string }[] = [
  { id: 'blue', name: 'Azul (LAN Datos)', hex: '#3B82F6', purpose: 'Datos / Puestos de Trabajo' },
  { id: 'yellow', name: 'Amarillo (WAN / DMZ)', hex: '#EAB308', purpose: 'Enlaces Críticos / DMZ' },
  { id: 'emerald', name: 'Verde (VoIP / Gestión)', hex: '#10B981', purpose: 'Gestión IPMI / VoIP' },
  { id: 'red', name: 'Rojo (Firewall / Crítico)', hex: '#EF4444', purpose: 'Uplink Cortafuegos / Alarma' },
  { id: 'cyan', name: 'Cian (Fibra OM4 10G)', hex: '#06B6D4', purpose: 'Troncales Fibra 10G/40G' },
  { id: 'purple', name: 'Violeta (Servidores / SAN)', hex: '#A855F7', purpose: 'Tráfico Cluster / Storage' },
  { id: 'orange', name: 'Naranja (IoT / CCTV)', hex: '#F97316', purpose: 'Seguridad Física / Cámaras' },
  { id: 'slate', name: 'Gris (Cross-Connect)', hex: '#94A3B8', purpose: 'Parcheo Estándar' }
];

export const CATEGORY_LABELS: Record<DeviceCategory, string> = {
  firewall: 'Firewall',
  router: 'Router',
  patchpanel: 'Patch Panel',
  switch: 'Switch',
  server: 'Servidor',
  ups: 'SAI / Energía'
};

export function createDeviceFromTemplate(
  template: HardwareTemplate,
  uStart: number,
  customSuffix?: number
): RackDevice {
  const id = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const ports: DevicePort[] = [];

  for (let i = 1; i <= template.defaultPorts; i++) {
    const prefix =
      template.category === 'patchpanel'
        ? 'P'
        : template.category === 'firewall'
        ? 'WAN/LAN'
        : template.category === 'server'
        ? 'eno'
        : 'GE';
    ports.push({
      id: `${id}-p${i}`,
      number: i,
      label: `${prefix}${i.toString().padStart(2, '0')}`,
      type: template.portType,
      vlan: template.category === 'patchpanel' ? '10' : '1',
      speed: template.portType === 'sfp' ? '10G' : '1G'
    });
  }

  const sfpCount = template.sfpUplinks || 0;
  for (let s = 1; s <= sfpCount; s++) {
    const num = template.defaultPorts + s;
    ports.push({
      id: `${id}-sfp${s}`,
      number: num,
      label: `SFP+${s}`,
      type: 'sfp',
      vlan: 'Trunk',
      speed: '10G'
    });
  }

  const suffixStr = customSuffix ? ` #${customSuffix}` : '';
  return {
    id,
    templateId: template.id,
    name: `${template.name}${suffixStr}`,
    model: `${template.brand} ${template.model}`,
    category: template.category,
    uStart,
    uSize: template.uSize,
    ipAddress: template.defaultIp,
    managementVlan: template.category === 'patchpanel' ? 'N/A' : 'VLAN 10 (Mgmt)',
    serialNumber: `SN-${template.brand.substring(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`,
    powerWatts: template.powerWatts,
    status: 'nominal',
    notes: `${template.description}. Instalado en U${uStart}.`,
    ports
  };
}
