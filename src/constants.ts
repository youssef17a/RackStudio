import {
  HardwareTemplate,
  CableColor,
  DeviceCategory,
  DevicePort,
  RackDevice,
  PortNumberingOrder,
  PortType,
  PortZone,
  CustomPortBlockSpec
} from './types';

export const DEVICE_COLOR_PALETTE: { id: string; name: string; hex: string }[] = [
  { id: 'slate', name: 'Gris Antracita (Estándar)', hex: '#1E293B' },
  { id: 'crimson', name: 'Rojo Fortinet / WatchGuard', hex: '#7F1D1D' },
  { id: 'movistar', name: 'Azul Movistar / ONT / Teldat', hex: '#0369A1' },
  { id: 'indigo', name: 'Índigo Core / MikroTik / Cisco', hex: '#312E81' },
  { id: 'emerald', name: 'Verde Switching / Catalyst', hex: '#065F46' },
  { id: 'teal', name: 'Turquesa Aruba / UniFi', hex: '#115E59' },
  { id: 'purple', name: 'Violeta Hipervisor / Proxmox / SAN', hex: '#581C87' },
  { id: 'amber', name: 'Ámbar SAI / Energía / Industrial', hex: '#78350F' },
  { id: 'orange', name: 'Naranja Bandeja Fibra ODF / Livebox', hex: '#7C2D12' },
  { id: 'obsidian', name: 'Negro Carbón (Patch Panel / PDU)', hex: '#0F172A' }
];

export const PORT_TYPE_META: Record<
  PortType,
  { label: string; shortTag: string; badgeClass: string }
> = {
  rj45: {
    label: 'RJ45 Ethernet (LAN/WAN)',
    shortTag: 'RJ45',
    badgeClass: 'bg-slate-900 text-slate-200 border-slate-700'
  },
  sfp: {
    label: 'Fibra SFP / SFP+ / QSFP',
    shortTag: 'SFP+',
    badgeClass: 'bg-slate-950 text-cyan-300 border-cyan-800/90'
  },
  pon: {
    label: 'Fibra Óptica GPON / XGS-PON (SC/APC Verde)',
    shortTag: 'PON',
    badgeClass: 'bg-emerald-950 text-emerald-300 border-emerald-600'
  },
  console: {
    label: 'Consola Serie RS-232 / RJ45 Rollover',
    shortTag: 'CON',
    badgeClass: 'bg-sky-950 text-sky-300 border-sky-600'
  },
  usb: {
    label: 'Puerto USB 3.0 / Módem 4G / Consola USB',
    shortTag: 'USB',
    badgeClass: 'bg-indigo-950 text-indigo-300 border-indigo-600'
  },
  fxs: {
    label: 'Telefonía Analógica RJ11 (FXS / FXO)',
    shortTag: 'TEL',
    badgeClass: 'bg-purple-950 text-purple-300 border-purple-600'
  },
  keystone: {
    label: 'Keystone Patch Panel (RJ45 / Cat6A)',
    shortTag: 'KEY',
    badgeClass: 'bg-slate-950 text-slate-300 border-slate-700'
  },
  coax: {
    label: 'Coaxial RF / Antena / BNC',
    shortTag: 'BNC',
    badgeClass: 'bg-amber-950 text-amber-300 border-amber-700'
  },
  power: {
    label: 'Toma Eléctrica IEC C13 / C14 / Schuko',
    shortTag: 'PWR',
    badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-600'
  }
};

