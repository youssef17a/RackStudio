import React, { useState } from 'react';
import {
  Terminal,
  Copy,
  Check,
  HardDrive,
  Server,
  RefreshCw,
  Shield,
  Download,
  FileCode
} from 'lucide-react';
import { ServerStorageInfo } from '../types';

interface UbuntuDeployGuideProps {
  serverInfo: ServerStorageInfo | null;
  onForceSync: () => void;
  isSaving: boolean;
}

export const FULL_UBUNTU_DEPLOY_SCRIPT = `#!/usr/bin/env bash
# ==============================================================================
# RackMaster DCIM — Script de Despliegue Automático para Ubuntu Server
# Compatible con: Ubuntu Server 20.04 / 22.04 / 24.04 LTS
# ==============================================================================

set -euo pipefail

GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m'

APP_NAME="rackmaster-dcim"
INSTALL_DIR="/opt/\${APP_NAME}"
DATA_DIR="\${INSTALL_DIR}/data"
BACKUP_DIR="/var/backups/\${APP_NAME}"
SERVICE_NAME="rackmaster.service"
APP_PORT="\${PORT:-3000}"
ADMIN_USER="\${RACK_ADMIN_USER:-administrador}"
ADMIN_PASS="\${RACK_ADMIN_PASS:-Amrani_LAN}"

REPO_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

echo -e "\${BLUE}========================================================================\${NC}"
echo -e "\${BLUE}  Iniciando despliegue de RackMaster DCIM en Ubuntu Server              \${NC}"
echo -e "\${BLUE}========================================================================\${NC}"

if [[ \$EUID -ne 0 ]]; then
  echo -e "\${RED}[ERROR] Este script debe ejecutarse con privilegios sudo o como root.\${NC}"
  echo -e "Ejecuta: \${YELLOW}sudo bash deploy-ubuntu.sh\${NC}"
  exit 1
fi

RUN_USER="\${SUDO_USER:-\$(whoami)}"
RUN_GROUP="\$(id -gn "\${RUN_USER}")"

echo -e "\${GREEN}[1/7] Actualizando paquetes base del sistema Ubuntu Server...\${NC}"
apt-get update -y
apt-get install -y curl ca-certificates gnupg build-essential rsync ufw

echo -e "\${GREEN}[2/7] Verificando entorno de ejecución Node.js...\${NC}"
NEED_NODE=true
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=\$(node -v | cut -d. -f1 | tr -d 'v')
  if [[ "\${NODE_MAJOR}" -ge 20 ]]; then
    NEED_NODE=false
    echo -e "  -> Node.js \$(node -v) ya está instalado."
  fi
fi

if [[ "\${NEED_NODE}" == true ]]; then
  echo -e "  -> Instalando Node.js 22.x LTS desde NodeSource..."
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
fi

echo -e "\${GREEN}[3/7] Montando estructura de directorios en \${INSTALL_DIR}...\${NC}"
mkdir -p "\${INSTALL_DIR}"
mkdir -p "\${DATA_DIR}"
mkdir -p "\${BACKUP_DIR}"

if [[ -f "\${DATA_DIR}/rack_projects.json" ]]; then
  TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
  cp "\${DATA_DIR}/rack_projects.json" "\${BACKUP_DIR}/rack_projects_\${TIMESTAMP}.json"
  echo -e "  -> Backup preventivo de proyectos guardado en \${BACKUP_DIR}/rack_projects_\${TIMESTAMP}.json"
fi

if [[ -f "\${DATA_DIR}/users.json" ]]; then
  TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
  cp "\${DATA_DIR}/users.json" "\${BACKUP_DIR}/users_\${TIMESTAMP}.json"
  echo -e "  -> Backup preventivo de usuarios guardado en \${BACKUP_DIR}/users_\${TIMESTAMP}.json"
fi

if [[ "\${REPO_DIR}" != "\${INSTALL_DIR}" ]]; then
  echo -e "  -> Sincronizando código desde \${REPO_DIR} hacia \${INSTALL_DIR}..."
  rsync -a --delete \\
    --exclude 'node_modules' \\
    --exclude 'dist' \\
    --exclude 'data' \\
    --exclude '.git' \\
    "\${REPO_DIR}/" "\${INSTALL_DIR}/"
fi

echo -e "\${GREEN}[4/7] Configurando variables de entorno y credenciales iniciales...\${NC}"
cat > "\${INSTALL_DIR}/.env" <<EOF
NODE_ENV=production
PORT=\${APP_PORT}
RACK_ADMIN_USER=\${ADMIN_USER}
RACK_ADMIN_PASS=\${ADMIN_PASS}
EOF

chmod 600 "\${INSTALL_DIR}/.env"
chown -R "\${RUN_USER}:\${RUN_GROUP}" "\${INSTALL_DIR}"
chown -R "\${RUN_USER}:\${RUN_GROUP}" "\${BACKUP_DIR}"

echo -e "\${GREEN}[5/7] Instalando paquetes npm y compilando aplicación (Vite Build)...\${NC}"
cd "\${INSTALL_DIR}"
sudo -u "\${RUN_USER}" npm install
sudo -u "\${RUN_USER}" npm run build

echo -e "\${GREEN}[6/7] Configurando servicio systemd (\${SERVICE_NAME})...\${NC}"
NPM_BIN="\$(command -v npm)"

cat > "/etc/systemd/system/\${SERVICE_NAME}" <<EOF
[Unit]
Description=RackMaster DCIM - Simulador de Racks y Cableado Estructurado
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=\${RUN_USER}
Group=\${RUN_GROUP}
WorkingDirectory=\${INSTALL_DIR}
EnvironmentFile=\${INSTALL_DIR}/.env
ExecStart=\${NPM_BIN} run start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=\${APP_NAME}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "\${SERVICE_NAME}"
systemctl restart "\${SERVICE_NAME}"

echo -e "\${GREEN}[7/7] Configurando tarea de backup diario y puerto en firewall...\${NC}"
cat > "/etc/cron.daily/\${APP_NAME}-backup" <<EOF
#!/usr/bin/env bash
if [ -f "\${DATA_DIR}/rack_projects.json" ]; then
  cp "\${DATA_DIR}/rack_projects.json" "\${BACKUP_DIR}/rack_projects_\\\$(date +%Y%m%d).json"
fi
if [ -f "\${DATA_DIR}/users.json" ]; then
  cp "\${DATA_DIR}/users.json" "\${BACKUP_DIR}/users_\\\$(date +%Y%m%d).json"
fi
find "\${BACKUP_DIR}" -type f -name "*.json" -mtime +30 -delete
EOF
chmod +x "/etc/cron.daily/\${APP_NAME}-backup"

if command -v ufw >/dev/null 2>&1; then
  if ufw status | grep -q "Status: active"; then
    ufw allow "\${APP_PORT}/tcp" >/dev/null 2>&1 || true
  fi
fi

SERVER_IP=\$(hostname -I | awk '{print \$1}')
echo -e "\${GREEN}¡DESPLIEGUE COMPLETADO! Acceso: http://\${SERVER_IP:-localhost}:\${APP_PORT}\${NC}"
`;

