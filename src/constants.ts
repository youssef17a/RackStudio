import { HardwareTemplate, CableColor, DeviceCategory, DevicePort, RackDevice } from './types';

export const DEVICE_COLOR_PALETTE: { id: string; name: string; hex: string }[] = [
  { id: 'slate', name: 'Gris Antracita (Estándar)', hex: '#1E293B' },
  { id: 'crimson', name: 'Rojo Fortinet / Seguridad', hex: '#7F1D1D' },
  { id: 'movistar', name: 'Azul Movistar / Operador', hex: '#0369A1' },
  { id: 'indigo', name: 'Índigo Core / BGP', hex: '#312E81' },
  { id: 'emerald', name: 'Verde Cisco / Switching', hex: '#065F46' },
  { id: 'teal', name: 'Turquesa Aruba / Acceso', hex: '#115E59' },
  { id: 'purple', name: 'Violeta Hipervisor / SAN', hex: '#581C87' },
  { id: 'amber', name: 'Ámbar SAI / Energía / Industrial', hex: '#78350F' },
  { id: 'orange', name: 'Naranja Bandeja Fibra / ODF', hex: '#7C2D12' },
  { id: 'obsidian', name: 'Negro Carbón (Patch Panel)', hex: '#0F172A' }
];

export const HARDWARE_CATALOG: HardwareTemplate[] = [
  // =========================================================================
  // FIREWALLS (Fortinet, Palo Alto, WatchGuard, SonicWall, Check Point, Sophos, pfSense)
  // =========================================================================
  {
    id: 'tpl-fw-fg40f',
    name: 'FortiGate 40F / 60F (Bandeja 1U)',
    brand: 'Fortinet',
    model: 'FortiGate 60F Rackmount',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 10,
    portType: 'rj45',
    sfpUplinks: 0,
    defaultColor: '#7F1D1D',
    powerWatts: 25,
    defaultIp: '192.168.1.99/24',
    description: 'Firewall SD-WAN PYME/Sede con 2x WAN + 1x DMZ + 7x Internal RJ45'
  },
  {
    id: 'tpl-fw-fg100f',
    name: 'Firewall Perimetral NGFW 100F',
    brand: 'Fortinet',
    model: 'FortiGate 100F',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 16,
    portType: 'rj45',
    sfpUplinks: 4,
    defaultColor: '#7F1D1D',
    powerWatts: 115,
    defaultIp: '10.10.0.1/24',
    description: 'Firewall NGFW 1U con 16x GE RJ45 + 4x 10G SFP+ Ultra-low latency'
  },
  {
    id: 'tpl-fw-fg200f',
    name: 'Firewall DataCenter NGFW 200F',
    brand: 'Fortinet',
    model: 'FortiGate 200F',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 18,
    portType: 'rj45',
    sfpUplinks: 8,
    defaultColor: '#7F1D1D',
    powerWatts: 145,
    defaultIp: '10.10.0.254/24',
    description: 'Cortafuegos NGFW de alta densidad 18x GE RJ45 + 8x 10G SFP+'
  },
  {
    id: 'tpl-fw-pa440',
    name: 'Firewall Zero-Trust PA-440',
    brand: 'Palo Alto',
    model: 'PA-440 Rackmount',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 8,
    portType: 'rj45',
    sfpUplinks: 2,
    defaultColor: '#7C2D12',
    powerWatts: 65,
    defaultIp: '10.20.0.1/24',
    description: 'Cortafuegos empresarial ML-Powered con 8 puertos GbE y 2 SFP'
  },
  {
    id: 'tpl-fw-watchguard-m290',
    name: 'Firebox M290 / M390 Security',
    brand: 'WatchGuard',
    model: 'Firebox M290',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 8,
    portType: 'rj45',
    sfpUplinks: 2,
    defaultColor: '#991B1B',
    powerWatts: 75,
    defaultIp: '10.0.1.1/24',
    description: 'Appliance UTM / NGFW en chasis rojo característico WatchGuard'
  },
  {
    id: 'tpl-fw-sonicwall-nsa',
    name: 'SonicWall NSa 2700',
    brand: 'SonicWall',
    model: 'NSa 2700 Rack 1U',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 16,
    portType: 'rj45',
    sfpUplinks: 3,
    defaultColor: '#7F1D1D',
    powerWatts: 95,
    defaultIp: '192.168.168.168/24',
    description: 'Firewall empresarial multi-gigabit con inspección profunda DPI-SSL'
  },
  {
    id: 'tpl-fw-checkpoint-1600',
    name: 'Quantum Spark 1600 / 1800',
    brand: 'Check Point',
    model: 'Quantum Spark 1600',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 10,
    portType: 'rj45',
    sfpUplinks: 2,
    defaultColor: '#7F1D1D',
    powerWatts: 60,
    defaultIp: '192.168.1.1/24',
    description: 'Prevención de amenazas Zero-Day para delegaciones y oficinas'
  },
  {
    id: 'tpl-fw-sophos-xgs',
    name: 'Sophos XGS 2100',
    brand: 'Sophos',
    model: 'XGS 2100 1U',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 10,
    portType: 'rj45',
    sfpUplinks: 2,
    defaultColor: '#1E3A8A',
    powerWatts: 85,
    defaultIp: '172.16.16.16/24',
    description: 'Firewall de doble procesador con aceleración Xstream Flow'
  },
  {
    id: 'tpl-fw-netgate-pfsense',
    name: 'Netgate 6100 / 8200 pfSense+',
    brand: 'Netgate',
    model: 'pfSense+ 6100 Max 1U',
    category: 'firewall',
    uSize: 1,
    defaultPorts: 6,
    portType: 'rj45',
    sfpUplinks: 4,
    defaultColor: '#1E293B',
    powerWatts: 45,
    defaultIp: '192.168.1.1/24',
    description: 'Router/Firewall VPN OpenVPN, IPsec y WireGuard de alto rendimiento'
  },

  // =========================================================================
  // ROUTERS & OPERADORAS ISP (Movistar HGU, Orange, Vodafone, Teldat, MikroTik, Cisco, Ubiquiti)
  // =========================================================================
  {
    id: 'tpl-rt-movistar-hgu',
    name: 'Router Movistar HGU Fibra (Bandeja 1U)',
    brand: 'Movistar / Mitrastar / Askey',
    model: 'Smart WiFi HGU GPT-2741GNAC',
    category: 'router',
    uSize: 1,
    defaultPorts: 4,
    portType: 'rj45',
    sfpUplinks: 1,
    defaultColor: '#0369A1',
    powerWatts: 24,
    defaultIp: '192.168.1.1/24',
    description: 'ONT + Router Fibra Movistar Empresas en bandeja 1U (4x LAN GbE + 1x PON Óptico)'
  },
  {
    id: 'tpl-rt-movistar-teldat',
    name: 'Router Movistar Empresas Macrolan / VPN',
    brand: 'Teldat (Movistar)',
    model: 'Teldat M1 / C1+ Rack',
    category: 'router',
    uSize: 1,
    defaultPorts: 6,
    portType: 'rj45',
    sfpUplinks: 2,
    defaultColor: '#0369A1',
    powerWatts: 35,
    defaultIp: '10.0.0.1/30',
    description: 'Router corporativo gestionado por Telefónica para caudal garantizado y MPLS'
  },
  {
    id: 'tpl-rt-orange-livebox',
    name: 'Router Orange Livebox Fibra Pro (Bandeja 1U)',
    brand: 'Orange Empresas',
    model: 'Livebox 6 Pro Fibra XGS-PON',
    category: 'router',
    uSize: 1,
    defaultPorts: 5,
    portType: 'rj45',
    sfpUplinks: 1,
    defaultColor: '#7C2D12',
    powerWatts: 28,
    defaultIp: '192.168.1.1/24',
    description: 'Acometida fibra Orange Empresas con 4x LAN GbE + 1x 2.5GbE + Puerto PON'
  },
  {
    id: 'tpl-rt-vodafone-one',
    name: 'Router Vodafone Empresas Fibra (Bandeja 1U)',
    brand: 'Vodafone Business',
    model: 'Wi-Fi 6 Station Sercomm',
    category: 'router',
    uSize: 1,
    defaultPorts: 4,
    portType: 'rj45',
    sfpUplinks: 1,
    defaultColor: '#7F1D1D',
    powerWatts: 25,
    defaultIp: '192.168.0.1/24',
    description: 'Equipo terminal de fibra óptica y backup 4G/5G Vodafone Empresas'
  },
  {
    id: 'tpl-rt-ccr2004',
    name: 'Router Core BGP/MPLS CCR2004',
    brand: 'MikroTik',
    model: 'CCR2004-16G-2S+',
    category: 'router',
    uSize: 1,
    defaultPorts: 16,
    portType: 'rj45',
    sfpUplinks: 2,
    defaultColor: '#312E81',
    powerWatts: 48,
    defaultIp: '10.10.0.2/24',
    description: 'Cloud Core Router 16x Gigabit Ethernet + 2x 10G SFP+ cages'
  },
  {
    id: 'tpl-rt-rb5009',
    name: 'Router MikroTik RB5009 / RB4011',
    brand: 'MikroTik',
    model: 'RB5009UPr+S+IN (Kit 1U)',
    category: 'router',
    uSize: 1,
    defaultPorts: 8,
    portType: 'rj45',
    sfpUplinks: 1,
    defaultColor: '#312E81',
    powerWatts: 30,
    defaultIp: '192.168.88.1/24',
    description: 'Router PoE-In/Out con puerto 2.5G, 7x 1G y 1x 10G SFP+'
  },
  {
    id: 'tpl-rt-isr4331',
    name: 'Router WAN Agregación ISR 4331',
    brand: 'Cisco',
    model: 'ISR 4331 Sec-K9',
    category: 'router',
    uSize: 1,
    defaultPorts: 6,
    portType: 'rj45',
    sfpUplinks: 2,
    defaultColor: '#312E81',
    powerWatts: 125,
    defaultIp: '172.16.0.1/30',
    description: 'Router de servicios integrados para enlaces dedicados fibra/MPLS'
  },
  {
    id: 'tpl-rt-udm-pro',
    name: 'UniFi Dream Machine Pro / SE',
    brand: 'Ubiquiti',
    model: 'UDM-Pro-SE',
    category: 'router',
    uSize: 1,
    defaultPorts: 9,
    portType: 'rj45',
    sfpUplinks: 2,
    defaultColor: '#1E293B',
    powerWatts: 50,
    defaultIp: '192.168.1.1/24',
    description: 'Gateway empresarial UniFi OS con switch PoE 8 puertos + WAN 2.5G + 2x 10G SFP+'
  },

  // =========================================================================
  // PATCH PANELS (Configurables por filas: 12, 24, 48 puertos, Fibra ODF, Pasamuros)
  // =========================================================================
  {
    id: 'tpl-pp-24cat6a',
    name: 'Patch Panel 24P Cat6A (1 Fila x 24)',
    brand: 'Panduit',
    model: 'CPP24FMWBLY 24-Port 1U',
    category: 'patchpanel',
    uSize: 1,
    defaultPorts: 24,
    portsPerRow: [24],
    portType: 'keystone',
    sfpUplinks: 0,
    defaultColor: '#0F172A',
    powerWatts: 0,
    defaultIp: 'Pasivo (Nivel 1)',
    description: 'Panel de parcheo modular 1 fila de 24 puertos Keystone RJ45 (personalizable al montar)'
  },
  {
    id: 'tpl-pp-48cat6a',
    name: 'Patch Panel 48P Alta Densidad (2 Filas x 24)',
    brand: 'CommScope / Systimax',
    model: 'CPP48HD 48-Port 2U',
    category: 'patchpanel',
    uSize: 2,
    defaultPorts: 48,
    portsPerRow: [24, 24],
    portType: 'keystone',
    sfpUplinks: 0,
    defaultColor: '#0F172A',
    powerWatts: 0,
    defaultIp: 'Pasivo (Nivel 1)',
    description: 'Panel de parcheo doble fila (24 puntos por fila = 48 tomas de red)'
  },
  {
    id: 'tpl-pp-16cat6',
    name: 'Patch Panel 16P / 12P Compacto',
    brand: 'Legrand',
    model: 'LCS3 Cat6 16-Port',
    category: 'patchpanel',
    uSize: 1,
    defaultPorts: 16,
    portsPerRow: [16],
    portType: 'keystone',
    sfpUplinks: 0,
    defaultColor: '#0F172A',
    powerWatts: 0,
    defaultIp: 'Pasivo (Nivel 1)',
    description: 'Panel de parcheo para oficinas medianas (permite elegir puntos por fila)'
  },
  {
    id: 'tpl-pp-12fiber',
    name: 'Bandeja Fibra Óptica ODF (12 o 24 FO)',
    brand: 'Corning',
    model: 'LANscape 1U LC-Duplex',
    category: 'patchpanel',
    uSize: 1,
    defaultPorts: 12,
    portsPerRow: [12],
    portType: 'sfp',
    sfpUplinks: 0,
    defaultColor: '#7C2D12',
    powerWatts: 0,
    defaultIp: 'Pasivo (Óptico)',
    description: 'Distribuidor óptico 1U para acometidas troncales multimodo OM4 / monomodo OS2'
  },

  // =========================================================================
  // SWITCHES (Cisco, Ubiquiti, Aruba, FortiSwitch, MikroTik, TP-Link Omada, Netgear)
  // =========================================================================
  {
    id: 'tpl-sw-c9300-24',
    name: 'Switch Core L3 Catalyst 24P PoE+',
    brand: 'Cisco',
    model: 'Catalyst 9300-24P',
    category: 'switch',
    uSize: 1,
    defaultPorts: 24,
    portType: 'rj45',
    sfpUplinks: 4,
    defaultColor: '#065F46',
    powerWatts: 350,
    defaultIp: '10.10.1.10/24',
    description: 'Switch apilable 24 puertos PoE+ y 4 uplinks 10G SFP+'
  },
  {
    id: 'tpl-sw-c9300-48',
    name: 'Switch Core L3 Catalyst 48P (2 Filas)',
    brand: 'Cisco',
    model: 'Catalyst 9300-48P',
    category: 'switch',
    uSize: 1,
    defaultPorts: 48,
    portsPerRow: [24, 24],
    portType: 'rj45',
    sfpUplinks: 4,
    defaultColor: '#065F46',
    powerWatts: 480,
    defaultIp: '10.10.1.12/24',
    description: 'Switch de alta densidad 48 puertos RJ45 PoE+ en 2 filas de 24 + 4 SFP+'
  },
  {
    id: 'tpl-sw-usw-pro-24',
    name: 'Switch UniFi Pro 24 PoE',
    brand: 'Ubiquiti',
    model: 'USW-Pro-24-PoE',
    category: 'switch',
    uSize: 1,
    defaultPorts: 24,
    portType: 'rj45',
    sfpUplinks: 2,
    defaultColor: '#065F46',
    powerWatts: 280,
    defaultIp: '10.10.1.11/24',
    description: 'Switch L2/L3 gestionable con 24x GbE RJ45 y 2x 10G SFP+'
  },
  {
    id: 'tpl-sw-aruba-2930f',
    name: 'Switch Aruba CX 6200F / 2930F 24G',
    brand: 'HPE Aruba',
    model: 'JL255A 2930F-24G-PoE+-4SFP+',
    category: 'switch',
    uSize: 1,
    defaultPorts: 24,
    portType: 'rj45',
    sfpUplinks: 4,
    defaultColor: '#115E59',
    powerWatts: 320,
    defaultIp: '10.10.1.15/24',
    description: 'Switch empresarial HPE Aruba con 24 puertos PoE+ y 4 enlaces 10G SFP+'
  },
  {
    id: 'tpl-sw-fortiswitch-124f',
    name: 'FortiSwitch 124F-FPOE FortiLink',
    brand: 'Fortinet',
    model: 'FS-124F-FPOE',
    category: 'switch',
    uSize: 1,
    defaultPorts: 24,
    portType: 'rj45',
    sfpUplinks: 4,
    defaultColor: '#065F46',
    powerWatts: 370,
    defaultIp: '10.10.1.20/24',
    description: 'Switch gestionado por FortiLink desde FortiGate con 24x GE PoE+ y 4x SFP+'
  },
  {
    id: 'tpl-sw-mikrotik-crs326',
    name: 'Switch MikroTik CRS326-24G-2S+RM',
    brand: 'MikroTik',
    model: 'CRS326-24G-2S+RM',
    category: 'switch',
    uSize: 1,
    defaultPorts: 24,
    portType: 'rj45',
    sfpUplinks: 2,
    defaultColor: '#115E59',
    powerWatts: 24,
    defaultIp: '192.168.88.2/24',
    description: 'Cloud Router Switch Dual Boot (RouterOS / SwOS) 24x GbE + 2x 10G SFP+'
  },
  {
    id: 'tpl-sw-tplink-omada',
    name: 'Switch TP-Link Omada JetStream 28P',
    brand: 'TP-Link Omada',
    model: 'TL-SG3428MP PoE+',
    category: 'switch',
    uSize: 1,
    defaultPorts: 24,
    portType: 'rj45',
    sfpUplinks: 4,
    defaultColor: '#065F46',
    powerWatts: 384,
    defaultIp: '192.168.0.10/24',
    description: 'Switch SDN Omada L2+ con 24 puertos PoE+ 384W y 4 ranuras SFP'
  },

  // =========================================================================
  // SERVIDORES, NAS & GRABADORES NVR (Dell, HPE, Supermicro, Synology, QNAP, Hikvision)
  // =========================================================================
  {
    id: 'tpl-srv-ubuntu-1u',
    name: 'Ubuntu Server 24.04 LTS (Dell 1U)',
    brand: 'Dell EMC',
    model: 'PowerEdge R660 XS',
    category: 'server',
    uSize: 1,
    defaultPorts: 4,
    portType: 'rj45',
    sfpUplinks: 2,
    defaultColor: '#1E293B',
    powerWatts: 420,
    defaultIp: '10.10.10.20/24',
    description: 'Servidor 1U Dual Xeon, 128GB RAM, 4x 1GbE + iDRAC + 2x 10G SFP+'
  },
  {
    id: 'tpl-srv-proxmox-2u',
    name: 'Hipervisor KVM / Proxmox VE (HPE 2U)',
    brand: 'HPE',
    model: 'ProLiant DL380 Gen11',
    category: 'server',
    uSize: 2,
    defaultPorts: 6,
    portType: 'rj45',
    sfpUplinks: 2,
    defaultColor: '#581C87',
    powerWatts: 680,
    defaultIp: '10.10.10.30/24',
    description: 'Chasis 2U 12 bahías NVMe para virtualización intensiva y contenedores'
  },
  {
    id: 'tpl-srv-synology-rs1221',
    name: 'NAS RackStation 8 Bahías (2U)',
    brand: 'Synology',
    model: 'RackStation RS1221+ / RS2423+',
    category: 'server',
    uSize: 2,
    defaultPorts: 4,
    portType: 'rj45',
    sfpUplinks: 2,
    defaultColor: '#1E293B',
    powerWatts: 250,
    defaultIp: '10.10.10.40/24',
    description: 'Servidor NAS de almacenamiento en red y copias de seguridad Active Backup'
  },
  {
    id: 'tpl-srv-qnap-ts873',
    name: 'NAS QNAP ZFS QuTS hero (2U)',
    brand: 'QNAP',
    model: 'TS-h973AX / TS-873AeU',
    category: 'server',
    uSize: 2,
    defaultPorts: 4,
    portType: 'rj45',
    sfpUplinks: 2,
    defaultColor: '#1E293B',
    powerWatts: 240,
    defaultIp: '10.10.10.45/24',
    description: 'Cabina NAS híbrida con enlaces 2.5GbE y 10GbE SFP+ para iSCSI/NFS'
  },
  {
    id: 'tpl-srv-hikvision-nvr',
    name: 'Grabador CCTV IP NVR 32 Canales (1U)',
    brand: 'Hikvision / Dahua',
    model: 'DS-7632NI-K2 / 16P PoE',
    category: 'server',
    uSize: 1,
    defaultPorts: 16,
    portType: 'rj45',
    sfpUplinks: 0,
    defaultColor: '#1E293B',
    powerWatts: 180,
    defaultIp: '10.10.40.10/24',
    description: 'Videograbador IP de seguridad física con 16 puertos PoE integrados para cámaras'
  },
  {
    id: 'tpl-srv-grandstream-pbx',
    name: 'Centralita IP VoIP Asterisk / UCM (1U)',
    brand: 'Grandstream / Yeastar',
    model: 'UCM6304A / P560 VoIP PBX',
    category: 'server',
    uSize: 1,
    defaultPorts: 6,
    portType: 'rj45',
    sfpUplinks: 0,
    defaultColor: '#312E81',
    powerWatts: 35,
    defaultIp: '10.10.30.5/24',
    description: 'Centralita telefónica SIP IP con puertos FXO/FXS y red Gigabit'
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
    defaultColor: '#581C87',
    powerWatts: 850,
    defaultIp: '10.10.10.50/24',
    description: 'Cabina de almacenamiento masivo 4U 24 bahías SAS/SATA ZFS en Ubuntu'
  },

  // =========================================================================
  // ENERGÍA, SAI / UPS Y REGLETAS PDU (APC, Eaton,Salicru)
  // =========================================================================
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
    defaultColor: '#78350F',
    powerWatts: 90,
    defaultIp: '10.10.99.5/24',
    description: 'Sistema de alimentación ininterrumpida 2U con tarjeta de red SNMP'
  },
  {
    id: 'tpl-ups-salicru-1u',
    name: 'SAI / UPS Salicru SPS / Eaton 5P (1U)',
    brand: 'Salicru / Eaton',
    model: 'SPS 1500 Advance R 1U',
    category: 'ups',
    uSize: 1,
    defaultPorts: 2,
    portType: 'rj45',
    sfpUplinks: 0,
    defaultColor: '#78350F',
    powerWatts: 45,
    defaultIp: '10.10.99.6/24',
    description: 'SAI interactivo senoidal en formato compacto 1U con monitoreo de red'
  },
  {
    id: 'tpl-ups-pdu-1u',
    name: 'Regleta PDU Monitorizada IP (1U)',
    brand: 'APC / Raritan',
    model: 'AP7920B Metered Rack PDU',
    category: 'ups',
    uSize: 1,
    defaultPorts: 8,
    portType: 'power',
    sfpUplinks: 0,
    defaultColor: '#0F172A',
    powerWatts: 15,
    defaultIp: '10.10.99.10/24',
    description: 'Distribuidor de alimentación eléctrica 1U con 8 tomas C13 y puerto Ethernet'
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
  router: 'Router / ISP',
  patchpanel: 'Patch Panel',
  switch: 'Switch',
  server: 'Servidor / NAS',
  ups: 'SAI / PDU'
};

export function createDeviceFromTemplate(
  template: HardwareTemplate,
  uStart: number,
  customSuffix?: number,
  customRowCounts?: number[],
  customColor?: string
): RackDevice {
  const id = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
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
      row: effectiveRows.length,
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
    customColor: customColor || template.defaultColor || '#1E293B',
    portsPerRow: effectiveRows,
    ports
  };
}
