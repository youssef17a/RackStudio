#!/usr/bin/env bash
# ==============================================================================
# RackMaster DCIM — Script de Despliegue Automático para Ubuntu Server
# Compatible con: Ubuntu Server 20.04 / 22.04 / 24.04 LTS
# ==============================================================================

set -euo pipefail

# Colores para salida en terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

APP_NAME="rackmaster-dcim"
INSTALL_DIR="/opt/${APP_NAME}"
DATA_DIR="${INSTALL_DIR}/data"
BACKUP_DIR="/var/backups/${APP_NAME}"
SERVICE_NAME="rackmaster.service"
APP_PORT="${PORT:-3000}"
ADMIN_USER="${RACK_ADMIN_USER:-administrador}"
ADMIN_PASS="${RACK_ADMIN_PASS:-Amrani_LAN}"

# Detectar directorio desde donde se ejecuta el script (repositorio clonado con git)
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}========================================================================${NC}"
echo -e "${BLUE}  Iniciando despliegue de RackMaster DCIM en Ubuntu Server              ${NC}"
echo -e "${BLUE}========================================================================${NC}"

# 1. Comprobar privilegios de superusuario (root / sudo)
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}[ERROR] Este script debe ejecutarse con privilegios sudo o como root.${NC}"
  echo -e "Ejecuta: ${YELLOW}sudo bash deploy-ubuntu.sh${NC}"
  exit 1
fi

# Detectar el usuario real de Ubuntu que invocó sudo (o root si entró directo)
RUN_USER="${SUDO_USER:-$(whoami)}"
RUN_GROUP="$(id -gn "${RUN_USER}")"

echo -e "${GREEN}[1/7] Actualizando paquetes base del sistema Ubuntu Server...${NC}"
apt-get update -y
apt-get install -y curl ca-certificates gnupg build-essential rsync ufw

# 2. Comprobar e instalar Node.js 22 LTS si no existe o es inferior a v20
echo -e "${GREEN}[2/7] Verificando entorno de ejecución Node.js...${NC}"
NEED_NODE=true
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -v | cut -d. -f1 | tr -d 'v')
  if [[ "${NODE_MAJOR}" -ge 20 ]]; then
    NEED_NODE=false
    echo -e "  -> Node.js $(node -v) ya está instalado."
  fi
fi

if [[ "${NEED_NODE}" == true ]]; then
  echo -e "  -> Instalando Node.js 22.x LTS desde NodeSource..."
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
  echo -e "  -> Node.js $(node -v) y npm $(npm -v) instalados correctamente."
fi

# 3. Crear estructura de directorios en /opt/rackmaster-dcim y preservar datos
echo -e "${GREEN}[3/7] Montando estructura de directorios en ${INSTALL_DIR}...${NC}"
mkdir -p "${INSTALL_DIR}"
mkdir -p "${DATA_DIR}"
mkdir -p "${BACKUP_DIR}"

# Si ya existía una base de datos previa en producción, hacer copia de seguridad antes de actualizar
if [[ -f "${DATA_DIR}/rack_projects.json" ]]; then
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  cp "${DATA_DIR}/rack_projects.json" "${BACKUP_DIR}/rack_projects_${TIMESTAMP}.json"
  echo -e "  -> Backup preventivo de proyectos guardado en ${BACKUP_DIR}/rack_projects_${TIMESTAMP}.json"
fi

if [[ -f "${DATA_DIR}/users.json" ]]; then
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  cp "${DATA_DIR}/users.json" "${BACKUP_DIR}/users_${TIMESTAMP}.json"
  echo -e "  -> Backup preventivo de usuarios guardado en ${BACKUP_DIR}/users_${TIMESTAMP}.json"
fi

# Sincronizar archivos del repositorio git hacia /opt/rackmaster-dcim sin sobrescribir ./data/
if [[ "${REPO_DIR}" != "${INSTALL_DIR}" ]]; then
  echo -e "  -> Copiando código fuente desde ${REPO_DIR} hacia ${INSTALL_DIR}..."
  rsync -a --delete \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude 'data' \
    --exclude '.git' \
    "${REPO_DIR}/" "${INSTALL_DIR}/"