export const UbuntuDeployGuide: React.FC<UbuntuDeployGuideProps> = ({
  serverInfo,
  onForceSync,
  isSaving
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCommand = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadBashScript = () => {
    const blob = new Blob([FULL_UBUNTU_DEPLOY_SCRIPT], {
      type: 'text/x-shellscript;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deploy-ubuntu.sh';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const quickGitCommands = `# 1. Clonar el repositorio en su Ubuntu Server
git clone <URL_DE_TU_REPOSITORIO_GIT> rackmaster-dcim
cd rackmaster-dcim

# 2. Dar permisos de ejecución y lanzar el instalador automático
chmod +x deploy-ubuntu.sh
sudo ./deploy-ubuntu.sh`;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header & Live Server Storage Card */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Script de Autodespliegue y Almacenamiento en Ubuntu Server
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              El repositorio incluye en la raíz el instalador <code className="text-blue-300 font-mono">deploy-ubuntu.sh</code> que monta toda la estructura en <code className="text-blue-300 font-mono">/opt/rackmaster-dcim</code> tras hacer <code className="text-blue-300 font-mono">git clone</code>.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleDownloadBashScript}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-medium rounded-lg flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Descargar deploy-ubuntu.sh</span>
            </button>
            <button
              type="button"
              onClick={onForceSync}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Guardando...' : 'Sincronizar Disco'}</span>
            </button>
          </div>
        </div>

        {/* Live telemetry grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800/90">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-blue-400" />
              <span>Base de Datos de Proyectos</span>
            </div>
            <div className="font-mono text-xs text-slate-100 break-all">
              {serverInfo?.storagePath || '/opt/rackmaster-dcim/data/rack_projects.json'}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800/90">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>Host y Kernel Detectado</span>
            </div>
            <div className="font-mono text-xs text-slate-100 tabular-nums">
              {serverInfo ? `${serverInfo.hostname} (${serverInfo.platform})` : 'Ubuntu Linux x86_64'}
            </div>
            <div className="font-mono text-[11px] text-slate-400 mt-0.5 tabular-nums">
              Kernel: {serverInfo?.osRelease || 'Linux 6.8.0-generic'}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800/90">
            <div className="text-xs text-slate-400 mb-1">
              Tamaño y Objetos Alojados
            </div>
            <div className="font-mono text-sm font-semibold text-white tabular-nums">
              {serverInfo ? `${(serverInfo.fileSizeBytes / 1024).toFixed(2)} KB` : '18.40 KB'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {serverInfo
                ? `${serverInfo.totalProjects} Empresas · ${serverInfo.totalDevices} Equipos · ${serverInfo.totalCables} Cables`
                : 'Sincronizado'}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800/90">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Usuarios Registrados (Scrypt)</span>
            </div>
            <div className="font-mono text-xs text-slate-100 tabular-nums">
              {serverInfo ? `${serverInfo.totalUsers} cuentas activas` : 'Control de acceso activo'}
            </div>
            <div className="font-mono text-[11px] text-slate-400 mt-0.5 break-all">
              {serverInfo?.usersPath || './data/users.json'}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Execution Box */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-400" />
            <span>01. Cómo ejecutarlo tras clonar el Git en Ubuntu Server</span>
          </h3>
          <button
            type="button"
            onClick={() => copyCommand('quick-git', quickGitCommands)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {copiedId === 'quick-git' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedId === 'quick-git' ? 'Copiado' : 'Copiar comandos'}</span>
          </button>
        </div>
        <pre className="p-4 rounded-lg bg-[#090D16] border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
          {quickGitCommands}
        </pre>
      </div>

      {/* Full Script Source View */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span>02. Contenido íntegro de deploy-ubuntu.sh (Incluido en la raíz del proyecto)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Instala Node.js 22 LTS, crea <code className="text-blue-300 font-mono">/opt/rackmaster-dcim/data</code>, preserva tanto proyectos como usuarios en actualizaciones, compila Vite, configura el demonio <code className="text-blue-300 font-mono">systemd</code> y programa backups diarios.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyCommand('full-script', FULL_UBUNTU_DEPLOY_SCRIPT)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {copiedId === 'full-script' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedId === 'full-script' ? 'Script Copiado' : 'Copiar Script Completo'}</span>
            </button>
          </div>
        </div>

        <pre className="p-4 rounded-lg bg-[#090D16] border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto max-h-[480px] leading-relaxed">
          {FULL_UBUNTU_DEPLOY_SCRIPT}
        </pre>
      </div>
    </div>
  );
};
