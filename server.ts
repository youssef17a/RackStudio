import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { CompanyProject, RackDevice, DevicePort, UserRole } from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'rack_projects.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const DEFAULT_ADMIN_USER = process.env.RACK_ADMIN_USER || 'administrador';
const DEFAULT_ADMIN_PASS = process.env.RACK_ADMIN_PASS || 'Amrani_LAN';

interface StoredUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

interface SessionInfo {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
}

// Map token -> SessionInfo
const activeSessions = new Map<string, SessionInfo>();

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createStoredUser(
  username: string,
  passwordPlain: string,
  fullName: string,
  role: UserRole
): StoredUser {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(passwordPlain, salt);
  return {
    id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    username: username.trim(),
    fullName: fullName.trim() || username.trim(),
    role,
    salt,
    passwordHash,
    createdAt: new Date().toISOString()
  };
}

function ensureUsersInitialized(): StoredUser[] {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    const defaultAdmin = createStoredUser(
      DEFAULT_ADMIN_USER,
      DEFAULT_ADMIN_PASS,
      'Administrador Principal',
      'admin'
    );
    fs.writeFileSync(USERS_FILE, JSON.stringify([defaultAdmin], null, 2), 'utf-8');
    return [defaultAdmin];
  }
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Empty users file');
    }
    return parsed;
  } catch {
    const defaultAdmin = createStoredUser(
      DEFAULT_ADMIN_USER,
      DEFAULT_ADMIN_PASS,
      'Administrador Principal',
      'admin'
    );
    fs.writeFileSync(USERS_FILE, JSON.stringify([defaultAdmin], null, 2), 'utf-8');
    return [defaultAdmin];
  }
}

