import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  KeyRound,
  Shield,
  Wrench,
  Check,
  X
} from 'lucide-react';
import { SystemUser, UserRole } from '../types';

interface UsersManagerModalProps {
  token: string;
  currentUserId: string;
  currentUsername: string;
  currentUserRole: UserRole;
  onClose: () => void;
}

export const UsersManagerModal: React.FC<UsersManagerModalProps> = ({
  token,
  currentUserId,
  currentUsername,
  currentUserRole,
  onClose
}) => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Create new user state
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('technician');

  // Change password state
  const [passwordTargetId, setPasswordTargetId] = useState<string | null>(null);
  const [updatedPassword, setUpdatedPassword] = useState('');

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => {
      setNotice((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const fetchUsers = useCallback(async () => {
    if (currentUserRole !== 'admin') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo cargar la lista de usuarios.');
      } else {
        setUsers(data.users || []);
      }
    } catch {
      setError('Error de red al consultar usuarios del servidor Ubuntu.');
    } finally {
      setLoading(false);
    }
  }, [token, currentUserRole]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          fullName: newFullName.trim() || newUsername.trim(),
          password: newPassword,
          role: newRole
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al crear el usuario.');
      } else {
        setNewUsername('');
        setNewFullName('');
        setNewPassword('');
        setNewRole('technician');
        showTempNotice(`Usuario "${data.user.username}" creado y guardado en Ubuntu Server.`);
        fetchUsers();
      }
    } catch {
      setError('Error al conectar con el servidor.');
    }
  };

  const handleChangePassword = async (targetUserId: string, targetName: string) => {
    setError(null);
    if (!updatedPassword || updatedPassword.length < 4) {
      setError('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }
    try {
      const res = await fetch(`/api/users/${targetUserId}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: updatedPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo actualizar la contraseña.');
      } else {
        setPasswordTargetId(null);
        setUpdatedPassword('');
        showTempNotice(`Contraseña actualizada para el usuario "${targetName}".`);
      }
    } catch {
      setError('Error de conexión al actualizar la contraseña.');
    }
  };

  const handleDeleteUser = async (targetUser: SystemUser) => {
    setError(null);
    try {
      const res = await fetch(`/api/users/${targetUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo eliminar el usuario.');
      } else {
        showTempNotice(`Usuario "${targetUser.username}" eliminado del servidor.`);
        fetchUsers();
      }
    } catch {
      setError('Error de conexión al eliminar el usuario.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#111827] border border-slate-700 rounded-xl max-w-4xl w-full overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#0D1322] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="font-display text-base font-bold text-white">
                Gestión de Usuarios y Contraseñas en Ubuntu Server
              </h2>
              <p className="text-xs text-slate-400">
                Sesión actual: <span className="font-mono text-slate-200">{currentUsername}</span> · Archivo persistente: <code className="font-mono text-blue-300">./data/users.json</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/70 border border-red-800 text-xs text-red-200">
              {error}
            </div>
          )}

          {notice && (
            <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-800 text-xs text-emerald-200 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {currentUserRole === 'admin' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 7 Cols: Active Users List */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-white">
                    Usuarios con Acceso al Sistema ({users.length})
                  </h3>
                </div>

                {loading ? (
                  <div className="text-xs text-slate-400 py-6 font-mono">
                    Cargando usuarios desde ./data/users.json...
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {users.map((u) => {
                      const isSelf = u.id === currentUserId;
                      const isChangingPass = passwordTargetId === u.id;

                      return (
                        <div
                          key={u.id}
                          className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-white">
                                  {u.username}
                                </span>
                                <span className="text-xs text-slate-400">
                                  · {u.fullName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                                {u.role === 'admin' ? (
                                  <span className="inline-flex items-center gap-1 text-blue-300 font-medium">
                                    <Shield className="w-3 h-3" />
                                    Administrador Total
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
                                    <Wrench className="w-3 h-3" />
                                    Técnico de Red / Rack
                                  </span>
                                )}
                                {isSelf && (
                                  <span className="font-mono text-slate-500">
                                    · (Tu cuenta actual)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setPasswordTargetId(isChangingPass ? null : u.id);
                                  setUpdatedPassword('');
                                }}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <KeyRound className="w-3 h-3 text-amber-400" />
                                <span>Cambiar Clave</span>
                              </button>

                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  title="Quitar acceso a este usuario"
                                  className="px-2.5 py-1 rounded bg-red-950/60 hover:bg-red-900 text-red-200 text-xs flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Quitar</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {isChangingPass && (
                            <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                              <input
                                type="password"
                                autoComplete="new-password"
                                value={updatedPassword}
                                onChange={(e) => setUpdatedPassword(e.target.value)}
                                placeholder={`Nueva contraseña para ${u.username}`}
                                className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleChangePassword(u.id, u.username)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded cursor-pointer whitespace-nowrap shrink-0"
                              >
                                Guardar Clave
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right 5 Cols: Add New User Form */}
              <div className="lg:col-span-5 p-4 rounded-xl bg-[#0D1322] border border-slate-800">
                <h3 className="font-display text-sm font-bold text-white flex items-center gap-2 mb-1">
                  <UserPlus className="w-4 h-4 text-blue-400" />
                  <span>Dar de Alta Nuevo Usuario</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Agregue técnicos de red o administradores adicionales con su propia contraseña.
                </p>

                <form onSubmit={handleCreateUser} className="space-y-3 text-xs" autoComplete="off">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Usuario de Acceso (Login)
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="Ej. tecnico_planta1"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Nombre Completo / Puesto
                    </label>
                    <input
                      type="text"
                      autoComplete="off"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      placeholder="Ej. Carlos Ruiz (Redes LAN)"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Contraseña Inicial
                    </label>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 4 caracteres"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Rol en la Plataforma
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="technician">
                        Técnico (Gestionar Racks, Equipos, Cables y PDF)
                      </option>
                      <option value="admin">
                        Administrador (Control Total + Alta/Baja de Usuarios)
                      </option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 mt-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Agregar Usuario al Servidor</span>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Non-admin technician view: can change their own password */
            <div className="max-w-md mx-auto p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="font-display text-sm font-bold text-white">
                Cambiar Mi Contraseña ({currentUsername})
              </h3>
              <p className="text-xs text-slate-400">
                Como usuario con rol Técnico puede actualizar su propia clave de acceso. Para agregar o quitar otros usuarios, contacte con un Administrador.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={updatedPassword}
                  onChange={(e) => setUpdatedPassword(e.target.value)}
                  placeholder="Nueva contraseña"
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white"
                />
                <button
                  type="button"
                  onClick={() => handleChangePassword(currentUserId, currentUsername)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  Actualizar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
