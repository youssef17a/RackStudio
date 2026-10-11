import { CompanyProject, RackUnit, HardwareTemplate } from '../types';

export interface RackConfigBackupEnvelope {
  schema: 'rackmaster-dcim-backup';
  version: '2.0';
  exportedAt: string;
  exportScope: 'all_projects' | 'single_project' | 'single_rack';
  summary: {
    projectCount: number;
    rackCount: number;
    deviceCount: number;
    cableCount: number;
  };
  customTemplates?: HardwareTemplate[];
  projects: CompanyProject[];
}

const CUSTOM_TEMPLATES_STORAGE_KEY = 'rackmaster_custom_templates_v2';

export function loadSavedCustomTemplates(): HardwareTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplatesToStorage(templates: HardwareTemplate[]): void {
  try {
    localStorage.setItem(CUSTOM_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // Ignore localStorage quota issues
  }
}

function sanitizeFileName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function triggerJsonDownload(payload: RackConfigBackupEnvelope, filename: string): void {
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function computeSummary(projects: CompanyProject[]) {
  let rackCount = 0;
  let deviceCount = 0;
  let cableCount = 0;
  for (const proj of projects) {
    const racks = Array.isArray(proj.racks) ? proj.racks : [];
    rackCount += racks.length;
    for (const r of racks) {
      deviceCount += Array.isArray(r.devices) ? r.devices.length : 0;
      cableCount += Array.isArray(r.cables) ? r.cables.length : 0;
    }
  }
  return {
    projectCount: projects.length,
    rackCount,
    deviceCount,
    cableCount
  };
}

/**
 * Export all projects and racks as a full system backup configuration file (.rackconfig.json)
 */
export function exportFullSystemBackup(projects: CompanyProject[]): void {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const customTemplates = loadSavedCustomTemplates();
  const envelope: RackConfigBackupEnvelope = {
    schema: 'rackmaster-dcim-backup',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    exportScope: 'all_projects',
    summary: computeSummary(projects),
    customTemplates,
    projects
  };

  triggerJsonDownload(envelope, `rackmaster-backup-completo-${dateStamp}.rackconfig.json`);
}

/**
 * Export a single company project with all its racks (.rackconfig.json)
 */
export function exportSingleProjectBackup(project: CompanyProject): void {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const slug = sanitizeFileName(`${project.companyName}-${project.projectName}`) || 'proyecto';
  const customTemplates = loadSavedCustomTemplates();
  const envelope: RackConfigBackupEnvelope = {
    schema: 'rackmaster-dcim-backup',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    exportScope: 'single_project',
    summary: computeSummary([project]),
    customTemplates,
    projects: [project]
  };

  triggerJsonDownload(envelope, `proyecto-${slug}-${dateStamp}.rackconfig.json`);
}

/**
 * Export a single rack wrapped inside its company project metadata (.rackconfig.json)
 */
export function exportSingleRackBackup(project: CompanyProject, rack: RackUnit): void {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const slug = sanitizeFileName(`${project.companyName}-${rack.name}`) || 'rack';
  const singleRackProject: CompanyProject = {
    ...project,
    racks: [rack]
  };
  const customTemplates = loadSavedCustomTemplates();
  const envelope: RackConfigBackupEnvelope = {
    schema: 'rackmaster-dcim-backup',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    exportScope: 'single_rack',
    summary: computeSummary([singleRackProject]),
    customTemplates,
    projects: [singleRackProject]
  };

  triggerJsonDownload(envelope, `rack-${slug}-${dateStamp}.rackconfig.json`);
}

export interface ParsedBackupResult {
  valid: boolean;
  error?: string;
  exportedAt?: string;
  exportScope?: 'all_projects' | 'single_project' | 'single_rack';
  projects: CompanyProject[];
  customTemplates: HardwareTemplate[];
  summary: {
    projectCount: number;
    rackCount: number;
    deviceCount: number;
    cableCount: number;
  };
}

function normalizeProject(rawProj: Partial<CompanyProject>, index: number): CompanyProject | null {
  if (!rawProj || typeof rawProj !== 'object') return null;
  const rawRacks = Array.isArray(rawProj.racks) ? rawProj.racks : [];
  if (rawRacks.length === 0) return null;

  const validRacks: RackUnit[] = rawRacks
    .filter((r) => r && typeof r === 'object')
    .map((r, rIdx) => ({
      id: r.id || `rack-imp-${Date.now()}-${rIdx}`,
      name: r.name || `Armario Importado ${rIdx + 1}`,
      locationCode: r.locationCode || `MDF-${rIdx + 1}`,
      totalU: Math.max(4, Math.min(60, Number(r.totalU) || 42)),
      maxPowerWatts: Number(r.maxPowerWatts) || 3500,
      widthMm: r.widthMm || 600,
      depthMm: r.depthMm || 800,
      rackType: r.rackType || 'floor',
      frameColor: r.frameColor || '#0B0F17',
      uNumberingDirection: r.uNumberingDirection || 'bottom-up',
      devices: Array.isArray(r.devices) ? r.devices : [],
      cables: Array.isArray(r.cables) ? r.cables : []
    }));

  if (validRacks.length === 0) return null;

  return {
    id: rawProj.id || `proj-imp-${Date.now()}-${index}`,
    companyName: rawProj.companyName || `Empresa Importada ${index + 1}`,
    projectName: rawProj.projectName || 'Proyecto Restaurado desde Backup',
    siteAddress: rawProj.siteAddress || 'Sala Técnica Principal',
    technicalContact: rawProj.technicalContact || 'administrador@amrani-lan.local',
    updatedAt: rawProj.updatedAt || new Date().toISOString(),
    racks: validRacks
  };
}

/**
 * Parse and validate an imported JSON backup or configuration file
 */
export function parseProjectBackupJson(rawText: string): ParsedBackupResult {
  try {
    const parsed = JSON.parse(rawText);
    let candidateProjects: Partial<CompanyProject>[] = [];
    let customTemplates: HardwareTemplate[] = [];
    let exportedAt: string | undefined;
    let exportScope: 'all_projects' | 'single_project' | 'single_rack' | undefined;

    if (Array.isArray(parsed)) {
      // Raw array of CompanyProject[]
      candidateProjects = parsed;
      exportScope = 'all_projects';
    } else if (parsed && typeof parsed === 'object') {
      exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : undefined;
      exportScope = parsed.exportScope;
      if (Array.isArray(parsed.customTemplates)) {
        customTemplates = parsed.customTemplates;
      }

      if (Array.isArray(parsed.projects)) {
        candidateProjects = parsed.projects;
      } else if (parsed.project && typeof parsed.project === 'object') {
        candidateProjects = [parsed.project];
      } else if (Array.isArray(parsed.racks) && parsed.companyName) {
        // Direct single CompanyProject object
        candidateProjects = [parsed];
      } else if (Array.isArray(parsed.devices) && Array.isArray(parsed.cables) && parsed.totalU) {
        // Direct single RackUnit object
        candidateProjects = [
          {
            id: `proj-imp-${Date.now()}`,
            companyName: 'Proyecto Importado',
            projectName: parsed.name || 'Rack Importado',
            siteAddress: parsed.locationCode || 'Sala Técnica',
            technicalContact: 'administrador@amrani-lan.local',
            updatedAt: new Date().toISOString(),
            racks: [parsed as RackUnit]
          }
        ];
      }
    }

    const validProjects = candidateProjects
      .map((p, idx) => normalizeProject(p, idx))
      .filter((p): p is CompanyProject => p !== null);

    if (validProjects.length === 0) {
      return {
        valid: false,
        error:
          'El archivo seleccionado no contiene proyectos ni armarios válidos de RackMaster DCIM.',
        projects: [],
        customTemplates: [],
        summary: { projectCount: 0, rackCount: 0, deviceCount: 0, cableCount: 0 }
      };
    }

    return {
      valid: true,
      exportedAt,
      exportScope: exportScope || (validProjects.length > 1 ? 'all_projects' : 'single_project'),
      projects: validProjects,
      customTemplates,
      summary: computeSummary(validProjects)
    };
  } catch (err) {
    return {
      valid: false,
      error: `Archivo JSON inválido o corrupto: ${err instanceof Error ? err.message : 'Error de formato'}`,
      projects: [],
      customTemplates: [],
      summary: { projectCount: 0, rackCount: 0, deviceCount: 0, cableCount: 0 }
    };
  }
}

/**
 * Merge imported projects into existing projects (creating safe new IDs if chosen, or updating existing IDs)
 */
export function mergeImportedProjects(
  existingProjects: CompanyProject[],
  importedProjects: CompanyProject[],
  mode: 'merge' | 'replace'
): { nextProjects: CompanyProject[]; targetProjectId: string; targetRackId: string } {
  if (mode === 'replace') {
    const firstProj = importedProjects[0];
    return {
      nextProjects: importedProjects,
      targetProjectId: firstProj.id,
      targetRackId: firstProj.racks[0].id
    };
  }

  // In 'merge' mode: if a project with the exact same ID already exists, we either update its racks or clone with a fresh ID so we never accidentally overwrite work without warning
  const existingIds = new Set(existingProjects.map((p) => p.id));
  const mergedList = [...existingProjects];
  let firstAddedProjId = existingProjects[0]?.id || '';
  let firstAddedRackId = existingProjects[0]?.racks[0]?.id || '';

  importedProjects.forEach((impProj, pIdx) => {
    const hasCollision = existingIds.has(impProj.id);
    const finalProjId = hasCollision
      ? `${impProj.id}-imp-${Date.now().toString().slice(-4)}-${pIdx}`
      : impProj.id;

    const finalProj: CompanyProject = {
      ...impProj,
      id: finalProjId,
      projectName: hasCollision
        ? `${impProj.projectName} (Importado)`
        : impProj.projectName,
      updatedAt: new Date().toISOString()
    };

    mergedList.push(finalProj);
    if (pIdx === 0) {
      firstAddedProjId = finalProj.id;
      firstAddedRackId = finalProj.racks[0].id;
    }
  });

  return {
    nextProjects: mergedList,
    targetProjectId: firstAddedProjId,
    targetRackId: firstAddedRackId
  };
}
