import React, { useState } from 'react';
import { Server, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { UserRole } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (
    token: string,
    user: { userId: string; username: string; fullName: string; role: UserRole }
  ) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Error de autenticación');
      } else {
        onLoginSuccess(data.token, data.user);
      }
    } catch {
      setError('Error de conexión con el servicio local en Ubuntu Server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col justify-between p-6">
      {/* Top minimal header */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between py-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <Server className="w-5 h-5 text-blue-500" />
          <span className="font-display font-bold text-lg tracking-tight text-white">
            RackMaster DCIM
          </span>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Ubuntu Server 24.04 LTS · Persistencia Local Activa
        </div>
      </div>

      {/* Main Login Split Container */}
      <div className="max-w-4xl w-full mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 border border-slate-800 bg-[#111827] rounded-xl overflow-hidden shadow-2xl">
        {/* Left technical brief */}
        <div className="lg:col-span-6 p-8 bg-[#0D1322] border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between">
          <div>
            <p className="text-xs font-mono text-blue-400 mb-2">
              SISTEMA DE GESTIÓN DE INFRAESTRUCTURA (DCIM)
            </p>
            <h1
              className="font-display text-2xl font-bold text-white tracking-tight mb-4"
              style={{ textWrap: 'balance' }}
            >
              Simulador de Racks y Cableado Estructurado Multi-Empresa
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Plataforma autoalojada para planificar armarios de comunicaciones 19&quot;, instalar firewalls, routers, switches, patch panels y servidores mediante arrastrar y soltar, trazar latiguillos puerto a puerto y exportar documentación técnica en PDF.
            </p>

            <div className="space-y-3 text-xs text-slate-300 border-t border-slate-800/80 pt-5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Proyectos en Servidor:</span>
                <span className="font-mono text-slate-200">./data/rack_projects.json</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Usuarios y Permisos:</span>
                <span className="font-mono text-slate-200">./data/users.json (Scrypt Hash)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Motor de Exportación:</span>
                <span className="font-mono text-slate-200">Planos Vectoriales A4 (PDF)</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
            Acceso restringido a personal técnico y administradores dados de alta en el servidor.
          </div>
        </div>

        {/* Right authentication form */}
        <div className="lg:col-span-6 p-8 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="font-display text-xl font-bold text-white mb-1">
              Iniciar Sesión
            </h2>
            <p className="text-xs text-slate-400">
              Introduzca su nombre de usuario y contraseña de acceso.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nombre de Usuario
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Usuario"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-xs text-red-200">
                {error}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>{loading ? 'Verificando credenciales...' : 'Acceder a RackMaster'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Autenticación verificada contra la base de usuarios alojada en Ubuntu Server.
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between text-xs text-slate-500 py-2">
        <span>RackMaster DCIM · Documentación de Red y Parcheo</span>
        <span className="font-mono">Puerto TCP 3000 · Express + Vite</span>
      </div>
    </div>
  );
};
