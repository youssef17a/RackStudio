import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  X,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Server,
  Cable,
  HardDrive,
  FolderPlus,
  RefreshCw,
  FileCheck2
} from 'lucide-react';
import { CompanyProject, RackUnit } from '../types';
import {
  exportFullSystemBackup,
  exportSingleProjectBackup,
  exportSingleRackBackup,
  parseProjectBackupJson,
  mergeImportedProjects,
  ParsedBackupResult,
  saveCustomTemplatesToStorage,
  loadSavedCustomTemplates
} from '../utils/projectBackup';

interface ConfigBackupModalProps {
  projects: CompanyProject[];
  currentProject: CompanyProject;
  currentRack: RackUnit;
  onApplyImportedProjects: (
    nextProjects: CompanyProject[],
    targetProjectId: string,
    targetRackId: string
  ) => void;
  onClose: () => void;
}

export const ConfigBackupModal: React.FC<ConfigBackupModalProps> = ({
  projects,
  currentProject,
  currentRack,
  onApplyImportedProjects,
  onClose
}) => {
  const [activeMode, setActiveMode] = useState<'export' | 'import'>('export');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [parsedBackup, setParsedBackup] = useState<ParsedBackupResult | null>(null);
  const [importStrategy, setImportStrategy] = useState<'merge' | 'replace'>('merge');
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalRacksCount = projects.reduce((acc, p) => acc + p.racks.length, 0);
  const totalDevicesCount = projects.reduce(
    (acc, p) => acc + p.racks.reduce((rAcc, r) => rAcc + r.devices.length, 0),
    0
  );
  const totalCablesCount = projects.reduce(
    (acc, p) => acc + p.racks.reduce((rAcc, r) => rAcc + r.cables.length, 0),
    0
  );

  const showSuccess = (msg: string) => {
    setErrorMessage(null);
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 5000);
  };

  const handleFileObject = (file: File) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setSelectedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content !== 'string') {
        setErrorMessage('No se pudo leer el contenido del archivo.');
        setParsedBackup(null);
        return;
      }
      const result = parseProjectBackupJson(content);
      if (!result.valid) {
        setErrorMessage(result.error || 'Archivo de configuración inválido.');
        setParsedBackup(null);
      } else {
        setParsedBackup(result);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Error al leer el archivo desde el disco.');
      setParsedBackup(null);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileObject(file);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedBackup || !parsedBackup.valid) return;

    // Also merge any custom hardware templates included in the backup
    if (parsedBackup.customTemplates && parsedBackup.customTemplates.length > 0) {
      const existingCustom = loadSavedCustomTemplates();
      const existingMap = new Map(existingCustom.map((t) => [t.id, t]));
      parsedBackup.customTemplates.forEach((t) => {
        existingMap.set(t.id, t);
      });
      saveCustomTemplatesToStorage(Array.from(existingMap.values()));
    }

    const { nextProjects, targetProjectId, targetRackId } = mergeImportedProjects(
      projects,
      parsedBackup.projects,
      importStrategy
    );

    onApplyImportedProjects(nextProjects, targetProjectId, targetRackId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#0D1322] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-6 py-4 bg-[#111827] border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                Archivo de Configuración y Backups (.rackconfig.json)
              </h2>
              <p className="text-xs text-slate-400">
                Exporte sus proyectos o armarios como copia de seguridad local o impórtelos en cualquier momento.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-6 pt-3 bg-[#111827]/60 border-b border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveMode('export');
              setErrorMessage(null);
            }}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeMode === 'export'
                ? 'border-blue-500 text-white bg-slate-900/90'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>Exportar / Guardar Backup</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('import');
              setStatusMessage(null);
            }}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeMode === 'import'
                ? 'border-emerald-500 text-white bg-slate-900/90'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Importar / Restaurar Archivo</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {statusMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeMode === 'export' ? (
            <div className="space-y-4">
              <p className="text-slate-300 leading-relaxed">
                Seleccione qué nivel de configuración desea descargar a su equipo. Los archivos generados incluyen
                todos los dispositivos, posiciones de puertos personalizadas, nombres de bocas, latiguillos y medidas
                del armario.
              </p>

              {/* Option 1: Export Current Project */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <span className="font-display font-bold text-sm text-white">
                      1. Exportar Proyecto Actual ({currentProject.companyName})
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Guarda el proyecto <strong>{currentProject.projectName}</strong> con sus{' '}
                    <strong>{currentProject.racks.length} armarios</strong>, dispositivos y cableado completo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    exportSingleProjectBackup(currentProject);
                    showSuccess(
                      `Archivo de configuración del proyecto "${currentProject.companyName}" descargado correctamente.`
                    );
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Proyecto</span>
                </button>
              </div>

              {/* Option 2: Export Current Rack Only */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400" />
                    <span className="font-display font-bold text-sm text-white">
                      2. Exportar Solo Este Armario ({currentRack.name})
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Guarda únicamente el armario activo (<strong>{currentRack.totalU}U</strong> ·{' '}
                    <strong>{currentRack.devices.length} equipos</strong> ·{' '}
                    <strong>{currentRack.cables.length} latiguillos</strong>) para compartirlo o clonarlo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    exportSingleRackBackup(currentProject, currentRack);
                    showSuccess(
                      `Archivo de configuración del armario "${currentRack.name}" descargado correctamente.`
                    );
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Rack ({currentRack.totalU}U)</span>
                </button>
              </div>

              {/* Option 3: Export Complete System Backup (All Companies & Racks) */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-blue-950/30 to-slate-900 border border-blue-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    <span className="font-display font-bold text-sm text-white">
                      3. Backup Completo del Servidor (Todas las Empresas)
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Copia de seguridad integral con las <strong>{projects.length} empresas</strong>,{' '}
                    <strong>{totalRacksCount} racks</strong>, <strong>{totalDevicesCount} equipos</strong> y{' '}
                    <strong>{totalCablesCount} conexiones</strong>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    exportFullSystemBackup(projects);
                    showSuccess(
                      'Copia de seguridad completa de todos los proyectos descargada correctamente.'
                    );
                  }}
                  className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Backup Completo (.json)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.rackconfig.json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Drag and Drop / Click Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  const droppedFile = e.dataTransfer.files?.[0];
                  if (droppedFile) {
                    handleFileObject(droppedFile);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                  isDraggingOver
                    ? 'border-emerald-400 bg-emerald-950/30'
                    : 'border-slate-700 hover:border-blue-500 bg-slate-900/60 hover:bg-slate-900'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-display font-bold text-sm text-white">
                    {selectedFileName
                      ? `Archivo cargado: ${selectedFileName}`
                      : 'Haga clic aquí o arrastre su archivo .rackconfig.json / .json'}
                  </div>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Compatible con backups de un rack individual, un proyecto de empresa o copias completas del servidor.
                  </p>
                </div>
                <span className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 font-medium text-xs">
                  Seleccionar Archivo de Configuración...
                </span>
              </div>

              {/* Preview of Parsed Backup File */}
              {parsedBackup && parsedBackup.valid && (
                <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/50 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-display font-bold text-sm text-white">
                        Archivo Verificado y Listo para Importar
                      </span>
                    </div>
                    {parsedBackup.exportedAt && (
                      <span className="font-mono text-[11px] text-slate-400">
                        Exportado: {new Date(parsedBackup.exportedAt).toLocaleString('es-ES')}
                      </span>
                    )}
                  </div>

                  {/* Summary Counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Proyectos en archivo</div>
                      <div className="font-mono text-base font-bold text-white">
                        {parsedBackup.summary.projectCount}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Armarios Rack</div>
                      <div className="font-mono text-base font-bold text-emerald-400">
                        {parsedBackup.summary.rackCount}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Equipos Instalados</div>
                      <div className="font-mono text-base font-bold text-blue-400">
                        {parsedBackup.summary.deviceCount}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Cables / Parcheos</div>
                      <div className="font-mono text-base font-bold text-amber-400">
                        {parsedBackup.summary.cableCount}
                      </div>
                    </div>
                  </div>

                  {/* Included Projects List */}
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {parsedBackup.projects.map((p) => (
                      <div
                        key={p.id}
                        className="px-3 py-2 rounded-lg bg-slate-950/90 border border-slate-800 flex items-center justify-between text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-blue-400" />
                          <span className="font-bold text-white">{p.companyName}</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-300">{p.projectName}</span>
                        </div>
                        <div className="font-mono text-slate-400 flex items-center gap-2">
                          <span>{p.racks.length} rack(s)</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Cable className="w-3 h-3 text-emerald-400" />
                            {p.racks.reduce((a, r) => a + r.cables.length, 0)} cables
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Import Mode Selector */}
                  <div className="space-y-2 pt-1">
                    <label className="block text-[11px] font-bold text-slate-300">
                      ¿Cómo desea importar este archivo de configuración?
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setImportStrategy('merge')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          importStrategy === 'merge'
                            ? 'bg-blue-950/50 border-blue-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs text-white">
                          <FolderPlus className="w-4 h-4 text-blue-400" />
                          <span>Añadir a mis proyectos actuales (Recomendado)</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Conserva todos sus proyectos actuales y suma el proyecto o backup importado.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImportStrategy('replace')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          importStrategy === 'replace'
                            ? 'bg-amber-950/40 border-amber-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs text-white">
                          <RefreshCw className="w-4 h-4 text-amber-400" />
                          <span>Restaurar y reemplazar todo el servidor</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Sustituye la lista completa de proyectos por el contenido exacto de este backup.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Confirm Import Action */}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setParsedBackup(null);
                        setSelectedFileName(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                    >
                      Cancelar archivo
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>
                        {importStrategy === 'merge'
                          ? 'Importar y Abrir Proyecto'
                          : 'Restaurar Backup Completo'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#111827] border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            Todos los cambios importados se sincronizan automáticamente en el disco de Ubuntu Server.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