fi

# 4. Configurar archivo .env de producción
echo -e "${GREEN}[4/7] Configurando variables de entorno y credenciales iniciales...${NC}"
cat > "${INSTALL_DIR}/.env" <<EOF
NODE_ENV=production
PORT=${APP_PORT}
RACK_ADMIN_USER=${ADMIN_USER}
RACK_ADMIN_PASS=${ADMIN_PASS}
EOF

chmod 600 "${INSTALL_DIR}/.env"
chown -R "${RUN_USER}:${RUN_GROUP}" "${INSTALL_DIR}"
chown -R "${RUN_USER}:${RUN_GROUP}" "${BACKUP_DIR}"

# 5. Instalar dependencias npm y compilar el frontend de producción
echo -e "${GREEN}[5/7] Instalando paquetes npm y compilando aplicación (Vite Build)...${NC}"
cd "${INSTALL_DIR}"
sudo -u "${RUN_USER}" npm install
sudo -u "${RUN_USER}" npm run build

# 6. Crear y activar el servicio demonio en systemd
echo -e "${GREEN}[6/7] Configurando servicio systemd (${SERVICE_NAME})...${NC}"
NPM_BIN="$(command -v npm)"

cat > "/etc/systemd/system/${SERVICE_NAME}" <<EOF
[Unit]
Description=RackMaster DCIM - Simulador de Racks y Cableado Estructurado
Documentation=https://ubuntu.com/server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${RUN_USER}
Group=${RUN_GROUP}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=${NPM_BIN} run start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

# 7. Configurar script de backup diario automático en /etc/cron.daily
echo -e "${GREEN}[7/7] Configurando tarea de backup diario y puerto en firewall...${NC}"
cat > "/etc/cron.daily/${APP_NAME}-backup" <<EOF
#!/usr/bin/env bash
if [ -f "${DATA_DIR}/rack_projects.json" ]; then
  cp "${DATA_DIR}/rack_projects.json" "${BACKUP_DIR}/rack_projects_\$(date +%Y%m%d).json"
fi
if [ -f "${DATA_DIR}/users.json" ]; then
  cp "${DATA_DIR}/users.json" "${BACKUP_DIR}/users_\$(date +%Y%m%d).json"
fi
find "${BACKUP_DIR}" -type f -name "*.json" -mtime +30 -delete
EOF
chmod +x "/etc/cron.daily/${APP_NAME}-backup"

# Si UFW está activo, permitir el puerto de la aplicación
if command -v ufw >/dev/null 2>&1; then
  if ufw status | grep -q "Status: active"; then
    ufw allow "${APP_PORT}/tcp" >/dev/null 2>&1 || true
    echo -e "  -> Puerto TCP ${APP_PORT} abierto en UFW Firewall."
  fi
fi

# Obtener IP local del servidor para mostrar en el resumen final
SERVER_IP=$(hostname -I | awk '{print $1}')
if [[ -z "${SERVER_IP}" ]]; then
  SERVER_IP="localhost"
fi

echo ""
echo -e "${BLUE}========================================================================${NC}"
echo -e "${GREEN}  ¡DESPLIEGUE COMPLETADO CON ÉXITO EN UBUNTU SERVER!                    ${NC}"
echo -e "${BLUE}========================================================================${NC}"
echo -e "  URL de Acceso En Red : ${YELLOW}http://${SERVER_IP}:${APP_PORT}${NC}"
echo -e "  Directorio App       : ${INSTALL_DIR}"
echo -e "  Base de Datos Racks  : ${DATA_DIR}/rack_projects.json"
echo -e "  Base de Datos Users  : ${DATA_DIR}/users.json"
echo -e "  Backups Automáticos  : ${BACKUP_DIR}"
echo -e "  Estado del Servicio  : sudo systemctl status ${SERVICE_NAME}"
echo -e "${BLUE}========================================================================${NC}"