function saveUsersToDisk(users: StoredUser[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function buildPorts(
  devId: string,
  rj45Count: number,
  sfpCount: number,
  prefix: string,
  portType: 'rj45' | 'keystone' | 'sfp' = 'rj45'
): DevicePort[] {
  const ports: DevicePort[] = [];
  for (let i = 1; i <= rj45Count; i++) {
    ports.push({
      id: `${devId}-p${i}`,
      number: i,
      label: `${prefix}${i.toString().padStart(2, '0')}`,
      type: portType,
      vlan: portType === 'keystone' ? '10' : '1',
      speed: portType === 'sfp' ? '10G' : '1G'
    });
  }
  for (let s = 1; s <= sfpCount; s++) {
    const num = rj45Count + s;
    ports.push({
      id: `${devId}-sfp${s}`,
      number: num,
      label: `SFP+${s}`,
      type: 'sfp',
      vlan: 'Trunk',
      speed: '10G'
    });
  }
  return ports;
}

function getInitialSeedProjects(): CompanyProject[] {
  const fw1Id = 'dev-fw-01';
  const rt1Id = 'dev-rt-01';
  const pp1Id = 'dev-pp-01';
  const sw1Id = 'dev-sw-01';
  const pp2Id = 'dev-pp-02';
  const sw2Id = 'dev-sw-02';
  const srv1Id = 'dev-srv-01';
  const srv2Id = 'dev-srv-02';
  const ups1Id = 'dev-ups-01';

  const devicesRack1: RackDevice[] = [
    {
      id: fw1Id,
      templateId: 'tpl-fw-fg100f',
      name: 'FW-PERIMETRAL-01',
      model: 'Fortinet FortiGate 100F',
      category: 'firewall',
      uStart: 41,
      uSize: 1,
      ipAddress: '10.10.0.1/24',
      managementVlan: 'VLAN 99 (Sec)',
      serialNumber: 'FG100FTK22004912',
      powerWatts: 115,
      status: 'nominal',
      notes: 'Cortafuegos principal HA Activo. Enlace fibra WAN1 y WAN2.',
      ports: buildPorts(fw1Id, 12, 4, 'PORT', 'rj45')
    },
    {
      id: rt1Id,
      templateId: 'tpl-rt-ccr2004',
      name: 'RT-CORE-BGP-01',
      model: 'MikroTik CCR2004-16G-2S+',
      category: 'router',
      uStart: 39,
      uSize: 1,
      ipAddress: '10.10.0.2/24',
      managementVlan: 'VLAN 10 (Mgmt)',
      serialNumber: 'MT-CCR2004-89123',
      powerWatts: 48,
      status: 'nominal',
      notes: 'Enrutador Core inter-VLAN y túneles WireGuard.',
      ports: buildPorts(rt1Id, 16, 2, 'GE', 'rj45')
    },
    {
      id: pp1Id,
      templateId: 'tpl-pp-24cat6a',
      name: 'PATCH-PANEL-PLANTA-1A',
      model: 'Panduit CPP24FMWBLY 24-Port',
      category: 'patchpanel',
      uStart: 36,
      uSize: 1,
      ipAddress: 'Pasivo (Cat6A)',
      managementVlan: 'N/A',
      serialNumber: 'PN-PP24-001A',
      powerWatts: 0,
      status: 'nominal',
      notes: 'Rosetas de red Puestos 01 al 24 — Planta Primera Administración.',
      ports: buildPorts(pp1Id, 24, 0, 'P', 'keystone')
    },
    {
      id: sw1Id,
      templateId: 'tpl-sw-c9300-24',
      name: 'SW-CORE-DIST-01',
      model: 'Cisco Catalyst 9300-24P',
      category: 'switch',
      uStart: 34,
      uSize: 1,
      ipAddress: '10.10.1.10/24',
      managementVlan: 'VLAN 10 (Mgmt)',
      serialNumber: 'FOC2418L19A',
      powerWatts: 350,
      status: 'nominal',
      notes: 'Switch principal PoE+ para APs WiFi 6 y parcheo Planta 1.',
      ports: buildPorts(sw1Id, 24, 4, 'Gi1/0/', 'rj45')
    },
    {
      id: pp2Id,
      templateId: 'tpl-pp-24cat6a',
      name: 'PATCH-PANEL-SERVIDORES-B',
      model: 'Panduit CPP24FMWBLY 24-Port',
      category: 'patchpanel',
      uStart: 31,
      uSize: 1,
      ipAddress: 'Pasivo (Cat6A)',
      managementVlan: 'N/A',
      serialNumber: 'PN-PP24-002B',
      powerWatts: 0,
      status: 'nominal',
      notes: 'Parcheo estructurado de sala técnica, KVM e impresoras.',
      ports: buildPorts(pp2Id, 24, 0, 'B', 'keystone')
    },
    {
      id: sw2Id,
      templateId: 'tpl-sw-usw-pro-24',
      name: 'SW-ACCESO-LAN-02',
      model: 'Ubiquiti USW-Pro-24-PoE',
      category: 'switch',
      uStart: 29,
      uSize: 1,
      ipAddress: '10.10.1.11/24',
      managementVlan: 'VLAN 10 (Mgmt)',
      serialNumber: 'UBNT-7483C2910',
      powerWatts: 280,
      status: 'nominal',
      notes: 'Switch de distribución secundaria y cámaras IP.',
      ports: buildPorts(sw2Id, 24, 2, 'Port', 'rj45')
    },
    {
      id: srv1Id,
      templateId: 'tpl-srv-ubuntu-1u',
      name: 'SRV-UBUNTU-DCIM-01',
      model: 'Dell EMC PowerEdge R660 XS',
      category: 'server',
      uStart: 24,
      uSize: 1,
      ipAddress: '10.10.10.20/24',
      managementVlan: 'VLAN 20 (Servers)',
      serialNumber: 'DELL-ST-99812X',
      powerWatts: 420,
      status: 'nominal',
      notes: 'Ubuntu Server 24.04 LTS — Host de servicios internos, DNS, Docker y este simulador DCIM.',
      ports: buildPorts(srv1Id, 4, 2, 'eno', 'rj45')
    },
    {
      id: srv2Id,
      templateId: 'tpl-srv-proxmox-2u',
      name: 'SRV-CLUSTER-KVM-02',
      model: 'HPE ProLiant DL380 Gen11',
      category: 'server',
      uStart: 20,
      uSize: 2,
      ipAddress: '10.10.10.30/24',
      managementVlan: 'VLAN 20 (Servers)',
      serialNumber: 'HPE-CZ2341098B',
      powerWatts: 680,
      status: 'nominal',
      notes: 'Cluster de virtualización Ubuntu KVM + ZFS Storage replicado.',
      ports: buildPorts(srv2Id, 6, 2, 'eth', 'rj45')
    },
    {
      id: ups1Id,
      templateId: 'tpl-ups-apc-2u',
      name: 'SAI-APC-3000VA-01',
      model: 'APC Schneider SMT3000RMI2U',
      category: 'ups',
      uStart: 2,
      uSize: 2,
      ipAddress: '10.10.99.5/24',
      managementVlan: 'VLAN 99 (Mgmt)',
      serialNumber: 'APC-AS2219381',
      powerWatts: 90,
      status: 'nominal',
      notes: 'Baterías al 100%, autonomía estimada 42 min a carga actual.',
      ports: buildPorts(ups1Id, 2, 0, 'SNMP', 'rj45')
    }
  ];

  return [
    {
      id: 'proj-amrani-hq',
      companyName: 'Amrani Telecom & IT Corp',
      projectName: 'CPD Principal — Sede Central Madrid',
      siteAddress: 'Av. de la Innovación 45, Planta 2, Sala Técnica A',
      technicalContact: 'administrador@amrani-lan.local',
      updatedAt: new Date().toISOString(),
      racks: [
        {
          id: 'rack-mdf-01',
          name: 'Rack 01 — MDF Core & Servidores',
          locationCode: 'MDF-SALA-A01',
          totalU: 42,
          maxPowerWatts: 3500,
          devices: devicesRack1,
          cables: [
            {
              id: 'cab-001',
              label: 'WAN-TRUNK-01',
              fromDeviceId: fw1Id,
              fromPortId: `${fw1Id}-sfp1`,
              toDeviceId: rt1Id,
              toPortId: `${rt1Id}-sfp1`,
              color: 'red',
              category: 'DAC 10G',
              vlan: 'VLAN 900 (WAN/Transit)',
              lengthMeters: 1.0
            },
            {
              id: 'cab-002',
              label: 'CORE-UPLINK-10G',
              fromDeviceId: rt1Id,
              fromPortId: `${rt1Id}-sfp2`,
              toDeviceId: sw1Id,
              toPortId: `${sw1Id}-sfp1`,
              color: 'cyan',
              category: 'Fibra OM4',
              vlan: 'Trunk All VLANs',
              lengthMeters: 1.5
            },
            {
              id: 'cab-003',
              label: 'PATCH-P01-ADMIN',
              fromDeviceId: pp1Id,
              fromPortId: `${pp1Id}-p1`,
              toDeviceId: sw1Id,
              toPortId: `${sw1Id}-p1`,
              color: 'blue',
              category: 'Cat6A',
              vlan: 'VLAN 10 (Corp LAN)',
              lengthMeters: 0.5
            },
            {
              id: 'cab-004',
              label: 'PATCH-P02-ADMIN',
              fromDeviceId: pp1Id,
              fromPortId: `${pp1Id}-p2`,
              toDeviceId: sw1Id,
              toPortId: `${sw1Id}-p2`,
              color: 'blue',
              category: 'Cat6A',
              vlan: 'VLAN 10 (Corp LAN)',
              lengthMeters: 0.5
            },
            {
              id: 'cab-005',
              label: 'PATCH-P03-VOIP',
              fromDeviceId: pp1Id,
              fromPortId: `${pp1Id}-p3`,
              toDeviceId: sw1Id,
              toPortId: `${sw1Id}-p3`,
              color: 'emerald',
              category: 'Cat6A',
              vlan: 'VLAN 30 (VoIP)',
              lengthMeters: 0.5
            },
            {
              id: 'cab-006',
              label: 'SW1-TO-SW2-10G',
              fromDeviceId: sw1Id,
              fromPortId: `${sw1Id}-sfp2`,
              toDeviceId: sw2Id,
              toPortId: `${sw2Id}-sfp1`,
              color: 'cyan',
              category: 'Fibra OM4',
              vlan: 'Trunk All VLANs',
              lengthMeters: 1.5
            },
            {
              id: 'cab-007',
              label: 'SRV-UBUNTU-BOND0',
              fromDeviceId: sw1Id,
              fromPortId: `${sw1Id}-sfp3`,
              toDeviceId: srv1Id,
              toPortId: `${srv1Id}-sfp1`,
              color: 'purple',
              category: 'DAC 10G',
              vlan: 'VLAN 20 (Servers)',
              lengthMeters: 2.0
            },
            {
              id: 'cab-008',
              label: 'SRV-KVM-10G-SAN',
              fromDeviceId: sw1Id,
              fromPortId: `${sw1Id}-sfp4`,
              toDeviceId: srv2Id,
              toPortId: `${srv2Id}-sfp1`,
              color: 'purple',
              category: 'DAC 10G',
              vlan: 'VLAN 20 (Servers)',
              lengthMeters: 2.5
            },
            {
              id: 'cab-009',
              label: 'PATCH-B01-KVM',
              fromDeviceId: pp2Id,
              fromPortId: `${pp2Id}-p1`,
              toDeviceId: sw2Id,
              toPortId: `${sw2Id}-p1`,
              color: 'yellow',
              category: 'Cat6A',
              vlan: 'VLAN 99 (IPMI/iDRAC)',
              lengthMeters: 0.5
            },
            {
              id: 'cab-010',
              label: 'UPS-SNMP-MGMT',
              fromDeviceId: sw2Id,
              fromPortId: `${sw2Id}-p24`,
              toDeviceId: ups1Id,
              toPortId: `${ups1Id}-p1`,
              color: 'emerald',
              category: 'Cat6',
              vlan: 'VLAN 99 (Mgmt)',
              lengthMeters: 3.0
            }
          ]
        }
      ]
    },
    {
      id: 'proj-logistica-norte',
      companyName: 'Logística Ibérica S.A.',
      projectName: 'Nodo Industrial — Nave Logística Norte',
      siteAddress: 'Polígono Industrial Zona Franca, Nave 12',
      technicalContact: 'infraestructura@logistica-norte.es',
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      racks: [
        {
          id: 'rack-idf-nave1',
          name: 'Armario IDF-01 Planta Almacén',
          locationCode: 'IDF-NAVE-12',
          totalU: 24,
          maxPowerWatts: 2200,
          devices: [
            {
              id: 'dev-log-fw1',
              templateId: 'tpl-fw-pa440',
              name: 'FW-SUCURSAL-PA440',
              model: 'Palo Alto PA-440 Rackmount',
              category: 'firewall',
              uStart: 23,
              uSize: 1,
              ipAddress: '10.50.0.1/24',
              managementVlan: 'VLAN 10',
              serialNumber: 'PA440-0091823',
              powerWatts: 65,
              status: 'nominal',
              notes: 'Túnel IPsec hacia Sede Central Madrid.',
              ports: buildPorts('dev-log-fw1', 8, 2, 'ETH', 'rj45')
            },
            {
              id: 'dev-log-pp1',
              templateId: 'tpl-pp-24cat6a',
              name: 'PATCH-PANEL-ALMACEN',
              model: 'Panduit CPP24FMWBLY 24-Port',
              category: 'patchpanel',
              uStart: 20,
              uSize: 1,
              ipAddress: 'Pasivo',
              managementVlan: 'N/A',
              serialNumber: 'PN-LOG-019',
              powerWatts: 0,
              status: 'nominal',
              notes: 'Puntos de acceso lectores de código de barras y básculas.',
              ports: buildPorts('dev-log-pp1', 24, 0, 'P', 'keystone')
            },
            {
              id: 'dev-log-sw1',
              templateId: 'tpl-sw-usw-pro-24',
              name: 'SW-POE-ALMACEN-01',
              model: 'Ubiquiti USW-Pro-24-PoE',
              category: 'switch',
              uStart: 18,
              uSize: 1,
              ipAddress: '10.50.1.10/24',
              managementVlan: 'VLAN 10',
              serialNumber: 'UBNT-998123A',
              powerWatts: 280,
              status: 'nominal',
              notes: 'Alimentación PoE para antenas WiFi industriales y CCTV.',
              ports: buildPorts('dev-log-sw1', 24, 2, 'Port', 'rj45')
            },
            {
              id: 'dev-log-srv1',
              templateId: 'tpl-srv-ubuntu-1u',
              name: 'SRV-UBUNTU-EDGE-WMS',
              model: 'Dell EMC PowerEdge R660 XS',
              category: 'server',
              uStart: 14,
              uSize: 1,
              ipAddress: '10.50.10.5/24',
              managementVlan: 'VLAN 20',
              serialNumber: 'DELL-WMS-551',
              powerWatts: 420,
              status: 'nominal',
              notes: 'Servidor Ubuntu local para caché de Sistema de Gestión de Almacenes (SGA).',
              ports: buildPorts('dev-log-srv1', 4, 2, 'eno', 'rj45')
            }
          ],
          cables: [
            {
              id: 'cab-log-1',
              label: 'FW-TO-SW-UPLINK',
              fromDeviceId: 'dev-log-fw1',
              fromPortId: 'dev-log-fw1-p1',
              toDeviceId: 'dev-log-sw1',
              toPortId: 'dev-log-sw1-p24',
              color: 'red',
              category: 'Cat6A',
              vlan: 'Trunk',
              lengthMeters: 1.0
            },
            {
              id: 'cab-log-2',
              label: 'AP-PASILLO-01',
              fromDeviceId: 'dev-log-pp1',
              fromPortId: 'dev-log-pp1-p1',
              toDeviceId: 'dev-log-sw1',
              toPortId: 'dev-log-sw1-p1',
              color: 'orange',
              category: 'Cat6A',
              vlan: 'VLAN 40 (WiFi Ind)',
              lengthMeters: 0.5
            },
            {
              id: 'cab-log-3',
              label: 'SRV-WMS-10G',
              fromDeviceId: 'dev-log-sw1',
              fromPortId: 'dev-log-sw1-sfp1',
              toDeviceId: 'dev-log-srv1',
              toPortId: 'dev-log-srv1-sfp1',
              color: 'purple',
              category: 'DAC 10G',
              vlan: 'VLAN 20 (Servers)',
              lengthMeters: 1.5
            }
          ]
        }
      ]
    }
  ];
}

function ensureDatabaseInitialized(): { projects: CompanyProject[]; lastSaved: string } {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      lastSaved: new Date().toISOString(),
      projects: getInitialSeedProjects()
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.projects || !Array.isArray(parsed.projects)) {
      throw new Error('Invalid DB structure');
    }
    return parsed;
  } catch {
    const initialData = {
      lastSaved: new Date().toISOString(),
      projects: getInitialSeedProjects()
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }
}

function saveProjectsToDisk(projects: CompanyProject[]): string {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const lastSaved = new Date().toISOString();
  const payload = {
    lastSaved,
    projects
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  return lastSaved;
}

function getSessionFromRequest(req: Request): SessionInfo | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.replace('Bearer ', '').trim();
  return activeSessions.get(token) || null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'No autorizado. Inicie sesión con sus credenciales.' });
    return;
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'No autorizado.' });
    return;
  }
  if (session.role !== 'admin') {
    res.status(403).json({
      error: 'Permiso denegado. Solo un usuario con rol Administrador puede gestionar usuarios.'
    });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Ensure local storage on Ubuntu Server is ready on boot
  ensureDatabaseInitialized();
  ensureUsersInitialized();

  // Auth Login Endpoint
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Introduzca usuario y contraseña.' });
      return;
    }

    const users = ensureUsersInitialized();
    const cleanUser = String(username).trim().toLowerCase();
    const foundUser = users.find((u) => u.username.toLowerCase() === cleanUser);

    if (!foundUser) {
      res.status(401).json({
        error: 'Credenciales incorrectas. Verifique el usuario y la contraseña.'
      });
      return;
    }

    const candidateHash = hashPassword(String(password), foundUser.salt);
    if (candidateHash !== foundUser.passwordHash) {
      res.status(401).json({
        error: 'Credenciales incorrectas. Verifique el usuario y la contraseña.'
      });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    const session: SessionInfo = {
      userId: foundUser.id,
      username: foundUser.username,
      fullName: foundUser.fullName,
      role: foundUser.role
    };
    activeSessions.set(token, session);

    res.json({
      token,
      user: session
    });
  });

  // Verify token
  app.get('/api/auth/session', (req: Request, res: Response) => {
    const session = getSessionFromRequest(req);
    if (session) {
      res.json({
        authenticated: true,
        user: session
      });
      return;
    }
    res.status(401).json({ authenticated: false });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      activeSessions.delete(token);
    }
    res.json({ ok: true });
  });

  // =========================================================================
  // USER MANAGEMENT API (Ubuntu Server ./data/users.json)
  // =========================================================================

  // List all users (Admin only)
  app.get('/api/users', requireAdmin, (_req: Request, res: Response) => {
    const users = ensureUsersInitialized();
    const safeUsers = users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      createdAt: u.createdAt
    }));
    res.json({ users: safeUsers });
  });

  // Create a new user (Admin only)
  app.post('/api/users', requireAdmin, (req: Request, res: Response) => {
    const { username, password, fullName, role } = req.body;
    if (!username || !password || String(password).length < 4) {
      res.status(400).json({
        error: 'El nombre de usuario es obligatorio y la contraseña debe tener al menos 4 caracteres.'
      });
      return;
    }

    const users = ensureUsersInitialized();
    const cleanUsername = String(username).trim();
    if (users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      res.status(409).json({
        error: `El usuario "${cleanUsername}" ya existe en el servidor.`
      });
      return;
    }

    const validRole: UserRole = role === 'admin' ? 'admin' : 'technician';
    const newUser = createStoredUser(
      cleanUsername,
      String(password),
      String(fullName || cleanUsername),
      validRole
    );

    const updated = [...users, newUser];
    saveUsersToDisk(updated);

    res.json({
      user: {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.fullName,
        role: newUser.role,
        createdAt: newUser.createdAt
      }
    });
  });

  // Change password (User can change own password, or Admin can change any user's password)
  app.put('/api/users/:id/password', requireAuth, (req: Request, res: Response) => {
    const session = getSessionFromRequest(req)!;
    const targetId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 4) {
      res.status(400).json({
        error: 'La nueva contraseña debe tener al menos 4 caracteres.'
      });
      return;
    }

    if (session.role !== 'admin' && session.userId !== targetId) {
      res.status(403).json({
        error: 'No tiene permisos para modificar la contraseña de otro usuario.'
      });
      return;
    }

    const users = ensureUsersInitialized();
    const targetIndex = users.findIndex((u) => u.id === targetId);
    if (targetIndex === -1) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(String(newPassword), salt);
    users[targetIndex] = {
      ...users[targetIndex],
      salt,
      passwordHash
    };

    saveUsersToDisk(users);
    res.json({ ok: true });
  });

  // Delete user (Admin only, prevents deleting the last remaining admin or oneself)
  app.delete('/api/users/:id', requireAdmin, (req: Request, res: Response) => {
    const session = getSessionFromRequest(req)!;
    const targetId = req.params.id;

    const users = ensureUsersInitialized();
    const targetUser = users.find((u) => u.id === targetId);
    if (!targetUser) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    if (targetUser.id === session.userId) {
      res.status(400).json({
        error: 'No puede eliminar su propia cuenta de administrador con la sesión activa.'
      });
      return;
    }

    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (targetUser.role === 'admin' && adminCount <= 1) {
      res.status(400).json({
        error: 'No se puede eliminar el único administrador del servidor.'
      });
      return;
    }

    const updated = users.filter((u) => u.id !== targetId);
    saveUsersToDisk(updated);

    // Revoke any active tokens for deleted user
    for (const [tok, sess] of activeSessions.entries()) {
      if (sess.userId === targetId) {
        activeSessions.delete(tok);
      }
    }

    res.json({ ok: true });
  });

  // =========================================================================
  // PROJECTS & UBUNTU SERVER STORAGE API
  // =========================================================================

  app.get('/api/projects', requireAuth, (_req: Request, res: Response) => {
    const data = ensureDatabaseInitialized();
    const users = ensureUsersInitialized();
    const stats = fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE) : { size: 0 };

    let totalDevices = 0;
    let totalCables = 0;
    for (const p of data.projects) {
      for (const r of p.racks) {
        totalDevices += r.devices.length;
        totalCables += r.cables.length;
      }
    }

    res.json({
      projects: data.projects,
      serverInfo: {
        storagePath: DB_FILE,
        usersPath: USERS_FILE,
        hostname: os.hostname(),
        platform: `${os.type()} ${os.arch()}`,
        osRelease: os.release(),
        lastSaved: data.lastSaved,
        fileSizeBytes: stats.size,
        totalProjects: data.projects.length,
        totalDevices,
        totalCables,
        totalUsers: users.length
      }
    });
  });

  app.put('/api/projects', requireAuth, (req: Request, res: Response) => {
    const { projects } = req.body;
    if (!Array.isArray(projects)) {
      res.status(400).json({ error: 'Formato de proyectos inválido.' });
      return;
    }
    const lastSaved = saveProjectsToDisk(projects);
    const users = ensureUsersInitialized();
    const stats = fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE) : { size: 0 };

    let totalDevices = 0;
    let totalCables = 0;
    for (const p of projects) {
      for (const r of p.racks) {
        totalDevices += r.devices.length;
        totalCables += r.cables.length;
      }
    }

    res.json({
      ok: true,
      serverInfo: {
        storagePath: DB_FILE,
        usersPath: USERS_FILE,
        hostname: os.hostname(),
        platform: `${os.type()} ${os.arch()}`,
        osRelease: os.release(),
        lastSaved,
        fileSizeBytes: stats.size,
        totalProjects: projects.length,
        totalDevices,
        totalCables,
        totalUsers: users.length
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RackMaster DCIM] Ubuntu Server escuchando en http://0.0.0.0:${PORT}`);
    console.log(`[RackMaster DCIM] Proyectos en: ${DB_FILE}`);
    console.log(`[RackMaster DCIM] Usuarios en: ${USERS_FILE}`);
  });
}

startServer();
