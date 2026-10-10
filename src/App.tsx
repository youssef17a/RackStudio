/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileDown,
  LogOut,
  Building2,
  Server,
  CheckCircle2,
  RefreshCw,
  Users
} from 'lucide-react';
import { CompanyProject, RackUnit, ServerStorageInfo, UserRole } from './types';
import { LoginScreen } from './components/LoginScreen';
import { RackWorkspace } from './components/RackWorkspace';
import { FinalRackConsulta } from './components/FinalRackConsulta';
import { ProjectsManager } from './components/ProjectsManager';
import { PatchMatrixView } from './components/PatchMatrixView';
import { UbuntuDeployGuide } from './components/UbuntuDeployGuide';
import { UsersManagerModal } from './components/UsersManagerModal';
import { exportRackToTechnicalPDF } from './utils/pdfExport';

type ActiveTab = 'simulator' | 'consulta' | 'projects' | 'matrix' | 'ubuntu';

const TOKEN_STORAGE_KEY = 'rackmaster_ubuntu_token';

interface CurrentUserSession {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
}

export default function App() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [currentUser, setCurrentUser] = useState<CurrentUserSession | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [showUsersModal, setShowUsersModal] = useState<boolean>(false);

  const [projects, setProjects] = useState<CompanyProject[]>([]);
  const [serverInfo, setServerInfo] = useState<ServerStorageInfo | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [activeRackId, setActiveRackId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('simulator');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const loadProjectsFromServer = useCallback(async (sessionToken: string) => {
    try {
      const res = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setCurrentUser(null);
        return;
      }
      const data = await res.json();
      if (data.projects && Array.isArray(data.projects)) {
        setProjects(data.projects);
        setServerInfo(data.serverInfo || null);
        if (data.projects.length > 0) {
          setActiveProjectId((prev) => prev || data.projects[0].id);
          setActiveRackId(
            (prev) => prev || data.projects[0].racks[0]?.id || ''
          );
        }
      }
    } catch (err) {
      console.error('Error loading projects from Ubuntu Server:', err);
    }
  }, []);

  useEffect(() => {
    const verifySession = async () => {
      if (!token) {
        setAuthChecking(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/session', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setCurrentUser(null);
        } else {
          const data = await res.json();
          setCurrentUser(data.user);
          await loadProjectsFromServer(token);
        }
      } catch {
        // Keep session attempt
      } finally {
        setAuthChecking(false);
      }
    };
    verifySession();
  }, [token, loadProjectsFromServer]);

  const persistProjectsToUbuntu = async (nextProjects: CompanyProject[]) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ projects: nextProjects })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.serverInfo) {
          setServerInfo(data.serverInfo);
        }
      }
    } catch (err) {
      console.error('Error saving to Ubuntu disk:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoginSuccess = async (
    newToken: string,
    user: CurrentUserSession
  ) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
    setCurrentUser(user);
    await loadProjectsFromServer(newToken);
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {
        // Ignore network errors on logout
      }
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setCurrentUser(null);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#090D16] text-slate-300 flex items-center justify-center font-mono text-sm">
        Iniciando conexión con el servicio local en Ubuntu Server...
      </div>
    );
  }

  if (!token || !currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const currentProject =
    projects.find((p) => p.id === activeProjectId) || projects[0];
  const currentRack =
    currentProject?.racks.find((r) => r.id === activeRackId) ||
    currentProject?.racks[0];

  const handleUpdateCurrentRack = (updatedRack: RackUnit) => {
    if (!currentProject) return;
    const nextProjects = projects.map((proj) =>
      proj.id === currentProject.id
        ? {
            ...proj,
            updatedAt: new Date().toISOString(),
            racks: proj.racks.map((r) =>
              r.id === updatedRack.id ? updatedRack : r
            )
          }
        : proj
    );
    setProjects(nextProjects);
    persistProjectsToUbuntu(nextProjects);
  };

  const handleUpdateAllProjects = (nextProjects: CompanyProject[]) => {
    setProjects(nextProjects);
    persistProjectsToUbuntu(nextProjects);
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col">
      {/* =================================================================== */}
      {/* STRICT 3-ZONE TOP BAR CONTRACT                                      */}
      {/* =================================================================== */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-[#0D1322] border-b border-slate-800">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#simulator"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('simulator');
          }}
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          RackMaster DCIM
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a
            href="#simulator"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('simulator');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'simulator'
                ? 'text-white underline underline-offset-8 decoration-blue-500 decoration-2'
                : 'hover:text-white'
            }`}
          >
            Editor de Rack
          </a>
          <a
            href="#consulta"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('consulta');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'consulta'
                ? 'text-white underline underline-offset-8 decoration-blue-500 decoration-2'
                : 'hover:text-white'
            }`}
          >
            Vista Final Consulta
          </a>
          <a
            href="#projects"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('projects');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'projects'
                ? 'text-white underline underline-offset-8 decoration-blue-500 decoration-2'
                : 'hover:text-white'
            }`}
          >
            Proyectos
          </a>
          <a
            href="#matrix"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('matrix');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'matrix'
                ? 'text-white underline underline-offset-8 decoration-blue-500 decoration-2'
                : 'hover:text-white'
            }`}
          >
            Matriz Parcheo
          </a>
          <a
            href="#ubuntu"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('ubuntu');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'ubuntu'
                ? 'text-white underline underline-offset-8 decoration-blue-500 decoration-2'
                : 'hover:text-white'
            }`}
          >
            Servidor Ubuntu
          </a>
        </nav>

        {/* Zone 3: 1 primary action button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (currentProject && currentRack) {
                exportRackToTechnicalPDF(currentProject, currentRack);
              }
            }}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Exportar PDF Técnico</span>
          </button>
        </div>
      </header>

      {/* =================================================================== */}
      {/* CONTEXTUAL WORKSPACE TOOLBAR (Project / Rack Selector + Users)      */}
      {/* =================================================================== */}
      <div className="bg-[#111827] border-b border-slate-800/90 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-slate-400">Empresa / Proyecto:</span>
            <select
              value={currentProject?.id || ''}
              onChange={(e) => {
                const newProjId = e.target.value;
                const found = projects.find((p) => p.id === newProjId);
                setActiveProjectId(newProjId);
                if (found && found.racks[0]) {
                  setActiveRackId(found.racks[0].id);
                }
              }}
              className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-medium text-white focus:outline-none focus:border-blue-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.companyName} — {p.projectName}
                </option>
              ))}
            </select>
          </div>

          <span className="text-slate-700 hidden sm:inline">/</span>

          <div className="flex items-center gap-2 text-xs">
            <Server className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-400">Armario 19&quot;:</span>
            <select
              value={currentRack?.id || ''}
              onChange={(e) => setActiveRackId(e.target.value)}
              className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-medium text-white focus:outline-none focus:border-blue-500"
            >
              {currentProject?.racks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.totalU}U)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Ubuntu Disk Persistence Status, User Management Button & Logout */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="hidden sm:flex items-center gap-1.5 font-mono">
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                <span className="text-blue-300">Guardando en Ubuntu...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Alojado en Ubuntu Server</span>
              </>
            )}
          </div>

          <span className="text-slate-700 hidden sm:inline">·</span>

          <div className="font-mono text-slate-300">
            Usuario: <strong>{currentUser.username}</strong>
          </div>

          <button
            type="button"
            onClick={() => setShowUsersModal(true)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>
              {currentUser.role === 'admin' ? 'Gestionar Usuarios' : 'Mi Contraseña'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3 h-3" />
            <span>Salir</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MAIN WORKSPACE CONTENT                                              */}
      {/* =================================================================== */}
      <main className="flex-1">
        {activeTab === 'simulator' && currentProject && currentRack && (
          <RackWorkspace
            project={currentProject}
            rack={currentRack}
            onUpdateRack={handleUpdateCurrentRack}
            onExportPDF={() =>
              exportRackToTechnicalPDF(currentProject, currentRack)
            }
          />
        )}

        {activeTab === 'consulta' && currentProject && currentRack && (
          <FinalRackConsulta
            project={currentProject}
            rack={currentRack}
            onExportPDF={() =>
              exportRackToTechnicalPDF(currentProject, currentRack)
            }
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsManager
            projects={projects}
            activeProjectId={currentProject?.id || ''}
            activeRackId={currentRack?.id || ''}
            onSelectProjectRack={(projId, rackId) => {
              setActiveProjectId(projId);
              setActiveRackId(rackId);
              setActiveTab('simulator');
            }}
            onUpdateProjects={handleUpdateAllProjects}
          />
        )}

        {activeTab === 'matrix' && currentProject && currentRack && (
          <PatchMatrixView
            project={currentProject}
            rack={currentRack}
            onExportPDF={() =>
              exportRackToTechnicalPDF(currentProject, currentRack)
            }
          />
        )}

        {activeTab === 'ubuntu' && (
          <UbuntuDeployGuide
            serverInfo={serverInfo}
            onForceSync={() => persistProjectsToUbuntu(projects)}
            isSaving={isSaving}
          />
        )}
      </main>

      {/* Users Management Modal */}
      {showUsersModal && (
        <UsersManagerModal
          token={token}
          currentUserId={currentUser.userId}
          currentUsername={currentUser.username}
          currentUserRole={currentUser.role}
          onClose={() => {
            setShowUsersModal(false);
            loadProjectsFromServer(token);
          }}
        />
      )}
    </div>
  );
}
