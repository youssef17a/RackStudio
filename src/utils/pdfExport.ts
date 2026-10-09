import { jsPDF } from 'jspdf';
import { CompanyProject, RackUnit, CableColor } from '../types';
import { CATEGORY_LABELS } from '../constants';

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

const CATEGORY_FILL: Record<string, [number, number, number]> = {
  firewall: [69, 26, 26],
  router: [30, 41, 75],
  patchpanel: [24, 32, 44],
  switch: [17, 54, 48],
  server: [30, 41, 59],
  ups: [40, 35, 25]
};

export function exportRackToTechnicalPDF(project: CompanyProject, rack: RackUnit): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const dateStr = new Date().toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  // =========================================================================
  // PAGE 1: ELEVACIÓN DE RACK Y DIAGRAMA VISUAL DE CABLEADO
  // =========================================================================
  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('DOCUMENTACIÓN TÉCNICA DE INFRAESTRUCTURA Y RACK', 12, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Empresa: ${project.companyName}  |  Proyecto: ${project.projectName}`, 12, 17.5);
  doc.text(`Armario: ${rack.name} (${rack.locationCode})  |  Capacidad: ${rack.totalU}U  |  Fecha: ${dateStr}`, 12, 23);

  // Summary Metrics Strip
  const usedU = rack.devices.reduce((acc, d) => acc + d.uSize, 0);
  const totalWatts = rack.devices.reduce((acc, d) => acc + d.powerWatts, 0);
  const totalPorts = rack.devices.reduce((acc, d) => acc + d.ports.length, 0);

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.rect(12, 32, 186, 14, 'FD');

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`OCUPACIÓN FÍSICA: ${usedU}U / ${rack.totalU}U (${Math.round((usedU / rack.totalU) * 100)}%)`, 16, 40.5);
  doc.text(`EQUIPOS INSTALADOS: ${rack.devices.length}`, 72, 40.5);
  doc.text(`LATIGUILLOS ACTIVOS: ${rack.cables.length} (${totalPorts} puertos)`, 115, 40.5);
  doc.text(`CARGA ELÉCTRICA: ${totalWatts}W / ${rack.maxPowerWatts}W`, 160, 40.5);

  // Left Column: Visual 19" Rack Elevation Diagram
  const rackX = 16;
  const rackY = 52;
  const rackW = 78;
  const rackH = 222;
  const uHeight = rackH / rack.totalU;

  // Outer Chassis Frame
  doc.setFillColor(15, 23, 42);
  doc.rect(rackX - 4, rackY - 3, rackW + 8, rackH + 6, 'F');

  // Inner Rack Cavity
  doc.setFillColor(30, 41, 59);
  doc.rect(rackX, rackY, rackW, rackH, 'F');

  // Draw U grid lines & numbers
  doc.setLineWidth(0.1);
  for (let u = rack.totalU; u >= 1; u--) {
    const idxFromTop = rack.totalU - u;
    const yPos = rackY + idxFromTop * uHeight;

    doc.setDrawColor(51, 65, 85);
    doc.line(rackX, yPos, rackX + rackW, yPos);

    // U Label on left and right rails
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.2);
    doc.setTextColor(148, 163, 184);
    const uStr = u.toString().padStart(2, '0');
    doc.text(uStr, rackX - 3.3, yPos + uHeight * 0.72);
    doc.text(uStr, rackX + rackW + 0.6, yPos + uHeight * 0.72);
  }

  // Draw mounted devices
  const deviceYCenterMap: Record<string, number> = {};

  for (const dev of rack.devices) {
    const topU = dev.uStart + dev.uSize - 1;
    const idxFromTop = rack.totalU - topU;
    const yTop = rackY + idxFromTop * uHeight;
    const h = dev.uSize * uHeight;
    deviceYCenterMap[dev.id] = yTop + h / 2;

    const fill = CATEGORY_FILL[dev.category] || [30, 41, 59];
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.rect(rackX + 0.5, yTop + 0.2, rackW - 1, h - 0.4, 'FD');

    // Category tag + Device Name + IP
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    const labelText = `[U${dev.uStart}] ${dev.name}`;
    doc.text(labelText.substring(0, 32), rackX + 2, yTop + h / 2 + 0.5);

    doc.setFont('courier', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(203, 213, 225);
    doc.text(dev.ipAddress.substring(0, 18), rackX + rackW - 22, yTop + h / 2 + 0.5);
  }

  // Draw Cable Arcs on the right edge of the rack
  rack.cables.forEach((cab, idx) => {
    const y1 = deviceYCenterMap[cab.fromDeviceId];
    const y2 = deviceYCenterMap[cab.toDeviceId];
    if (y1 !== undefined && y2 !== undefined) {
      const rgb = COLOR_RGB[cab.color] || [59, 130, 246];
      doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
      doc.setLineWidth(0.45);
      const offsetTrack = rackX + rackW + 5 + (idx % 7) * 1.4;
      doc.line(rackX + rackW, y1, offsetTrack, y1);
      doc.line(offsetTrack, y1, offsetTrack, y2);
      doc.line(offsetTrack, y2, rackX + rackW, y2);
    }
  });

  // Right Column: Inventory Table of Mounted Hardware
  const tableX = 108;
  let curY = 54;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Plano de Ocupación por Unidades (U)', tableX, curY);

  curY += 4;
  doc.setFillColor(241, 245, 249);
  doc.rect(tableX, curY, 90, 6, 'F');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('POS U', tableX + 1.5, curY + 4);
  doc.text('EQUIPO / HOSTNAME', tableX + 14, curY + 4);
  doc.text('TIPO', tableX + 49, curY + 4);
  doc.text('IP / GESTIÓN', tableX + 67, curY + 4);

  curY += 6;
  const sortedDevices = [...rack.devices].sort((a, b) => b.uStart - a.uStart);

  doc.setFont('helvetica', 'normal');
  for (const dev of sortedDevices) {
    if (curY > 268) break;
    const uRange = dev.uSize > 1 ? `U${dev.uStart}-U${dev.uStart + dev.uSize - 1}` : `U${dev.uStart}`;
    doc.setDrawColor(226, 232, 240);
    doc.line(tableX, curY + 5.5, tableX + 90, curY + 5.5);

    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text(uRange, tableX + 1.5, curY + 3.8);

    doc.setFont('helvetica', 'bold');
    doc.text(dev.name.substring(0, 21), tableX + 14, curY + 3.8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(CATEGORY_LABELS[dev.category] || dev.category, tableX + 49, curY + 3.8);

    doc.setFont('courier', 'normal');
    doc.text(dev.ipAddress.substring(0, 16), tableX + 67, curY + 3.8);

    curY += 5.8;
  }

  // Project Details Box below table if space allows
  if (curY < 235) {
    curY += 6;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(tableX, curY, 90, 32, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Ficha de Ubicación y Contacto Técnico', tableX + 3, curY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(51, 65, 85);
    doc.text(`Dirección: ${project.siteAddress}`, tableX + 3, curY + 11.5);
    doc.text(`Responsable: ${project.technicalContact}`, tableX + 3, curY + 16.5);
    doc.text(`Servidor Host: Ubuntu Server 24.04 LTS (Persistencia JSON)`, tableX + 3, curY + 21.5);
    doc.text(`Generado por: RackMaster DCIM — Administrador Amrani_LAN`, tableX + 3, curY + 26.5);
  }

  // Footer Page 1
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Página 1 de 2 — Diagrama de Elevación Física yAsignación de Unidades', 12, 289);
  doc.text('RackMaster DCIM · Ubuntu Server Edition', 155, 289);

  // =========================================================================
  // PAGE 2: MATRIZ DE PARCHEO Y CABLEADO ESTRUCTURADO PUNTO A PUNTO
  // =========================================================================
  doc.addPage();

  // Header Banner Page 2
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('MATRIZ DE CABLEADO ESTRUCTURADO Y PATCH PANELS', 12, 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${project.companyName} — ${rack.name} (${rack.cables.length} conexiones documentadas)`, 12, 17.5);

  let y2 = 32;
  doc.setFillColor(30, 41, 59);
  doc.rect(12, y2, 186, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('ID / ETIQUETA', 15, y2 + 4.8);
  doc.text('ORIGEN (EQUIPO : PUERTO)', 46, y2 + 4.8);
  doc.text('DESTINO (EQUIPO : PUERTO)', 100, y2 + 4.8);
  doc.text('TIPO / COLOR', 154, y2 + 4.8);
  doc.text('VLAN / LONG.', 178, y2 + 4.8);

  y2 += 7;

  rack.cables.forEach((cab, idx) => {
    if (y2 > 272) {
      doc.addPage();
      y2 = 20;
    }

    const fromDev = rack.devices.find((d) => d.id === cab.fromDeviceId);
    const fromPort = fromDev?.ports.find((p) => p.id === cab.fromPortId);
    const toDev = rack.devices.find((d) => d.id === cab.toDeviceId);
    const toPort = toDev?.ports.find((p) => p.id === cab.toPortId);

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(12, y2, 186, 7, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(12, y2 + 7, 198, y2 + 7);

    // Color indicator square
    const rgb = COLOR_RGB[cab.color] || [59, 130, 246];
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.rect(13, y2 + 2, 1.5, 3, 'F');

    doc.setFont('courier', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text(cab.label.substring(0, 16), 16, y2 + 4.6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const fromStr = `${fromDev ? `[U${fromDev.uStart}] ${fromDev.name}` : 'N/A'} : ${fromPort?.label || ''}`;
    const toStr = `${toDev ? `[U${toDev.uStart}] ${toDev.name}` : 'N/A'} : ${toPort?.label || ''}`;
    doc.text(fromStr.substring(0, 30), 46, y2 + 4.6);
    doc.text(toStr.substring(0, 30), 100, y2 + 4.6);

    doc.text(`${cab.category} (${cab.color})`, 154, y2 + 4.6);

    doc.setFont('courier', 'normal');
    doc.text(`${cab.vlan.substring(0, 10)} | ${cab.lengthMeters}m`, 178, y2 + 4.6);

    y2 += 7;
  });

  // Technical Sign-Off Block
  if (y2 < 245) {
    y2 += 12;
    doc.setDrawColor(203, 213, 225);
    doc.rect(12, y2, 88, 24);
    doc.rect(110, y2, 88, 24);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('ELABORADO POR (ADMINISTRADOR DE RED):', 15, y2 + 6);
    doc.text('VALIDACIÓN Y AUDITORÍA DE PLANTA:', 113, y2 + 6);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.text('Usuario: administrador (Amrani_LAN)', 15, y2 + 18);
    doc.text(`Fecha de firma: ${dateStr}`, 113, y2 + 18);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Página 2 de 2 — Matriz de Parcheo y Trazabilidad de Latiguillos', 12, 289);
  doc.text('RackMaster DCIM · Ubuntu Server Edition', 155, 289);

  const safeName = `${project.companyName}_${rack.name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  doc.save(`plano_rack_${safeName}.pdf`);
}
