import { jsPDF } from 'jspdf';
import {
  CompanyProject,
  RackUnit,
  CableColor,
  RackDevice,
  DevicePort
} from '../types';
import {
  CATEGORY_LABELS,
  getOrganizedDeviceZones,
  ensureDevicePortCoordinates
} from '../constants';

export type CroquisPaperFormat =
  | 'a3-landscape'
  | 'a4-landscape'
  | 'a4-portrait';

const COLOR_RGB: Record<CableColor, [number, number, number]> = {
  blue: [59, 130, 246],
  yellow: [202, 138, 4],
  emerald: [16, 185, 129],
  red: [220, 38, 38],
  cyan: [6, 182, 212],
  purple: [147, 51, 234],
  orange: [234, 88, 12],
  slate: [100, 116, 139]
};

const COLOR_SPANISH: Record<CableColor, string> = {
  blue: 'Azul',
  yellow: 'Amarillo',
  emerald: 'Verde',
  red: 'Rojo',
  cyan: 'Cian',
  purple: 'Violeta',
  orange: 'Naranja',
  slate: 'Gris'
};

const CATEGORY_FILL: Record<string, [number, number, number]> = {
  firewall: [95, 25, 25],
  router: [30, 58, 138],
  ont: [6, 95, 70],
  patchpanel: [15, 23, 42],
  switch: [6, 78, 59],
  pbx: [88, 28, 135],
  nvr: [30, 58, 138],
  server: [30, 41, 59],
  ups: [120, 53, 15]
};

