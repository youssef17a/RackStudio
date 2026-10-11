import React, { useState, useRef } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  Server,
  Cable,
  FileDown,
  ArrowRight,
  MapPin,
  Mail,
  Sliders,
  Download,
  Upload,
  FileJson,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { CompanyProject, RackUnit } from '../types';
import { exportRackToTechnicalPDF } from '../utils/pdfExport';
import {
  exportFullSystemBackup,
  exportSingleProjectBackup,
  exportSingleRackBackup,
  parseProjectBackupJson,
  mergeImportedProjects,
  saveCustomTemplatesToStorage,
  loadSavedCustomTemplates
} from '../utils/projectBackup';

interface ProjectsManagerProps {
  projects: CompanyProject[];
  activeProjectId: string;
  activeRackId: string;
  onSelectProjectRack: (projectId: string, rackId: string) => void;
  onUpdateProjects: (projects: CompanyProject[]) => void;
  onOpenBackupModal?: () => void;
}

const RACK_U_PRESETS = [6, 9, 12, 15, 18, 22, 24, 32, 36, 42, 45, 48, 52];

export const ProjectsManager: React.FC<ProjectsManagerProps> = ({
  projects,
  activeProjectId,
  activeRackId,
  onSelectProjectRack,
  onUpdateProjects,
  onOpenBackupModal
}) => {
  const [companyName, setCompanyName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [technicalContact, setTechnicalContact] = useState('administrador@amrani-lan.local');
  const [initialRackName, setInitialRackName] = useState('Rack 01 — MDF Principal');
  const [initialRackU, setInitialRackU] = useState<number>(42);
  const [initialRackType, setInitialRackType] = useState<'floor' | 'wall' | 'open-frame' | 'custom'>('floor');
  const [initialRackWidth, setInitialRackWidth] = useState<number>(600);
  const [initialRackDepth, setInitialRackDepth] = useState<number>(800);
  const [initialRackPower, setInitialRackPower] = useState<number>(3500);

  // Add extra custom rack to existing company
  const [newRackCompanyId, setNewRackCompanyId] = useState<string | null>(null);
  const [newRackTitle, setNewRackTitle] = useState('Rack 02 — Armario a Medida');
  const [newRackCode, setNewRackCode] = useState('IDF-PLANTA-02');
  const [newRackSizeU, setNewRackSizeU] = useState<number>(24);
  const [newRackType, setNewRackType] = useState<'floor' | 'wall' | 'open-frame' | 'custom'>('wall');
  const [newRackWidthMm, setNewRackWidthMm] = useState<number>(600);
  const [newRackDepthMm, setNewRackDepthMm] = useState<number>(600);
  const [newRackPowerWatts, setNewRackPowerWatts] = useState<number>(3500);
  const [newRackFrameColor, setNewRackFrameColor] = useState<string>('#0B0F17');

  // Quick Import & Export Feedback inside Projects Tab
  const [backupNotice, setBackupNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const quickImportRef = useRef<HTMLInputElement | null>(null);

  const showBackupFeedback = (type: 'success' | 'error', text: string) => {
    setBackupNotice({ type, text });
    setTimeout(() => {
      setBackupNotice((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  const handleQuickImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content !== 'string') return;
      const parsed = parseProjectBackupJson(content);
      if (!parsed.valid) {
        showBackupFeedback(
          'error',
          parsed.error || 'El archivo seleccionado no es un backup válido.'
        );
        return;
      }

      if (parsed.customTemplates && parsed.customTemplates.length > 0) {
        const existingCustom = loadSavedCustomTemplates();
        const existingMap = new Map(existingCustom.map((t) => [t.id, t]));
        parsed.customTemplates.forEach((t) => existingMap.set(t.id, t));
        saveCustomTemplatesToStorage(Array.from(existingMap.values()));
      }

      const { nextProjects, targetProjectId, targetRackId } = mergeImportedProjects(
        projects,
        parsed.projects,
        'merge'
      );
      onUpdateProjects(nextProjects);
      showBackupFeedback(
        'success',
        `Importados ${parsed.summary.projectCount} proyecto(s) con ${parsed.summary.rackCount} armario(s) y ${parsed.summary.cableCount} cables.`
      );
      if (targetProjectId && targetRackId) {
        setTimeout(() => {
          onSelectProjectRack(targetProjectId, targetRackId);
        }, 900);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !projectName.trim()) return;

    const newProjId = `proj-${Date.now()}`;
    const newRackId = `rack-${Date.now()}`;
    const safeU = Math.max(4, Math.min(60, Number(initialRackU) || 42));

    const newProject: CompanyProject = {
      id: newProjId,
      companyName: companyName.trim(),
      projectName: projectName.trim(),
      siteAddress: siteAddress.trim() || 'Sala Técnica Central',
      technicalContact: technicalContact.trim() || 'administrador@amrani-lan.local',
      updatedAt: new Date().toISOString(),
      racks: [
        {
          id: newRackId,
          name: initialRackName.trim() || 'Rack 01 — Principal',
          locationCode: 'MDF-01',
          totalU: safeU,
          maxPowerWatts: Math.max(200, Number(initialRackPower) || 3500),
          widthMm: initialRackWidth,
          depthMm: initialRackDepth,
          rackType: initialRackType,
          frameColor: '#0B0F17',
          devices: [],
          cables: []
        }
      ]
    };

    const next = [...projects, newProject];
    onUpdateProjects(next);
    setCompanyName('');
    setProjectName('');
    setSiteAddress('');
    onSelectProjectRack(newProjId, newRackId);
  };

  const handleAddRackToProject = (projectId: string) => {
    const safeU = Math.max(4, Math.min(60, Number(newRackSizeU) || 24));
    const newRack: RackUnit = {
      id: `rack-${Date.now()}`,
      name: newRackTitle.trim() || 'Nuevo Armario a Medida',
      locationCode: newRackCode.trim() || 'IDF-02',
      totalU: safeU,
      maxPowerWatts: Math.max(200, Number(newRackPowerWatts) || 3500),
      widthMm: newRackWidthMm,
      depthMm: newRackDepthMm,
      rackType: newRackType,
      frameColor: newRackFrameColor,
      devices: [],
      cables: []
    };

    const next = projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            updatedAt: new Date().toISOString(),
            racks: [...p.racks, newRack]
          }
        : p
    );
    onUpdateProjects(next);
    setNewRackCompanyId(null);
    onSelectProjectRack(projectId, newRack.id);
  };

  const handleDeleteProject = (projectId: string) => {
    if (projects.length <= 1) return;
    const next = projects.filter((p) => p.id !== projectId);
    onUpdateProjects(next);
    if (activeProjectId === projectId && next[0]) {
      onSelectProjectRack(next[0].id, next[0].racks[0].id);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Backup & Configuration File Bar */}
      <div className="bg-gradient-to-r from-[#111827] via-blue-950/30 to-[#111827] border border-blue-500/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
            <FileJson className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-white">
              Archivos de Configuración y Copias de Seguridad (Backups .rackconfig.json)
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Exporte cualquier proyecto o armario a un archivo local para guardarlo como backup, o importe un archivo existente para restaurarlo.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={quickImportRef}
            type="file"
            accept=".json,.rackconfig.json,application/json"
            onChange={handleQuickImportFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => quickImportRef.current?.click()}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar Proyecto / Backup (.json)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              exportFullSystemBackup(projects);
              showBackupFeedback(
                'success',
                'Backup completo de todos los proyectos descargado correctamente.'
              );
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Backup Completo</span>
          </button>

          {onOpenBackupModal && (
            <button
              type="button"
              onClick={onOpenBackupModal}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Opciones Avanzadas...
            </button>
          )}
        </div>
      </div>

      {backupNotice && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            backupNotice.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/80 border-red-500/50 text-red-200'
          }`}
        >
          {backupNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{backupNotice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Existing Company Projects & Racks List */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Proyectos y Empresas Alojadas en Servidor
              </h2>
              <p className="text-xs text-slate-400">
                Seleccione un armario para abrir su simulador o cree un Rack a Medida (de 4U a 60U, mural, suelo o bastidor abierto).
              </p>
            </div>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              {projects.length} empresas registradas
            </span>
          </div>

          {projects.map((proj) => (
            <div
              key={proj.id}
              className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <h3 className="font-display text-base font-bold text-white">
                      {proj.companyName}
                    </h3>
                    <span className="text-xs text-slate-500">·</span>
                    <span className="text-xs font-medium text-slate-300">
                      {proj.projectName}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {proj.siteAddress}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      {proj.technicalContact}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      exportSingleProjectBackup(proj);
                      showBackupFeedback(
                        'success',
                        `Proyecto "${proj.companyName}" exportado como archivo de configuración.`
                      );
                    }}
                    title="Descargar archivo de configuración de esta empresa (.rackconfig.json)"
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Exportar Proyecto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setNewRackCompanyId(newRackCompanyId === proj.id ? null : proj.id)
                    }
                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    <span>+ Añadir Rack a Medida</span>
                  </button>
                  {projects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(proj.id)}
                      title="Eliminar proyecto de empresa"
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-300 border border-slate-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Inline Add Custom Rack Form */}
              {newRackCompanyId === proj.id && (
                <div className="p-4 rounded-xl bg-slate-900/95 border border-blue-500/60 space-y-3.5 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-blue-400" />
                      <span>Diseñar Nuevo Rack Personalizado para {proj.companyName}</span>
                    </div>
                    <span className="font-mono text-[11px] text-blue-300">
                      {newRackSizeU}U · {newRackWidthMm}×{newRackDepthMm}mm · {newRackPowerWatts}W
                    </span>
                  </div>

                  {/* Quick U Presets */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Formatos Rápidos de Altura (U) o escriba cualquier medida exacta (4U a 60U):
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {RACK_U_PRESETS.map((uPreset) => (
                        <button
                          key={uPreset}
                          type="button"
                          onClick={() => {
                            setNewRackSizeU(uPreset);
                            if (uPreset <= 18) {
                              setNewRackType('wall');
                              setNewRackDepthMm(450);
                            } else {
                              setNewRackType('floor');
                              setNewRackDepthMm(800);
                            }
                          }}
                          className={`px-2 py-1 rounded font-mono text-[11px] font-bold border transition-colors cursor-pointer ${
                            newRackSizeU === uPreset
                              ? 'bg-blue-600 text-white border-blue-400'
                              : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {uPreset}U
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-slate-400 mb-0.5">
                        Nombre del Armario Rack
                      </label>
                      <input
                        type="text"
                        value={newRackTitle}
                        onChange={(e) => setNewRackTitle(e.target.value)}
                        placeholder="Ej. Rack Mural Planta 1"
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">
                        Código Ubicación
                      </label>
                      <input
                        type="text"
                        value={newRackCode}
                        onChange={(e) => setNewRackCode(e.target.value)}
                        placeholder="Ej. IDF-02"
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">
                        Altura Exacta (U) [4-60]
                      </label>
                      <input
                        type="number"
                        min={4}
                        max={60}
                        value={newRackSizeU}
                        onChange={(e) =>
                          setNewRackSizeU(
                            Math.max(4, Math.min(60, Number(e.target.value) || 12))
                          )
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-blue-500/70 rounded text-xs font-mono font-bold text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">
                        Tipo de Bastidor
                      </label>
                      <select
                        value={newRackType}
                        onChange={(e) =>
                          setNewRackType(
                            e.target.value as 'floor' | 'wall' | 'open-frame' | 'custom'
                          )
                        }
                        className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                      >
                        <option value="floor">Armario Suelo Cerrado</option>
                        <option value="wall">Mural de Pared</option>
                        <option value="open-frame">Bastidor Abierto 2/4 Postes</option>
                        <option value="custom">A Medida Especial</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">
                        Ancho Exterior (mm)
                      </label>
                      <select
                        value={newRackWidthMm}
                        onChange={(e) => setNewRackWidthMm(Number(e.target.value))}
                        className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white"
                      >
                        <option value={600}>600 mm (Estándar 19&quot;)</option>
                        <option value={800}>800 mm (Con Pasacables)</option>
                        <option value={540}>540 mm (Compacto Mural)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">
                        Fondo Exterior (mm)
                      </label>
                      <select
                        value={newRackDepthMm}
                        onChange={(e) => setNewRackDepthMm(Number(e.target.value))}
                        className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white"
                      >
                        <option value={450}>450 mm (Mural Corto)</option>
                        <option value={600}>600 mm (Comunicaciones)</option>
                        <option value={800}>800 mm (Servidores/CPD)</option>
                        <option value={1000}>1000 mm (Gran Fondo)</option>
                        <option value={1200}>1200 mm (Alta Densidad)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">
                        Potencia Máx. (W)
                      </label>
                      <input
                        type="number"
                        min={200}
                        max={25000}
                        step={100}
                        value={newRackPowerWatts}
                        onChange={(e) =>
                          setNewRackPowerWatts(Number(e.target.value) || 3500)
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Color del Armario:</span>
                      {[
                        { hex: '#0B0F17', name: 'Negro Grafito' },
                        { hex: '#1E293B', name: 'Gris Antracita' },
                        { hex: '#172554', name: 'Azul Industrial' },
                        { hex: '#27272A', name: 'Acero Oscuro' }
                      ].map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setNewRackFrameColor(c.hex)}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                          className={`w-5 h-5 rounded border cursor-pointer ${
                            newRackFrameColor === c.hex
                              ? 'border-white ring-2 ring-blue-400'
                              : 'border-slate-600'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setNewRackCompanyId(null)}
                        className="px-3 py-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddRackToProject(proj.id)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Crear y Abrir Rack ({newRackSizeU}U)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Racks inside this Company */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {proj.racks.map((r) => {
                  const isCurrent =
                    proj.id === activeProjectId && r.id === activeRackId;
                  const occupiedUSet = new Set<number>();
                  r.devices.forEach((d) => {
                    for (let u = d.uStart; u < d.uStart + d.uSize; u++) {
                      occupiedUSet.add(u);
                    }
                  });
                  const usedU = occupiedUSet.size;

                  return (
                    <div
                      key={r.id}
                      className={`p-3.5 rounded-lg border flex flex-col justify-between gap-3 transition-colors ${
                        isCurrent
                          ? 'bg-slate-900 border-blue-500/80'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-display font-bold text-sm text-white">
                            {r.name}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {r.locationCode} · {r.totalU}U
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-2 font-mono tabular-nums">
                          <span className="flex items-center gap-1">
                            <Server className="w-3.5 h-3.5 text-slate-500" />
                            {r.devices.length} equipos ({usedU}/{r.totalU}U)
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Cable className="w-3.5 h-3.5 text-slate-500" />
                            {r.cables.length} cables
                          </span>
                          {r.widthMm && r.depthMm && (
                            <>
                              <span>·</span>
                              <span className="text-[11px] text-slate-500">
                                {r.widthMm}×{r.depthMm}mm
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => exportRackToTechnicalPDF(proj, r)}
                            className="text-xs text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <FileDown className="w-3.5 h-3.5 text-blue-400" />
                            <span>PDF Técnico</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              exportSingleRackBackup(proj, r);
                              showBackupFeedback(
                                'success',
                                `Armario "${r.name}" exportado como archivo de configuración.`
                              );
                            }}
                            title="Exportar archivo de configuración de este armario (.rackconfig.json)"
                            className="text-xs text-slate-300 hover:text-emerald-300 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Backup Rack</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSelectProjectRack(proj.id, r.id)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <span>Abrir en Simulador</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right 4 Cols: Create New Company Project Form */}
        <div className="lg:col-span-4 bg-[#111827] border border-slate-800 rounded-xl p-5">
          <h3 className="font-display text-base font-bold text-white mb-1">
            Registrar Nueva Empresa / Proyecto
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Cree un nuevo proyecto independiente con su propio armario de comunicaciones a medida.
          </p>

          <form onSubmit={handleCreateProject} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Nombre de la Empresa / Cliente
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ej. Grupo Industrial Mediterráneo"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Nombre del Proyecto / Sede
              </label>
              <input
                type="text"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ej. Reforma CPD Planta Principal"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Dirección / Ubicación Técnica
              </label>
              <input
                type="text"
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
                placeholder="Ej. Parque Tecnológico Edificio B"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2.5">
              <div className="font-semibold text-slate-200 flex items-center justify-between">
                <span>Rack Principal a Medida</span>
                <span className="font-mono text-[11px] text-blue-400">{initialRackU}U</span>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Nombre del Armario
                </label>
                <input
                  type="text"
                  value={initialRackName}
                  onChange={(e) => setInitialRackName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Altura en U (elija formato o escriba de 4U a 60U)
                </label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {[6, 9, 12, 18, 24, 36, 42, 48].map((uVal) => (
                    <button
                      key={uVal}
                      type="button"
                      onClick={() => setInitialRackU(uVal)}
                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border cursor-pointer ${
                        initialRackU === uVal
                          ? 'bg-blue-600 text-white border-blue-400'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {uVal}U
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={4}
                    max={60}
                    value={initialRackU}
                    onChange={(e) =>
                      setInitialRackU(
                        Math.max(4, Math.min(60, Number(e.target.value) || 42))
                      )
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono"
                  />
                  <select
                    value={initialRackType}
                    onChange={(e) =>
                      setInitialRackType(
                        e.target.value as 'floor' | 'wall' | 'open-frame' | 'custom'
                      )
                    }
                    className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-[11px]"
                  >
                    <option value="floor">Suelo Cerrado</option>
                    <option value="wall">Mural Pared</option>
                    <option value="open-frame">Bastidor Abierto</option>
                    <option value="custom">A Medida</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">
                    Ancho (mm)
                  </label>
                  <input
                    type="number"
                    value={initialRackWidth}
                    onChange={(e) => setInitialRackWidth(Number(e.target.value) || 600)}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">
                    Fondo (mm)
                  </label>
                  <input
                    type="number"
                    value={initialRackDepth}
                    onChange={(e) => setInitialRackDepth(Number(e.target.value) || 800)}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">
                    Potencia (W)
                  </label>
                  <input
                    type="number"
                    value={initialRackPower}
                    onChange={(e) => setInitialRackPower(Number(e.target.value) || 3500)}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Contacto Técnico Responsable
              </label>
              <input
                type="text"
                value={technicalContact}
                onChange={(e) => setTechnicalContact(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 mt-2"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Proyecto con Rack ({initialRackU}U)</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