export const HARDWARE_CATALOG: HardwareTemplate[] = [
  // =========================================================================
  // ONTs FIBRA Y ROUTERS OPERADORAS (Movistar HGU, Huawei, Nokia, ZTE, Orange, Vodafone)
  // =========================================================================
  {
    id: 'tpl-ont-movistar-hgu',
    name: 'Router Movistar HGU Fibra Smart WiFi 6',
    brand: 'Movistar',
    model: 'Mitrastar / Askey HGU GPT-2741GNAC',
    category: 'ont',
    uSize: 1,
    defaultPorts: 7,
    portType: 'rj45',
    defaultColor: '#0369A1',
    powerWatts: 24,
    defaultIp: '192.168.1.1/24',
    description:
      'Izquierda: 1x Fibra PON SC/APC + 1x Teléfono RJ11 + 1x USB · Derecha: 4x LAN Gigabit RJ45',
    portBlocks: [
      { id: 'b-pon', labelPrefix: 'PON', type: 'pon', count: 1, zone: 'left', rows: 1 },
      { id: 'b-fxs', labelPrefix: 'TEL', type: 'fxs', count: 1, zone: 'left', rows: 1 },
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
      { id: 'b-lan', labelPrefix: 'LAN', type: 'rj45', count: 4, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-ont-huawei-hg8240h',
    name: 'ONT GPON Huawei / Nokia (1x PON + 4x GE + 2x TEL)',
    brand: 'Huawei / Nokia',
    model: 'EchoLife HG8240H / G-240G-E',
    category: 'ont',
    uSize: 1,
    defaultPorts: 7,
    portType: 'rj45',
    defaultColor: '#0369A1',
    powerWatts: 18,
    defaultIp: '192.168.100.1/24',
    description:
      'Terminal ONT puro de operadora: Fibra GPON verde a la izquierda, 2x RJ11 POTS en el centro y 4x GbE a la derecha',
    portBlocks: [
      { id: 'b-pon', labelPrefix: 'GPON', type: 'pon', count: 1, zone: 'left', rows: 1 },
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
      { id: 'b-tel', labelPrefix: 'POTS', type: 'fxs', count: 2, zone: 'center', rows: 1 },
      { id: 'b-lan', labelPrefix: 'LAN', type: 'rj45', count: 4, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-ont-ufiber-loco',
    name: 'ONT Ubiquiti UFiber / ZTE F601 Bridge (1x PON + 1x GE)',
    brand: 'Ubiquiti / ZTE',
    model: 'UFiber Nano G / ZTE F601',
    category: 'ont',
    uSize: 1,
    defaultPorts: 2,
    portType: 'rj45',
    defaultColor: '#0369A1',
    powerWatts: 7,
    defaultIp: '192.168.1.1/24',
    description: 'ONT monopuerto en modo bridge transparente (1x SC/APC GPON + 1x RJ45 WAN)',
    portBlocks: [
      { id: 'b-pon', labelPrefix: 'PON', type: 'pon', count: 1, zone: 'left', rows: 1 },
      { id: 'b-ge', labelPrefix: 'LAN1', type: 'rj45', count: 1, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-rt-orange-livebox',
    name: 'Router Orange Livebox Fibra Pro XGS-PON',
    brand: 'Orange',
    model: 'Livebox 6 Pro / 7 Empresas',
    category: 'ont',
    uSize: 1,
    defaultPorts: 8,
    portType: 'rj45',
    defaultColor: '#7C2D12',
    powerWatts: 28,
    defaultIp: '192.168.1.1/24',
    description:
      'Izquierda: 1x Fibra PON + 2x Voz RJ11 + 1x USB 3.0 · Derecha: 4x LAN GbE + 1x WAN/LAN 2.5G',
    portBlocks: [
      { id: 'b-pon', labelPrefix: 'PON', type: 'pon', count: 1, zone: 'left', rows: 1 },
      { id: 'b-tel', labelPrefix: 'TEL', type: 'fxs', count: 2, zone: 'left', rows: 1 },
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'center', rows: 1 },
      { id: 'b-lan', labelPrefix: 'LAN', type: 'rj45', count: 4, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-rt-vodafone-one',
    name: 'Router Vodafone Empresas Fibra + Backup 4G USB',
    brand: 'Vodafone',
    model: 'Wi-Fi 6 Station Sercomm H500',
    category: 'ont',
    uSize: 1,
    defaultPorts: 8,
    portType: 'rj45',
    defaultColor: '#7F1D1D',
    powerWatts: 25,
    defaultIp: '192.168.0.1/24',
    description:
      'Izquierda: 1x Fibra PON + 2x Teléfono RJ11 + 1x USB Dongle 4G · Derecha: 4x LAN RJ45',
    portBlocks: [
      { id: 'b-pon', labelPrefix: 'PON', type: 'pon', count: 1, zone: 'left', rows: 1 },
      { id: 'b-tel', labelPrefix: 'TEL', type: 'fxs', count: 2, zone: 'left', rows: 1 },
      { id: 'b-usb', labelPrefix: 'USB4G', type: 'usb', count: 1, zone: 'center', rows: 1 },
      { id: 'b-lan', labelPrefix: 'LAN', type: 'rj45', count: 4, zone: 'right', rows: 1 }
    ]
  },

  // =========================================================================
  // SWITCHES DE TODOS LOS TAMAÑOS (4, 5, 8, 10, 12, 16, 24, 28, 48, 52 PUERTOS)
  // =========================================================================
  {
    id: 'tpl-sw-4p-ind',
    name: 'Switch Compacto 4 Puertos PoE+ (+1 Uplink)',
    brand: 'Ubiquiti',
    model: 'USW-Flex-Mini / Industrial 4P',
    category: 'switch',
    uSize: 1,
    defaultPorts: 5,
    portType: 'rj45',
    defaultColor: '#065F46',
    powerWatts: 15,
    defaultIp: '10.10.1.4/24',
    description: 'Izquierda: 1x Puerto Uplink PoE-In · Derecha: 4x Puertos RJ45 GbE',
    portBlocks: [
      { id: 'b-up', labelPrefix: 'UPLINK', type: 'rj45', count: 1, zone: 'left', rows: 1 },
      { id: 'b-ge', labelPrefix: 'GE', type: 'rj45', count: 4, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-sw-5p-desk',
    name: 'Switch 5 Puertos Gigabit (Bandeja 1U)',
    brand: 'TP-Link',
    model: 'TL-SG105E / Netgear GS305E 5P',
    category: 'switch',
    uSize: 1,
    defaultPorts: 5,
    portsPerRow: [5],
    defaultNumberingOrder: 'sequential',
    portType: 'rj45',
    sfpUplinks: 0,
    defaultColor: '#115E59',
    powerWatts: 10,
    defaultIp: '192.168.0.5/24',
    description: 'Switch compacto Smart VLAN de 5 puertos Gigabit RJ45'
  },
  {
    id: 'tpl-sw-8p-poe',
    name: 'Switch 8 Puertos PoE+ (+1 Consola + 2 SFP)',
    brand: 'Cisco',
    model: 'Catalyst C1000-8P-2G-L',
    category: 'switch',
    uSize: 1,
    defaultPorts: 11,
    portType: 'rj45',
    defaultColor: '#065F46',
    powerWatts: 150,
    defaultIp: '10.10.1.8/24',
    description:
      'Izquierda: 1x Consola Serie RJ45 + 1x USB · Centro: 8x PoE+ GbE · Derecha: 2x SFP Fibra',
    portBlocks: [
      { id: 'b-con', labelPrefix: 'CON', type: 'console', count: 1, zone: 'left', rows: 1 },
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
      { id: 'b-ge', labelPrefix: 'GE', type: 'rj45', count: 8, zone: 'center', rows: 1 },
      { id: 'b-sfp', labelPrefix: 'SFP', type: 'sfp', count: 2, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-sw-10p-smart',
    name: 'Switch 10 Puertos Smart Managed (8x GE + 2x SFP)',
    brand: 'Cisco',
    model: 'CBS250-8PP-E-2G (10P Total)',
    category: 'switch',
    uSize: 1,
    defaultPorts: 10,
    portType: 'rj45',
    defaultColor: '#065F46',
    powerWatts: 110,
    defaultIp: '10.10.1.9/24',
    description: '8 puertos RJ45 PoE en bloque central + 2 puertos Combo SFP separados a la derecha',
    portBlocks: [
      { id: 'b-ge', labelPrefix: 'GE', type: 'rj45', count: 8, zone: 'center', rows: 1 },
      { id: 'b-sfp', labelPrefix: 'SFP', type: 'sfp', count: 2, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-sw-12p-10g',
    name: 'Switch Agregación 12 Puertos (Consola + 8x RJ45 + 4x SFP+)',
    brand: 'MikroTik',
    model: 'CRS312-4C+8XG-RM (12P 10G)',
    category: 'switch',
    uSize: 1,
    defaultPorts: 13,
    portType: 'rj45',
    defaultColor: '#115E59',
    powerWatts: 120,
    defaultIp: '10.10.1.12/24',
    description:
      'Izquierda: 1x Consola Serie · Centro: 8x 10GbE RJ45 · Derecha: 4x Combo 10G SFP+',
    portBlocks: [
      { id: 'b-con', labelPrefix: 'CON', type: 'console', count: 1, zone: 'left', rows: 1 },
      { id: 'b-xg', labelPrefix: 'XG', type: 'rj45', count: 8, zone: 'center', rows: 1 },
      { id: 'b-sfp', labelPrefix: 'SFP+', type: 'sfp', count: 4, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-sw-12p-fiber',
    name: 'Switch Core Fibra 12 Puertos SFP+ 10G',
    brand: 'Ubiquiti',
    model: 'USW-Aggregation 12-SFP+',
    category: 'switch',
    uSize: 1,
    defaultPorts: 12,
    portsPerRow: [12],
    defaultNumberingOrder: 'sequential',
    portType: 'sfp',
    sfpUplinks: 0,
    defaultColor: '#1E293B',
    powerWatts: 65,
    defaultIp: '10.10.1.2/24',
    description: 'Switch de agregación óptica 100% fibra con 12 jaulas SFP+ 10G en 1 fila'
  },
  {
    id: 'tpl-sw-16p-poe',
    name: 'Switch 16 Puertos PoE+ (2 Filas x 8 + 2 SFP)',
    brand: 'Ubiquiti',
    model: 'USW-16-PoE / Aruba 1930-16G',
    category: 'switch',
    uSize: 1,
    defaultPorts: 18,
    portType: 'rj45',
    defaultColor: '#065F46',
    powerWatts: 210,
    defaultIp: '10.10.1.16/24',
    description: 'Centro: 16 puertos RJ45 PoE+ (2 filas: 1 arriba / 2 abajo) · Derecha: 2x SFP',
    portBlocks: [
      {
        id: 'b-ge',
        labelPrefix: 'GE',
        type: 'rj45',
        count: 16,
        zone: 'center',
        rows: 2,
        numberingOrder: 'vertical-odd-even'
      },
      { id: 'b-sfp', labelPrefix: 'SFP', type: 'sfp', count: 2, zone: 'right', rows: 2 }
    ]
  },
  {
    id: 'tpl-sw-c9300-24',
    name: 'Switch Core L3 Catalyst 24P PoE+ (Consola + 24x GE + 4x SFP+)',
    brand: 'Cisco',
    model: 'Catalyst 9300-24P (2 Filas x 12)',
    category: 'switch',
    uSize: 1,
    defaultPorts: 29,
    portType: 'rj45',
    defaultColor: '#065F46',
    powerWatts: 350,
    defaultIp: '10.10.1.10/24',
    description:
      'Izquierda: 1x Consola RJ45 · Centro: 24x PoE+ (2 filas: 1 arriba, 2 abajo) · Derecha: 4x 10G SFP+',
    portBlocks: [
      { id: 'b-con', labelPrefix: 'CON', type: 'console', count: 1, zone: 'left', rows: 1 },
      {
        id: 'b-ge',
        labelPrefix: 'GE',
        type: 'rj45',
        count: 24,
        zone: 'center',
        rows: 2,
        numberingOrder: 'vertical-odd-even'
      },
      { id: 'b-sfp', labelPrefix: 'SFP+', type: 'sfp', count: 4, zone: 'right', rows: 2 }
    ]
  },
  {
    id: 'tpl-sw-usw-pro-24',
    name: 'Switch UniFi Pro 24 PoE (1 Fila x 24 + 2 SFP+)',
    brand: 'Ubiquiti',
    model: 'USW-Pro-24-PoE',
    category: 'switch',
    uSize: 1,
    defaultPorts: 24,
    portsPerRow: [12, 12],
    defaultNumberingOrder: 'sequential',
    portType: 'rj45',
    sfpUplinks: 2,
    defaultColor: '#065F46',
    powerWatts: 280,
    defaultIp: '10.10.1.11/24',
    description: 'Switch L2/L3 gestionable con 24x GbE RJ45 + 2x 10G SFP+ a la derecha'
  },
  {
    id: 'tpl-sw-aruba-2930f',
    name: 'Switch Aruba CX 6200F / 2930F 24G (+Consola/USB + 4 SFP+)',
    brand: 'Aruba',
    model: 'JL255A 2930F-24G-PoE+-4SFP+',
    category: 'switch',
    uSize: 1,
    defaultPorts: 30,
    portType: 'rj45',
    defaultColor: '#115E59',
    powerWatts: 320,
    defaultIp: '10.10.1.15/24',
    description:
      'Izquierda: Consola + USB · Centro: 24x PoE+ (impares arriba, pares abajo) · Derecha: 4x 10G SFP+',
    portBlocks: [
      { id: 'b-con', labelPrefix: 'CON', type: 'console', count: 1, zone: 'left', rows: 1 },
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
      {
        id: 'b-ge',
        labelPrefix: 'GE',
        type: 'rj45',
        count: 24,
        zone: 'center',
        rows: 2,
        numberingOrder: 'vertical-odd-even'
      },
      { id: 'b-sfp', labelPrefix: 'SFP+', type: 'sfp', count: 4, zone: 'right', rows: 2 }
    ]
  },
  {
    id: 'tpl-sw-fortiswitch-124f',
    name: 'FortiSwitch 124F-FPOE 24P FortiLink',
    brand: 'Fortinet',
    model: 'FS-124F-FPOE',
    category: 'switch',
    uSize: 1,
    defaultPorts: 29,
    portType: 'rj45',
    defaultColor: '#065F46',
    powerWatts: 370,
    defaultIp: '10.10.1.20/24',
    description:
      'Izquierda: 1x Consola RJ45 · Centro: 24x GE PoE+ (2 filas x 12) · Derecha: 4x SFP+ FortiLink',
    portBlocks: [
      { id: 'b-con', labelPrefix: 'CON', type: 'console', count: 1, zone: 'left', rows: 1 },
      {
        id: 'b-ge',
        labelPrefix: 'GE',
        type: 'rj45',
        count: 24,
        zone: 'center',
        rows: 2,
        numberingOrder: 'vertical-odd-even'
      },
      { id: 'b-sfp', labelPrefix: 'SFP+', type: 'sfp', count: 4, zone: 'right', rows: 2 }
    ]
  },
  {
    id: 'tpl-sw-c9300-48',
    name: 'Switch Core L3 Catalyst 48P (+Consola + 4 SFP+)',
    brand: 'Cisco',
    model: 'Catalyst 9300-48P (4 Filas x 12)',
    category: 'switch',
    uSize: 1,
    defaultPorts: 48,
    portsPerRow: [12, 12, 12, 12],
    defaultNumberingOrder: 'vertical-odd-even',
    portType: 'rj45',
    sfpUplinks: 4,
    defaultColor: '#065F46',
    powerWatts: 480,
    defaultIp: '10.10.1.48/24',
    description: 'Switch alta densidad 48 puertos RJ45 PoE+ (1 arriba, 2 abajo) + 4 SFP+ (52 total)'
  },
  {
    id: 'tpl-sw-usw-pro-48',
    name: 'Switch UniFi Pro 48 PoE (+4 SFP+)',
    brand: 'Ubiquiti',
    model: 'USW-Pro-48-PoE (52P Total)',
    category: 'switch',
    uSize: 1,
    defaultPorts: 48,
    portsPerRow: [12, 12, 12, 12],
    defaultNumberingOrder: 'vertical-odd-even',
    portType: 'rj45',
    sfpUplinks: 4,
    defaultColor: '#115E59',
    powerWatts: 600,
    defaultIp: '10.10.1.49/24',
    description: 'Switch 48 puertos GbE PoE+/PoE++ en bloques de 12 + 4 uplinks 10G SFP+'
  },

  // =========================================================================
  // FIREWALLS (Fortinet, Palo Alto, WatchGuard, SonicWall, Check Point, Sophos, pfSense)
  // =========================================================================
  {
    id: 'tpl-fw-fg40f',
    name: 'FortiGate 60F / 40F SD-WAN (USB + Consola + WAN + DMZ + LAN)',
    brand: 'Fortinet',
    model: 'FortiGate 60F Rackmount',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 12,
    portType: 'rj45',
    defaultColor: '#7F1D1D',
    powerWatts: 25,
    defaultIp: '192.168.1.99/24',
    description:
      'Izquierda: 1x USB + 1x Consola RJ45 · Centro: 2x WAN + 1x DMZ · Derecha: 7x Internal RJ45',
    portBlocks: [
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
      { id: 'b-con', labelPrefix: 'CON', type: 'console', count: 1, zone: 'left', rows: 1 },
      { id: 'b-wan', labelPrefix: 'WAN', type: 'rj45', count: 2, zone: 'center', rows: 1 },
      { id: 'b-dmz', labelPrefix: 'DMZ', type: 'rj45', count: 1, zone: 'center', rows: 1 },
      { id: 'b-lan', labelPrefix: 'INT', type: 'rj45', count: 7, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-fw-fg100f',
    name: 'Firewall Perimetral FortiGate 100F (Consola/MGMT + 16x GE + 4x SFP+)',
    brand: 'Fortinet',
    model: 'FortiGate 100F',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 24,
    portType: 'rj45',
    defaultColor: '#7F1D1D',
    powerWatts: 115,
    defaultIp: '10.10.0.1/24',
    description:
      'Izquierda: USB + Consola + HA/MGMT · Centro: 16x GE RJ45 (2 filas) · Derecha: 4x 10G SFP+',
    portBlocks: [
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
      { id: 'b-con', labelPrefix: 'CON', type: 'console', count: 1, zone: 'left', rows: 1 },
      { id: 'b-mgmt', labelPrefix: 'MGMT', type: 'rj45', count: 2, zone: 'left', rows: 2 },
      {
        id: 'b-ge',
        labelPrefix: 'PORT',
        type: 'rj45',
        count: 16,
        zone: 'center',
        rows: 2,
        numberingOrder: 'vertical-odd-even'
      },
      { id: 'b-sfp', labelPrefix: 'SFP+', type: 'sfp', count: 4, zone: 'right', rows: 2 }
    ]
  },
  {
    id: 'tpl-fw-fg200f',
    name: 'Firewall DataCenter FortiGate 200F',
    brand: 'Fortinet',
    model: 'FortiGate 200F',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 18,
    portsPerRow: [9, 9],
    defaultNumberingOrder: 'vertical-odd-even',
    portType: 'rj45',
    sfpUplinks: 8,
    defaultColor: '#7F1D1D',
    powerWatts: 145,
    defaultIp: '10.10.0.254/24',
    description: 'Cortafuegos NGFW de alta densidad 18x GE RJ45 + 8x 10G SFP+'
  },
  {
    id: 'tpl-fw-pa440',
    name: 'Firewall Zero-Trust Palo Alto PA-440',
    brand: 'PaloAlto',
    model: 'PA-440 Rackmount',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 11,
    portType: 'rj45',
    defaultColor: '#7C2D12',
    powerWatts: 65,
    defaultIp: '10.20.0.1/24',
    description:
      'Izquierda: 1x Consola + 1x USB + 1x MGMT · Derecha: 8x Puertos Ethernet GbE',
    portBlocks: [
      { id: 'b-con', labelPrefix: 'CON', type: 'console', count: 1, zone: 'left', rows: 1 },
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
      { id: 'b-mgmt', labelPrefix: 'MGT', type: 'rj45', count: 1, zone: 'left', rows: 1 },
      { id: 'b-eth', labelPrefix: 'ETH', type: 'rj45', count: 8, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-fw-watchguard-m290',
    name: 'WatchGuard Firebox M290 / M390 Security',
    brand: 'WatchGuard',
    model: 'Firebox M290',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 12,
    portType: 'rj45',
    defaultColor: '#991B1B',
    powerWatts: 75,
    defaultIp: '10.0.1.1/24',
    description: 'Izquierda: 2x USB + 1x Consola Serial · Centro: 8x GbE · Derecha: 2x SFP+',
    portBlocks: [
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 2, zone: 'left', rows: 1 },
      { id: 'b-con', labelPrefix: 'CON', type: 'console', count: 1, zone: 'left', rows: 1 },
      { id: 'b-eth', labelPrefix: 'ETH', type: 'rj45', count: 8, zone: 'center', rows: 1 },
      { id: 'b-sfp', labelPrefix: 'SFP+', type: 'sfp', count: 2, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-fw-netgate-pfsense',
    name: 'Netgate 6100 / 8200 pfSense+',
    brand: 'Netgate',
    model: 'pfSense+ 6100 Max 1U',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 12,
    portType: 'rj45',
    defaultColor: '#1E293B',
    powerWatts: 45,
    defaultIp: '192.168.1.1/24',
    description:
      'Izquierda: Consola + USB · Centro: 4x 2.5G LAN + 2x 1G WAN · Derecha: 4x 10G SFP+',
    portBlocks: [
      { id: 'b-con', labelPrefix: 'CON', type: 'console', count: 1, zone: 'left', rows: 1 },
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
      { id: 'b-igc', labelPrefix: 'IGC', type: 'rj45', count: 6, zone: 'center', rows: 1 },
      { id: 'b-sfp', labelPrefix: 'IX', type: 'sfp', count: 4, zone: 'right', rows: 1 }
    ]
  },

  // =========================================================================
  // ROUTERS CORPORATIVOS (Teldat, MikroTik, Cisco ISR, Ubiquiti UDM)
  // =========================================================================
  {
    id: 'tpl-rt-movistar-teldat',
    name: 'Router Movistar Empresas Macrolan / VPN Teldat',
    brand: 'Teldat',
    model: 'Teldat M1 / C1+ Rack',
    category: 'router',
    uSize: 1,
    defaultPorts: 9,
    portType: 'rj45',
    defaultColor: '#0369A1',
    powerWatts: 35,
    defaultIp: '10.0.0.1/30',
    description:
      'Izquierda: 1x Consola Serial + 1x Fibra SFP WAN · Centro: 4x LAN Switch · Derecha: 2x GE WAN',
    portBlocks: [
      { id: 'b-con', labelPrefix: 'CON', type: 'console', count: 1, zone: 'left', rows: 1 },
      { id: 'b-sfp', labelPrefix: 'SFP', type: 'sfp', count: 2, zone: 'left', rows: 1 },
      { id: 'b-lan', labelPrefix: 'LAN', type: 'rj45', count: 4, zone: 'center', rows: 1 },
      { id: 'b-wan', labelPrefix: 'WAN', type: 'rj45', count: 2, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-rt-ccr2004',
    name: 'Router Core BGP/MPLS MikroTik CCR2004 (16G + 2S+)',
    brand: 'MikroTik',
    model: 'CCR2004-16G-2S+',
    category: 'router',
    uSize: 1,
    defaultPorts: 20,
    portType: 'rj45',
    defaultColor: '#312E81',
    powerWatts: 48,
    defaultIp: '10.10.0.2/24',
    description:
      'Izquierda: 1x Consola RJ45 + 1x USB + 2x 10G SFP+ · Derecha: 16x Gigabit Ethernet (2 filas x 8)',
    portBlocks: [
      { id: 'b-con', labelPrefix: 'CON', type: 'console', count: 1, zone: 'left', rows: 1 },
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
      { id: 'b-sfp', labelPrefix: 'SFP+', type: 'sfp', count: 2, zone: 'left', rows: 1 },
      {
        id: 'b-ge',
        labelPrefix: 'ETH',
        type: 'rj45',
        count: 16,
        zone: 'right',
        rows: 2,
        numberingOrder: 'vertical-odd-even'
      }
    ]
  },
  {
    id: 'tpl-rt-rb5009',
    name: 'Router MikroTik RB5009 / RB4011 (1x SFP+ Izq + 8x GE Der)',
    brand: 'MikroTik',
    model: 'RB5009UPr+S+IN (Kit 1U)',
    category: 'router',
    uSize: 1,
    defaultPorts: 10,
    portType: 'rj45',
    defaultColor: '#312E81',
    powerWatts: 30,
    defaultIp: '192.168.88.1/24',
    description: 'Izquierda: 1x USB 3.0 + 1x 10G SFP+ · Derecha: 1x 2.5GbE + 7x 1GbE RJ45',
    portBlocks: [
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
      { id: 'b-sfp', labelPrefix: 'SFP+', type: 'sfp', count: 1, zone: 'left', rows: 1 },
      { id: 'b-eth', labelPrefix: 'ETH', type: 'rj45', count: 8, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-rt-isr4331',
    name: 'Router WAN Agregación Cisco ISR 4331',
    brand: 'Cisco',
    model: 'ISR 4331 Sec-K9',
    category: 'router',
    uSize: 1,
    defaultPorts: 8,
    portType: 'rj45',
    defaultColor: '#312E81',
    powerWatts: 125,
    defaultIp: '172.16.0.1/30',
    description:
      'Izquierda: 1x Consola + 1x USB + 1x AUX · Centro: 3x GE WAN · Derecha: 2x SFP Fibra',
    portBlocks: [
      { id: 'b-con', labelPrefix: 'CON', type: 'console', count: 2, zone: 'left', rows: 1 },
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
      { id: 'b-ge', labelPrefix: 'GI0/0', type: 'rj45', count: 3, zone: 'center', rows: 1 },
      { id: 'b-sfp', labelPrefix: 'SFP', type: 'sfp', count: 2, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-rt-udm-pro',
    name: 'UniFi Dream Machine Pro / SE',
    brand: 'Ubiquiti',
    model: 'UDM-Pro-SE',
    category: 'router',
    uSize: 1,
    defaultPorts: 11,
    portType: 'rj45',
    defaultColor: '#1E293B',
    powerWatts: 50,
    defaultIp: '192.168.1.1/24',
    description:
      'Centro: 8 puertos Switch RJ45 (2 filas x 4) · Derecha: 1x WAN 2.5G + 2x 10G SFP+',
    portBlocks: [
      {
        id: 'b-sw',
        labelPrefix: 'LAN',
        type: 'rj45',
        count: 8,
        zone: 'center',
        rows: 2,
        numberingOrder: 'vertical-odd-even'
      },
      { id: 'b-wan', labelPrefix: 'WAN', type: 'rj45', count: 1, zone: 'right', rows: 1 },
      { id: 'b-sfp', labelPrefix: 'SFP+', type: 'sfp', count: 2, zone: 'right', rows: 2 }
    ]
  },

  // =========================================================================
  // PATCH PANELS (Configurables por filas: 8, 12, 16, 24, 48 puertos, Fibra ODF)
  // =========================================================================
  {
    id: 'tpl-pp-24cat6a',
    name: 'Patch Panel 24P Cat6A (Configurable por Filas)',
    brand: 'Panduit',
    model: 'CPP24FMWBLY 24-Port 1U',
    category: 'patchpanel',
    uSize: 1,
    defaultPorts: 24,
    portsPerRow: [24],
    defaultNumberingOrder: 'sequential',
    portType: 'keystone',
    sfpUplinks: 0,
    defaultColor: '#0F172A',
    powerWatts: 0,
    defaultIp: 'Pasivo (Nivel 1)',
    description: 'Panel de parcheo modular de 24 tomas Keystone RJ45 (pregunta filas y puntos al montar)'
  },
  {
    id: 'tpl-pp-48cat6a',
    name: 'Patch Panel 48P Alta Densidad (2 Filas x 24)',
    brand: 'CommScope',
    model: 'CPP48HD 48-Port 2U',
    category: 'patchpanel',
    uSize: 2,
    defaultPorts: 48,
    portsPerRow: [24, 24],
    defaultNumberingOrder: 'sequential',
    portType: 'keystone',
    sfpUplinks: 0,
    defaultColor: '#0F172A',
    powerWatts: 0,
    defaultIp: 'Pasivo (Nivel 1)',
    description: 'Panel de parcheo doble fila (24 puntos por fila = 48 tomas de red)'
  },
  {
    id: 'tpl-pp-12fiber',
    name: 'Bandeja Fibra Óptica ODF (12 o 24 Acopladores LC/SC)',
    brand: 'Corning',
    model: 'LANscape 1U LC-Duplex / SC-APC',
    category: 'patchpanel',
    uSize: 1,
    defaultPorts: 12,
    portsPerRow: [12],
    defaultNumberingOrder: 'sequential',
    portType: 'sfp',
    sfpUplinks: 0,
    defaultColor: '#7C2D12',
    powerWatts: 0,
    defaultIp: 'Pasivo (Óptico)',
    description: 'Distribuidor óptico 1U para acometidas troncales multimodo OM4 / monomodo OS2'
  },

  // =========================================================================
  // CENTRALITAS VOIP PBX, GRABADORES CCTV NVR Y CONSOLAS SERIAL
  // =========================================================================
  {
    id: 'tpl-pbx-grandstream',
    name: 'Centralita IP VoIP Grandstream UCM6304 / Yeastar',
    brand: 'Grandstream',
    model: 'UCM6304A VoIP PBX',
    category: 'pbx',
    uSize: 1,
    defaultPorts: 12,
    portType: 'fxs',
    defaultColor: '#312E81',
    powerWatts: 35,
    defaultIp: '10.10.30.5/24',
    description:
      'Izquierda: 1x USB + 4x FXS Teléfonos Analógicos + 4x FXO Líneas · Derecha: 3x RJ45 Gigabit',
    portBlocks: [
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
      { id: 'b-fxs', labelPrefix: 'FXS', type: 'fxs', count: 4, zone: 'center', rows: 1 },
      { id: 'b-fxo', labelPrefix: 'FXO', type: 'fxs', count: 4, zone: 'center', rows: 1 },
      { id: 'b-net', labelPrefix: 'NET', type: 'rj45', count: 3, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-nvr-hikvision',
    name: 'Grabador CCTV IP NVR 16P PoE + 2x LAN + 2x USB',
    brand: 'Hikvision',
    model: 'DS-7632NI-K2 / 16P PoE',
    category: 'nvr',
    uSize: 1,
    defaultPorts: 20,
    portType: 'rj45',
    defaultColor: '#1E293B',
    powerWatts: 180,
    defaultIp: '10.10.40.10/24',
    description:
      'Izquierda: 2x USB Ratón/Backup + 2x LAN Red · Derecha: 16x Puertos PoE Cámaras IP (2 filas x 8)',
    portBlocks: [
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 2, zone: 'left', rows: 1 },
      { id: 'b-lan', labelPrefix: 'LAN', type: 'rj45', count: 2, zone: 'left', rows: 1 },
      {
        id: 'b-cam',
        labelPrefix: 'CAM',
        type: 'rj45',
        count: 16,
        zone: 'right',
        rows: 2,
        numberingOrder: 'vertical-odd-even'
      }
    ]
  },

  // =========================================================================
  // SERVIDORES Y CABINAS NAS (Dell, HPE, Synology, QNAP, Supermicro)
  // =========================================================================
  {
    id: 'tpl-srv-ubuntu-1u',
    name: 'Ubuntu Server 24.04 LTS (Dell PowerEdge 1U)',
    brand: 'Dell',
    model: 'PowerEdge R660 XS',
    category: 'server',
    uSize: 1,
    defaultPorts: 8,
    portType: 'rj45',
    defaultColor: '#1E293B',
    powerWatts: 420,
    defaultIp: '10.10.10.20/24',
    description:
      'Izquierda: 1x iDRAC Gestión + 1x Consola Serial + 1x USB · Centro: 4x 1GbE · Derecha: 2x 10G SFP+',
    portBlocks: [
      { id: 'b-idrac', labelPrefix: 'iDRAC', type: 'console', count: 1, zone: 'left', rows: 1 },
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
      { id: 'b-eno', labelPrefix: 'eno', type: 'rj45', count: 4, zone: 'center', rows: 1 },
      { id: 'b-sfp', labelPrefix: 'SFP+', type: 'sfp', count: 2, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-srv-proxmox-2u',
    name: 'Hipervisor KVM / Proxmox VE (HPE ProLiant 2U)',
    brand: 'HPE',
    model: 'ProLiant DL380 Gen11',
    category: 'server',
    uSize: 2,
    defaultPorts: 10,
    portType: 'rj45',
    defaultColor: '#581C87',
    powerWatts: 680,
    defaultIp: '10.10.10.30/24',
    description:
      'Izquierda: 1x iLO Mgmt + 2x USB 3.0 · Centro: 4x 1GbE RJ45 · Derecha: 4x 10G SFP+ Cluster',
    portBlocks: [
      { id: 'b-ilo', labelPrefix: 'iLO', type: 'console', count: 1, zone: 'left', rows: 1 },
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 2, zone: 'left', rows: 1 },
      { id: 'b-eno', labelPrefix: 'eno', type: 'rj45', count: 4, zone: 'center', rows: 1 },
      { id: 'b-sfp', labelPrefix: 'SFP+', type: 'sfp', count: 4, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-srv-synology-rs1221',
    name: 'NAS Synology RackStation 8 Bahías (2U)',
    brand: 'Synology',
    model: 'RackStation RS1221+ / RS2423+',
    category: 'server',
    uSize: 2,
    defaultPorts: 9,
    portType: 'rj45',
    defaultColor: '#1E293B',
    powerWatts: 250,
    defaultIp: '10.10.10.40/24',
    description:
      'Izquierda: 1x Consola Serial + 2x USB 3.2 · Centro: 4x 1GbE Bond · Derecha: 2x 10G SFP+',
    portBlocks: [
      { id: 'b-con', labelPrefix: 'COM', type: 'console', count: 1, zone: 'left', rows: 1 },
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 2, zone: 'left', rows: 1 },
      { id: 'b-lan', labelPrefix: 'LAN', type: 'rj45', count: 4, zone: 'center', rows: 1 },
      { id: 'b-sfp', labelPrefix: '10G', type: 'sfp', count: 2, zone: 'right', rows: 1 }
    ]
  },

  // =========================================================================
  // ENERGÍA, SAI / UPS Y REGLETAS PDU (APC, Eaton, Salicru)
  // =========================================================================
  {
    id: 'tpl-ups-apc-2u',
    name: 'SAI / UPS APC Smart-UPS 3000VA (SNMP + USB + Tomas IEC)',
    brand: 'APC',
    model: 'SMT3000RMI2U',
    category: 'ups',
    uSize: 2,
    defaultPorts: 9,
    portType: 'power',
    defaultColor: '#78350F',
    powerWatts: 90,
    defaultIp: '10.10.99.5/24',
    description:
      'Izquierda: 1x Tarjeta Red SNMP + 1x Consola Serial + 1x USB · Derecha: 6x Salidas Eléctricas IEC C13',
    portBlocks: [
      { id: 'b-snmp', labelPrefix: 'SNMP', type: 'rj45', count: 1, zone: 'left', rows: 1 },
      { id: 'b-ser', labelPrefix: 'SER', type: 'console', count: 1, zone: 'left', rows: 1 },
      { id: 'b-usb', labelPrefix: 'USB', type: 'usb', count: 1, zone: 'left', rows: 1 },
      { id: 'b-pwr', labelPrefix: 'IEC', type: 'power', count: 6, zone: 'right', rows: 1 }
    ]
  },
  {
    id: 'tpl-ups-pdu-1u',
    name: 'Regleta PDU Monitorizada IP (1x Red Izq + 8x Tomas C13 Der)',
    brand: 'APC',
    model: 'AP7920B Metered Rack PDU',
    category: 'ups',
    uSize: 1,
    defaultPorts: 10,
    portType: 'power',
    defaultColor: '#0F172A',
    powerWatts: 15,
    defaultIp: '10.10.99.10/24',
    description:
      'Izquierda: 1x Ethernet IP + 1x Serial Sensor · Derecha: 8x Tomas Eléctricas IEC C13',
    portBlocks: [
      { id: 'b-eth', labelPrefix: 'ETH', type: 'rj45', count: 1, zone: 'left', rows: 1 },
      { id: 'b-con', labelPrefix: 'CAN', type: 'console', count: 1, zone: 'left', rows: 1 },
      { id: 'b-pwr', labelPrefix: 'OUT', type: 'power', count: 8, zone: 'right', rows: 1 }
    ]
  }
];

export const CABLE_COLORS: { id: CableColor; name: string; hex: string; purpose: string }[] = [
  { id: 'blue', name: 'Azul (LAN Datos)', hex: '#3B82F6', purpose: 'Datos / Puestos de Trabajo' },
  { id: 'yellow', name: 'Amarillo (WAN / Fibra OS2)', hex: '#EAB308', purpose: 'Enlaces WAN / Fibra Monomodo' },
  { id: 'emerald', name: 'Verde (PON / VoIP / Gestión)', hex: '#10B981', purpose: 'Acometida PON / Gestión / VoIP' },
  { id: 'red', name: 'Rojo (Firewall / Crítico)', hex: '#EF4444', purpose: 'Uplink Cortafuegos / Alarma' },
  { id: 'cyan', name: 'Cian (Fibra OM4 / Consola)', hex: '#06B6D4', purpose: 'Troncales Fibra 10G / Serial' },
  { id: 'purple', name: 'Violeta (Servidores / Voz FXS)', hex: '#A855F7', purpose: 'Cluster / Líneas Analógicas' },
  { id: 'orange', name: 'Naranja (IoT / CCTV PoE)', hex: '#F97316', purpose: 'Cámaras IP / Seguridad' },
  { id: 'slate', name: 'Gris (Cross-Connect / Energía)', hex: '#94A3B8', purpose: 'Parcheo Estándar / Alimentación' }
];

export const CATEGORY_LABELS: Record<DeviceCategory, string> = {
  firewall: 'Firewall',
  router: 'Router',
  ont: 'ONT / Fibra',
  switch: 'Switch',
  patchpanel: 'Patch Panel',
  pbx: 'Centralita PBX',
  nvr: 'CCTV NVR',
  server: 'Servidor / NAS',
  ups: 'SAI / PDU'
};

/**
 * Organizes a subset of ports into visual horizontal rows respecting `portNumberingOrder`.
 */
function buildRowsForPortSubset(
  subset: DevicePort[],
  order: PortNumberingOrder,
  explicitRowCounts?: number[]
): DevicePort[][] {
  if (subset.length === 0) return [];
  const MAX_PORTS_PER_VISUAL_ROW = 24;

  let rawRowSizes: number[] = [];
  if (explicitRowCounts && explicitRowCounts.length > 0) {
    const sum = explicitRowCounts.reduce((a, b) => a + b, 0);
    if (sum === subset.length) {
      rawRowSizes = [...explicitRowCounts];
    }
  }

  if (rawRowSizes.length === 0) {
    // Check if ports carry explicit `.row` numbers > 1
    const maxExplicitRow = subset.reduce((m, p) => Math.max(m, p.row || 1), 1);
    if (maxExplicitRow > 1 && maxExplicitRow <= 6) {
      const countsByRow: number[] = [];
      for (let r = 1; r <= maxExplicitRow; r++) {
        const c = subset.filter((p) => (p.row || 1) === r).length;
        if (c > 0) countsByRow.push(c);
      }
      if (countsByRow.reduce((a, b) => a + b, 0) === subset.length && countsByRow.length > 1) {
        rawRowSizes = countsByRow;
      }
    }
  }

  if (rawRowSizes.length === 0) {
    if (subset.length <= 16) {
      rawRowSizes = [subset.length];
    } else if (subset.length <= 32) {
      const top = Math.ceil(subset.length / 2);
      rawRowSizes = [top, subset.length - top];
    } else {
      let rem = subset.length;
      while (rem > 0) {
        const take = Math.min(12, rem);
        rawRowSizes.push(take);
        rem -= take;
      }
    }
  }

  const rowSizes: number[] = [];
  for (const size of rawRowSizes) {
    if (size > MAX_PORTS_PER_VISUAL_ROW) {
      let rem = size;
      while (rem > 0) {
        const take = Math.min(12, rem);
        rowSizes.push(take);
        rem -= take;
      }
    } else if (size > 0) {
      rowSizes.push(size);
    }
  }

  let rows: DevicePort[][] = [];

  if (rowSizes.length <= 1) {
    rows = [subset];
  } else if (order === 'vertical-odd-even' && rowSizes.length >= 2) {
    rows = Array.from({ length: rowSizes.length }, () => []);
    let portCursor = 0;
    for (let r = 0; r < rowSizes.length; r += 2) {
      if (r + 1 < rowSizes.length) {
        const pairTotal = rowSizes[r] + rowSizes[r + 1];
        const pairSlice = subset.slice(portCursor, portCursor + pairTotal);
        portCursor += pairTotal;
        pairSlice.forEach((p, idx) => {
          if (idx % 2 === 0) {
            rows[r].push(p);
          } else {
            rows[r + 1].push(p);
          }
        });
      } else {
        const slice = subset.slice(portCursor, portCursor + rowSizes[r]);
        portCursor += rowSizes[r];
        rows[r].push(...slice);
      }
    }
  } else if (order === 'vertical-even-odd' && rowSizes.length >= 2) {
    rows = Array.from({ length: rowSizes.length }, () => []);
    let portCursor = 0;
    for (let r = 0; r < rowSizes.length; r += 2) {
      if (r + 1 < rowSizes.length) {
        const pairTotal = rowSizes[r] + rowSizes[r + 1];
        const pairSlice = subset.slice(portCursor, portCursor + pairTotal);
        portCursor += pairTotal;
        pairSlice.forEach((p, idx) => {
          if (idx % 2 === 1) {
            rows[r].push(p);
          } else {
            rows[r + 1].push(p);
          }
        });
      } else {
        const slice = subset.slice(portCursor, portCursor + rowSizes[r]);
        portCursor += rowSizes[r];
        rows[r].push(...slice);
      }
    }
  } else {
    let cursor = 0;
    for (const size of rowSizes) {
      rows.push(subset.slice(cursor, cursor + size));
      cursor += size;
    }
    if (cursor < subset.length) {
      rows[rows.length - 1].push(...subset.slice(cursor));
    }
  }

  return rows.filter((r) => r.length > 0);
}

/**
 * Organizes a device's ports into 3 horizontal zones on the faceplate (`left`, `center`, `right`)
 * so auxiliary ports (Console, USB, PON, Management, WAN) can sit on the left or center with physical
 * separation from the main switch/LAN bank on the right.
 */
export function getOrganizedDeviceZones(dev: RackDevice): {
  leftRows: DevicePort[][];
  centerRows: DevicePort[][];
  rightRows: DevicePort[][];
  maxRows: number;
} {
  const order: PortNumberingOrder = dev.portNumberingOrder || 'sequential';
  const sorted = [...dev.ports].sort((a, b) => a.number - b.number);

  const hasExplicitZones = sorted.some((p) => p.zone !== undefined);

  if (!hasExplicitZones) {
    const rightRows = getOrganizedDevicePortRows(dev);
    return {
      leftRows: [],
      centerRows: [],
      rightRows,
      maxRows: rightRows.length || 1
    };
  }

  const leftPorts = sorted.filter((p) => p.zone === 'left');
  const centerPorts = sorted.filter((p) => p.zone === 'center');
  const rightPorts = sorted.filter((p) => !p.zone || p.zone === 'right');

  const leftRows = buildRowsForPortSubset(leftPorts, 'sequential');
  const centerRows = buildRowsForPortSubset(
    centerPorts,
    order,
    dev.portsPerRow && dev.portsPerRow.reduce((a, b) => a + b, 0) === centerPorts.length
      ? dev.portsPerRow
      : undefined
  );
  const rightRows = buildRowsForPortSubset(
    rightPorts,
    order,
    dev.portsPerRow && dev.portsPerRow.reduce((a, b) => a + b, 0) === rightPorts.length
      ? dev.portsPerRow
      : undefined
  );

  const maxRows = Math.max(1, leftRows.length, centerRows.length, rightRows.length);
  return { leftRows, centerRows, rightRows, maxRows };
}

export function getOrganizedDevicePortRows(dev: RackDevice): DevicePort[][] {
  const MAX_PORTS_PER_VISUAL_ROW = 24;
  const order: PortNumberingOrder = dev.portNumberingOrder || 'sequential';
  const sortedPorts = [...dev.ports].sort((a, b) => a.number - b.number);

  const regularPorts = sortedPorts.filter(
    (p) => p.type !== 'sfp' || dev.category === 'patchpanel'
  );
  const sfpUplinks =
    dev.category === 'patchpanel'
      ? []
      : sortedPorts.filter((p) => p.type === 'sfp');

  let rawRowSizes: number[] = [];
  if (dev.portsPerRow && dev.portsPerRow.length > 0) {
    const sum = dev.portsPerRow.reduce((a, b) => a + b, 0);
    if (sum === regularPorts.length || sum === sortedPorts.length) {
      rawRowSizes = [...dev.portsPerRow];
    }
  }

  const useAllPortsDirectly =
    dev.portsPerRow &&
    dev.portsPerRow.length > 0 &&
    dev.portsPerRow.reduce((a, b) => a + b, 0) === sortedPorts.length &&
    sfpUplinks.length > 0;

  const basePorts = useAllPortsDirectly ? sortedPorts : regularPorts;
  const remainingUplinks = useAllPortsDirectly ? [] : sfpUplinks;

  if (rawRowSizes.length === 0) {
    if (basePorts.length <= 16) {
      rawRowSizes = [basePorts.length];
    } else if (basePorts.length <= 32) {
      const top = Math.ceil(basePorts.length / 2);
      rawRowSizes = [top, basePorts.length - top];
    } else {
      let rem = basePorts.length;
      while (rem > 0) {
        const take = Math.min(12, rem);
        rawRowSizes.push(take);
        rem -= take;
      }
    }
  }

  const rowSizes: number[] = [];
  for (const size of rawRowSizes) {
    if (size > MAX_PORTS_PER_VISUAL_ROW) {
      let rem = size;
      while (rem > 0) {
        const take = Math.min(12, rem);
        rowSizes.push(take);
        rem -= take;
      }
    } else if (size > 0) {
      rowSizes.push(size);
    }
  }

  const rows = buildRowsForPortSubset(basePorts, order, rowSizes);

  if (remainingUplinks.length > 0) {
    if (rows.length === 1 && rows[0].length + remainingUplinks.length <= 16) {
      rows[0].push(...remainingUplinks);
    } else if (
      rows.length === 2 &&
      rows[0].length <= 12 &&
      rows[1].length <= 12 &&
      remainingUplinks.length <= 4
    ) {
      const half = Math.ceil(remainingUplinks.length / 2);
      rows[0].push(...remainingUplinks.slice(0, half));
      rows[1].push(...remainingUplinks.slice(half));
    } else {
      rows.push(remainingUplinks);
    }
  }

  return rows.filter((r) => r.length > 0);
}

export function createDeviceFromPortBlocks(
  devId: string,
  blocks: CustomPortBlockSpec[]
): { ports: DevicePort[]; portsPerRow?: number[] } {
  const ports: DevicePort[] = [];
  let portCounter = 1;

  for (const block of blocks) {
    const rowCount = Math.max(1, Math.min(4, block.rows || 1));
    const perRow = Math.ceil(block.count / rowCount);
    for (let i = 0; i < block.count; i++) {
      const rowNum = Math.min(rowCount, Math.floor(i / perRow) + 1);
      const indexInBlock = i + 1;
      const label =
        block.count === 1
          ? block.labelPrefix
          : `${block.labelPrefix}${indexInBlock.toString().padStart(2, '0')}`;

      ports.push({
        id: `${devId}-p${portCounter}`,
        number: portCounter,
        label,
        type: block.type,
        zone: block.zone,
        groupId: block.id,
        row: rowNum,
        vlan: block.type === 'sfp' ? 'Trunk' : block.type === 'pon' ? 'ONT-WAN' : '1',
        speed:
          block.type === 'sfp'
            ? '10G'
            : block.type === 'pon'
            ? '2.5G GPON'
            : block.type === 'console'
            ? '115200 bps'
            : block.type === 'usb'
            ? 'USB 3.0'
            : '1G'
      });
      portCounter++;
    }
  }

  return { ports };
}

export function createDeviceFromTemplate(
  template: HardwareTemplate,
  uStart: number,
  customSuffix?: number,
  customRowCounts?: number[],
  customColor?: string,
  customNumberingOrder?: PortNumberingOrder
): RackDevice {
  const id = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // If template defines realistic multi-zone portBlocks (and no custom row override was passed)
  if (template.portBlocks && template.portBlocks.length > 0 && !customRowCounts) {
    const { ports } = createDeviceFromPortBlocks(id, template.portBlocks);
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
      serialNumber: `SN-${template.brand.substring(0, 3).toUpperCase()}-${Math.floor(
        100000 + Math.random() * 900000
      )}`,
      powerWatts: template.powerWatts,
      status: 'nominal',
      notes: `${template.description}. Instalado en U${uStart}.`,
      customColor: customColor || template.defaultColor || '#1E293B',
      portsPerRow: template.portsPerRow,
      portNumberingOrder:
        customNumberingOrder || template.defaultNumberingOrder || 'vertical-odd-even',
      ports
    };
  }

  const ports: DevicePort[] = [];
  const prefix =
    template.category === 'patchpanel'
      ? 'P'
      : template.category === 'firewall'
      ? 'PORT'
      : template.category === 'server'
      ? 'eno'
      : 'GE';

  const effectiveRows =
    customRowCounts && customRowCounts.length > 0
      ? customRowCounts
      : template.portsPerRow && template.portsPerRow.length > 0
      ? template.portsPerRow
      : [template.defaultPorts];

  let portCounter = 1;
  effectiveRows.forEach((pointsInRow, rowIdx) => {
    const rowNumber = rowIdx + 1;
    for (let i = 1; i <= pointsInRow; i++) {
      ports.push({
        id: `${id}-p${portCounter}`,
        number: portCounter,
        label: `${prefix}${portCounter.toString().padStart(2, '0')}`,
        type: template.portType,
        zone: template.sfpUplinks ? 'center' : 'right',
        row: rowNumber,
        vlan: template.category === 'patchpanel' ? '10' : '1',
        speed: template.portType === 'sfp' ? '10G' : '1G'
      });
      portCounter++;
    }
  });

  const sfpCount = template.sfpUplinks || 0;
  for (let s = 1; s <= sfpCount; s++) {
    const num = portCounter++;
    ports.push({
      id: `${id}-sfp${s}`,
      number: num,
      label: `SFP+${s}`,
      type: 'sfp',
      zone: 'right',
      row: Math.min(effectiveRows.length, ((s - 1) % effectiveRows.length) + 1),
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
    serialNumber: `SN-${template.brand.substring(0, 3).toUpperCase()}-${Math.floor(
      100000 + Math.random() * 900000
    )}`,
    powerWatts: template.powerWatts,
    status: 'nominal',
    notes: `${template.description}. Instalado en U${uStart}.`,
    customColor: customColor || template.defaultColor || '#1E293B',
    portsPerRow: effectiveRows,
    portNumberingOrder:
      customNumberingOrder || template.defaultNumberingOrder || 'sequential',
    ports
  };
}

/**
 * Computes default 2D coordinates (`xPercent`, `yPercent`) for all ports on a device
 * so they can be graphically dragged anywhere with the mouse on the chassis faceplate.
 */
export function ensureDevicePortCoordinates(dev: RackDevice): DevicePort[] {
  const { leftRows, centerRows, rightRows, maxRows } = getOrganizedDeviceZones(dev);
  const coordMap: Record<string, { xPercent: number; yPercent: number }> = {};

  const assignZoneCoords = (
    rows: DevicePort[][],
    xStart: number,
    xEnd: number
  ) => {
    const totalRows = Math.max(1, rows.length);
    rows.forEach((rowPorts, rIdx) => {
      const yPct =
        totalRows === 1
          ? 50
          : Number((22 + (rIdx / (totalRows - 1)) * 56).toFixed(1));
      const count = rowPorts.length;
      rowPorts.forEach((p, cIdx) => {
        const span = xEnd - xStart;
        const step = count <= 1 ? 0 : Math.min(4.2, span / Math.max(1, count));
        const xPct = Number((xStart + cIdx * step).toFixed(1));
        coordMap[p.id] = {
          xPercent: Math.max(2, Math.min(97, xPct)),
          yPercent: Math.max(14, Math.min(86, yPct))
        };
      });
    });
  };

  assignZoneCoords(leftRows, 3, 25);
  assignZoneCoords(centerRows, 29, 64);

  // For right zone, align toward the right side of the faceplate
  const totalRightRows = Math.max(1, rightRows.length);
  rightRows.forEach((rowPorts, rIdx) => {
    const yPct =
      totalRightRows === 1
        ? 50
        : Number((22 + (rIdx / (totalRightRows - 1)) * 56).toFixed(1));
    const count = rowPorts.length;
    const step = count > 16 ? 3.2 : count > 10 ? 3.8 : 4.4;
    const totalWidth = (count - 1) * step;
    const startX = Math.max(
      leftRows.length > 0 || centerRows.length > 0 ? 32 : 6,
      95 - totalWidth
    );
    rowPorts.forEach((p, cIdx) => {
      coordMap[p.id] = {
        xPercent: Number(Math.max(2, Math.min(97, startX + cIdx * step)).toFixed(1)),
        yPercent: Math.max(14, Math.min(86, yPct))
      };
    });
  });

  // Fallback for any port not in rows
  return dev.ports.map((p, idx) => {
    if (typeof p.xPercent === 'number' && typeof p.yPercent === 'number') {
      return p;
    }
    const fallback = coordMap[p.id] || {
      xPercent: Math.min(95, 8 + idx * 4.5),
      yPercent: maxRows > 1 && idx % 2 === 1 ? 72 : 50
    };
    return {
      ...p,
      xPercent: fallback.xPercent,
      yPercent: fallback.yPercent
    };
  });
}