function hexToRgbTuple(hex?: string): [number, number, number] | null {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

export interface PortConnectionLookup {
  cableId: string;
  cableLabel: string;
  color: CableColor;
  category: string;
  vlan: string;
  lengthMeters: number;
  remoteDevice: RackDevice;
  remotePort: DevicePort;
}

export function buildPortConnectionMap(
  rack: RackUnit
): Record<string, PortConnectionLookup> {
  const map: Record<string, PortConnectionLookup> = {};
  for (const cab of rack.cables) {
    const fromDev = rack.devices.find((d) => d.id === cab.fromDeviceId);
    const toDev = rack.devices.find((d) => d.id === cab.toDeviceId);
    if (!fromDev || !toDev) continue;
    const fromPort = fromDev.ports.find((p) => p.id === cab.fromPortId);
    const toPort = toDev.ports.find((p) => p.id === cab.toPortId);
    if (!fromPort || !toPort) continue;

    map[fromPort.id] = {
      cableId: cab.id,
      cableLabel: cab.label,
      color: cab.color,
      category: cab.category,
      vlan: cab.vlan,
      lengthMeters: cab.lengthMeters,
      remoteDevice: toDev,
      remotePort: toPort
    };

    map[toPort.id] = {
      cableId: cab.id,
      cableLabel: cab.label,
      color: cab.color,
      category: cab.category,
      vlan: cab.vlan,
      lengthMeters: cab.lengthMeters,
      remoteDevice: fromDev,
      remotePort: fromPort
    };
  }
  return map;
}

/**
 * Generates a high-density printable Croquis PDF (DIN A3 Landscape, DIN A4 Landscape, or DIN A4 Portrait)
 * showing the visual rack elevation AND a point-by-point wiring map ("Cada punto a dónde va conectado").
 */
export function exportRackToTechnicalPDF(
  project: CompanyProject,
  rack: RackUnit,
  paperFormat: 'a3-landscape' | 'a4-landscape' | 'a4-portrait' = 'a3-landscape'
): void {
  const isA3 = paperFormat === 'a3-landscape';
  const isLandscape = paperFormat !== 'a4-portrait';

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: isA3 ? 'a3' : 'a4'
  });

  const pageW = isA3 ? 420 : isLandscape ? 297 : 210;
  const pageH = isA3 ? 297 : isLandscape ? 210 : 297;

  const dateStr = new Date().toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const portConnMap = buildPortConnectionMap(rack);
  const sortedDevices = [...rack.devices].sort((a, b) => {
    if (b.uStart !== a.uStart) return b.uStart - a.uStart;
    const order = { left: 0, full: 1, right: 2 };
    return order[a.shelfBay || 'full'] - order[b.shelfBay || 'full'];
  });
  const occupiedUSet = new Set<number>();
  rack.devices.forEach((d) => {
    for (let u = d.uStart; u < d.uStart + d.uSize; u++) {
      occupiedUSet.add(u);
    }
  });
  const usedU = occupiedUSet.size;
  const totalWatts = rack.devices.reduce((acc, d) => acc + d.powerWatts, 0);
  const totalPorts = rack.devices.reduce((acc, d) => acc + d.ports.length, 0);

  // =========================================================================
  // HEADER BANNER
  // =========================================================================
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isA3 ? 14 : 11);
  doc.text(
    `CROQUIS DE CONEXIONES PUNTO A PUNTO — ${rack.name.toUpperCase()} (${rack.locationCode})`,
    10,
    9
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(isA3 ? 9 : 7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Empresa: ${project.companyName}  |  Proyecto: ${project.projectName}  |  Armario: ${rack.totalU}U (${rack.widthMm || 600}x${rack.depthMm || 1000}mm)  |  Ocupación: ${usedU}/${rack.totalU}U  |  Equipos: ${rack.devices.length}  |  Cables: ${rack.cables.length}  |  Formato: ${
      isA3 ? 'DIN A3 Apaisado' : isLandscape ? 'DIN A4 Apaisado' : 'DIN A4 Vertical'
    }  |  Fecha: ${dateStr}`,
    10,
    16.5
  );

  // =========================================================================
  // LEFT COLUMN: ELEVACIÓN VISUAL DEL ARMARIO 19" Y PUERTOS
  // =========================================================================
  const rackX = 12;
  const rackY = 27;
  const rackW = isA3 ? 115 : isLandscape ? 86 : 75;
  const rackH = pageH - 38;
  const uHeight = rackH / rack.totalU;

  // Outer Rack Frame
  doc.setFillColor(15, 23, 42);
  doc.rect(rackX - 4, rackY - 2, rackW + 8, rackH + 4, 'F');

  doc.setFillColor(24, 33, 47);
  doc.rect(rackX, rackY, rackW, rackH, 'F');

  // U Slot Grid Lines
  doc.setLineWidth(0.08);
  for (let u = rack.totalU; u >= 1; u--) {
    const idxFromTop = rack.totalU - u;
    const yPos = rackY + idxFromTop * uHeight;
    doc.setDrawColor(51, 65, 85);
    doc.line(rackX, yPos, rackX + rackW, yPos);

    doc.setFont('courier', 'normal');
    doc.setFontSize(isA3 ? 5.5 : 4.5);
    doc.setTextColor(148, 163, 184);
    const uStr = u.toString().padStart(2, '0');
    doc.text(uStr, rackX - 3.4, yPos + uHeight * 0.72);
    doc.text(uStr, rackX + rackW + 0.6, yPos + uHeight * 0.72);
  }

  // Draw Mounted Devices & Graphical Port Dots inside Rack
  const portCoordsInPdf: Record<string, { x: number; y: number }> = {};

  for (const dev of sortedDevices) {
    const topU = dev.uStart + dev.uSize - 1;
    const idxFromTop = rack.totalU - topU;
    const yTop = rackY + idxFromTop * uHeight;
    const h = dev.uSize * uHeight;

    const isHalfLeft = dev.shelfBay === 'left';
    const isHalfRight = dev.shelfBay === 'right';
    const devX = isHalfRight ? rackX + rackW / 2 + 0.2 : rackX + 0.5;
    const devW =
      isHalfLeft || isHalfRight ? rackW / 2 - 0.7 : rackW - 1;

    const customRgb = hexToRgbTuple(dev.customColor);
    const fill = customRgb || CATEGORY_FILL[dev.category] || [30, 41, 59];
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(devX, yTop + 0.2, devW, h - 0.4, 'FD');

    const shortBrand = dev.model.split('/')[0].trim().split(' ')[0];
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isA3 ? 5.5 : 4.4);
    doc.text(
      `${shortBrand} (${CATEGORY_LABELS[dev.category]})`.substring(
        0,
        isHalfLeft || isHalfRight ? 12 : 22
      ),
      devX + 1.2,
      yTop + Math.min(h / 2 + 0.8, 3.8)
    );

    // Draw individual port squares on the device faceplate
    const positionedPorts = ensureDevicePortCoordinates(dev);
    const labelOffset =
      isHalfLeft || isHalfRight ? (isA3 ? 16 : 12) : isA3 ? 28 : 22;
    const portAreaX = devX + labelOffset;
    const portAreaW = Math.max(8, devW - labelOffset - 1.5);

    for (const p of positionedPorts) {
      const px = portAreaX + ((p.xPercent ?? 50) / 100) * portAreaW;
      const py = yTop + ((p.yPercent ?? 50) / 100) * h;
      portCoordsInPdf[p.id] = { x: px, y: py };

      const conn = portConnMap[p.id];
      if (conn) {
        const rgb = COLOR_RGB[conn.color] || [59, 130, 246];
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.setDrawColor(255, 255, 255);
      } else {
        doc.setFillColor(15, 23, 42);
        doc.setDrawColor(100, 116, 139);
      }
      const boxW = isA3 ? 2.1 : 1.5;
      const boxH = isA3 ? 1.7 : 1.2;
      doc.setLineWidth(0.12);
      doc.rect(px - boxW / 2, py - boxH / 2, boxW, boxH, 'FD');
    }
  }

  // Draw Patch Cables connecting ports on the Rack Diagram
  rack.cables.forEach((cab, idx) => {
    const pt1 = portCoordsInPdf[cab.fromPortId];
    const pt2 = portCoordsInPdf[cab.toPortId];
    if (pt1 && pt2) {
      const rgb = COLOR_RGB[cab.color] || [59, 130, 246];
      doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
      doc.setLineWidth(isA3 ? 0.45 : 0.32);
      const trackX = rackX + rackW + 4.5 + (idx % 8) * 1.1;
      doc.line(pt1.x, pt1.y, trackX, pt1.y);
      doc.line(trackX, pt1.y, trackX, pt2.y);
      doc.line(trackX, pt2.y, pt2.x, pt2.y);
    }
  });

  // =========================================================================
  // RIGHT AREA: CROQUIS DETALLADO EQUIPO POR EQUIPO ("CADA PUNTO A DÓNDE VA")
  // =========================================================================
  let startX = rackX + rackW + 16;
  const availW = pageW - startX - 10;
  let curY = 27;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isA3 ? 11 : 9);
  doc.setTextColor(15, 23, 42);
  doc.text(
    'CROQUIS DE PUNTOS POR DISPOSITIVO (MAPA DE CONEXIÓN DE CADA PUERTO)',
    startX,
    curY + 3
  );
  curY += 6;

  for (const dev of sortedDevices) {
    const zones = getOrganizedDeviceZones(dev);
    const connectedPorts = dev.ports.filter((p) => Boolean(portConnMap[p.id]));

    // Estimate block height needed for this device
    const estHeight = isA3 ? 22 + zones.maxRows * 8 : 18 + zones.maxRows * 6.5;
    if (curY + estHeight > pageH - 12) {
      doc.addPage();
      curY = 16;
      startX = 12;
    }

    const blockW = startX === 12 ? pageW - 24 : availW;

    // Device Header Bar
    const customRgb = hexToRgbTuple(dev.customColor);
    const fill = customRgb || CATEGORY_FILL[dev.category] || [30, 41, 59];
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.rect(startX, curY, blockW, isA3 ? 6.5 : 5.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isA3 ? 8 : 6.8);
    const uTag =
      dev.uSize > 1
        ? `U${dev.uStart}-U${dev.uStart + dev.uSize - 1}`
        : `U${dev.uStart}`;
    doc.text(
      `[${uTag}] ${dev.name}  —  ${dev.model} (${CATEGORY_LABELS[dev.category]})`,
      startX + 2,
      curY + (isA3 ? 4.5 : 3.8)
    );

    doc.setFont('courier', 'normal');
    doc.setFontSize(isA3 ? 7 : 6);
    doc.text(
      `IP: ${dev.ipAddress}  |  ${connectedPorts.length}/${dev.ports.length} puntos conectados`,
      startX + blockW - (isA3 ? 78 : 64),
      curY + (isA3 ? 4.5 : 3.8)
    );

    curY += isA3 ? 7 : 6;

    // Draw every port as a box with its number/name AND where it goes
    const colsPerRow = isA3 ? 8 : isLandscape ? 6 : 4;
    const cellW = blockW / colsPerRow;
    const cellH = isA3 ? 9.5 : 8;

    const totalGridRows = Math.ceil(dev.ports.length / colsPerRow);

    for (let r = 0; r < totalGridRows; r++) {
      if (curY + cellH > pageH - 10) {
        doc.addPage();
        curY = 16;
        startX = 12;
      }

      const slice = dev.ports.slice(r * colsPerRow, (r + 1) * colsPerRow);
      slice.forEach((port, cIdx) => {
        const cx = startX + cIdx * cellW;
        const conn = portConnMap[port.id];

        if (conn) {
          const rgb = COLOR_RGB[conn.color] || [59, 130, 246];
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
          doc.setLineWidth(0.35);
          doc.rect(cx + 0.4, curY, cellW - 0.8, cellH - 0.6, 'FD');

          // Top color strip inside port box
          doc.setFillColor(rgb[0], rgb[1], rgb[2]);
          doc.rect(cx + 0.4, curY, cellW - 0.8, 2.5, 'F');

          doc.setTextColor(255, 255, 255);
          doc.setFont('courier', 'bold');
          doc.setFontSize(isA3 ? 5.8 : 4.8);
          doc.text(
            `#${port.number.toString().padStart(2, '0')} ${port.label} (${conn.cableLabel})`.substring(
              0,
              24
            ),
            cx + 1.2,
            curY + 1.9
          );

          // Destination Target Line 1: Remote Device
          doc.setTextColor(15, 23, 42);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(isA3 ? 5.8 : 4.8);
          doc.text(
            `-> [U${conn.remoteDevice.uStart}] ${conn.remoteDevice.name}`.substring(
              0,
              25
            ),
            cx + 1.2,
            curY + (isA3 ? 5.2 : 4.6)
          );

          // Destination Target Line 2: Remote Port + VLAN
          doc.setTextColor(51, 65, 85);
          doc.setFont('courier', 'normal');
          doc.setFontSize(isA3 ? 5.3 : 4.4);
          doc.text(
            `Pto: ${conn.remotePort.label} (#${conn.remotePort.number}) · ${conn.vlan}`.substring(
              0,
              27
            ),
            cx + 1.2,
            curY + (isA3 ? 8.1 : 6.9)
          );
        } else {
          // Free port cell
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.15);
          doc.rect(cx + 0.4, curY, cellW - 0.8, cellH - 0.6, 'FD');

          doc.setTextColor(100, 116, 139);
          doc.setFont('courier', 'bold');
          doc.setFontSize(isA3 ? 5.5 : 4.6);
          doc.text(
            `#${port.number.toString().padStart(2, '0')} ${port.label} [${port.type.toUpperCase()}]`.substring(
              0,
              22
            ),
            cx + 1.2,
            curY + (isA3 ? 3.5 : 3)
          );

          doc.setTextColor(148, 163, 184);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(isA3 ? 5 : 4.2);
          doc.text('LIBRE (Sin conexión)', cx + 1.2, curY + (isA3 ? 6.8 : 5.8));
        }
      });

      curY += cellH;
    }

    curY += 3;
  }

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Croquis Técnico de Conexionado Punto a Punto — ${project.companyName} · ${rack.name} (${totalPorts} puertos totales / ${rack.cables.length} latiguillos activos)`,
    10,
    pageH - 4
  );

  const safeName = `${project.companyName}_${rack.name}_${paperFormat}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  doc.save(`croquis_rack_${safeName}.pdf`);
}
