import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  Server,
  Cable,
  FileDown,
  ArrowRight,
  MapPin,
  Mail
} from 'lucide-react';
import { CompanyProject, RackUnit } from '../types';
import { exportRackToTechnicalPDF } from '../utils/pdfExport';

interface ProjectsManagerProps {
  projects: CompanyProject[];
  activeProjectId: string;
  activeRackId: string;
  onSelectProjectRack: (projectId: string, rackId: string) => void;
  onUpdateProjects: (projects: CompanyProject[]) => void;
}

export const ProjectsManager: React.FC<ProjectsManagerProps> = ({
  projects,
  activeProjectId,
  activeRackId,
  onSelectProjectRack,
  onUpdateProjects
}) => {
  const [companyName, setCompanyName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [technicalContact, setTechnicalContact] = useState('administrador@amrani-lan.local');
  const [initialRackName, setInitialRackName] = useState('Rack 01 — MDF Principal');
  const [initialRackU, setInitialRackU] = useState<number>(42);

  // Add extra rack to existing company
  const [newRackCompanyId, setNewRackCompanyId] = useState<string | null>(null);
  const [newRackTitle, setNewRackTitle] = useState('Rack 02 — Distribución');
  const [newRackCode, setNewRackCode] = useState('IDF-PLANTA-02');
  const [newRackSizeU, setNewRackSizeU] = useState<number>(42);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !projectName.trim()) return;

    const newProjId = `proj-${Date.now()}`;
    const newRackId = `rack-${Date.now()}`;

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
          totalU: initialRackU,
          maxPowerWatts: 3500,
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
    const newRack: RackUnit = {
      id: `rack-${Date.now()}`,
      name: newRackTitle.trim() || 'Nuevo Armario 19"',
      locationCode: newRackCode.trim() || 'IDF-02',
      totalU: newRackSizeU,
      maxPowerWatts: 3500,
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Existing Company Projects & Racks List */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Proyectos y Empresas Alojadas en Servidor
              </h2>
              <p className="text-xs text-slate-400">
                Seleccione un armario para abrir su simulador o agregue nuevos racks por cliente.
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

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setNewRackCompanyId(newRackCompanyId === proj.id ? null : proj.id)
                    }
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-400" />
                    <span>Añadir Rack</span>
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

              {/* Inline Add Rack Form */}
              {newRackCompanyId === proj.id && (
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-700 space-y-3">
                  <div className="text-xs font-semibold text-white">
                    Nuevo Armario para {proj.companyName}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      value={newRackTitle}
                      onChange={(e) => setNewRackTitle(e.target.value)}
                      placeholder="Nombre del Rack"
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                    />
                    <input
                      type="text"
                      value={newRackCode}
                      onChange={(e) => setNewRackCode(e.target.value)}
                      placeholder="Código Sala (ej. IDF-02)"
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white"
                    />
                    <select
                      value={newRackSizeU}
                      onChange={(e) => setNewRackSizeU(Number(e.target.value))}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white"
                    >
                      <option value={42}>Armario 42U Estándar</option>
                      <option value={24}>Armario 24U Mural/Medio</option>
                      <option value={48}>Armario 48U Alta Densidad</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
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
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Crear y Abrir Armario
                    </button>
                  </div>
                </div>
              )}

              {/* Racks inside this Company */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {proj.racks.map((r) => {
                  const isCurrent =
                    proj.id === activeProjectId && r.id === activeRackId;
                  const usedU = r.devices.reduce((acc, d) => acc + d.uSize, 0);

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
                            {r.locationCode}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 font-mono tabular-nums">
                          <span className="flex items-center gap-1">
                            <Server className="w-3.5 h-3.5 text-slate-500" />
                            {r.devices.length} equipos ({usedU}/{r.totalU}U)
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Cable className="w-3.5 h-3.5 text-slate-500" />
                            {r.cables.length} cables
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
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
            Cree un nuevo proyecto independiente con su propio armario de comunicaciones.
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

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Primer Rack
                </label>
                <input
                  type="text"
                  value={initialRackName}
                  onChange={(e) => setInitialRackName(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Altura en U
                </label>
                <select
                  value={initialRackU}
                  onChange={(e) => setInitialRackU(Number(e.target.value))}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                >
                  <option value={42}>42U (Estándar)</option>
                  <option value={24}>24U (Mural)</option>
                  <option value={48}>48U ( datacenter)</option>
                </select>
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
              <span>Crear Proyecto en Ubuntu Server</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
