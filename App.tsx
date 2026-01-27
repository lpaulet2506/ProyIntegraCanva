
import React, { useState, useEffect } from 'react';
import { initiateAuth, exchangeToken, runAutofill, checkJobStatus } from './services/canvaService';
import { AuthState, CanvaData, AutofillResult, CanvaCredentials } from './types';
import CanvaForm from './components/CanvaForm';

const App: React.FC = () => {
  const [credentials, setCredentials] = useState<CanvaCredentials>(() => {
    const saved = localStorage.getItem('canva_creds');
    return saved ? JSON.parse(saved) : { clientId: '', clientSecret: '' };
  });

  const [auth, setAuth] = useState<AuthState>({
    accessToken: localStorage.getItem('canva_token'),
    isAuthenticated: !!localStorage.getItem('canva_token'),
    isLoading: false,
    error: null,
  });

  const [jobStatus, setJobStatus] = useState<AutofillResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(!credentials.clientId);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !auth.isAuthenticated) {
      // Limpiamos la URL de inmediato. El 'code' ya está en la variable, no lo necesitamos en la barra.
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      
      if (credentials.clientId && credentials.clientSecret) {
        const handleTokenExchange = async () => {
          setAuth(prev => ({ ...prev, isLoading: true, error: null }));
          try {
            const token = await exchangeToken(code, credentials);
            localStorage.setItem('canva_token', token);
            setAuth({
              accessToken: token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } catch (err: any) {
            console.error("Error al canjear código:", err);
            setAuth(prev => ({ 
              ...prev, 
              isLoading: false, 
              error: `Fallo de vinculación: ${err.message}. Asegúrate de que el Client Secret es el actual y vuelve a intentar la autorización.` 
            }));
          }
        };
        handleTokenExchange();
      } else {
        setAuth(prev => ({ ...prev, error: "Configura tu Client ID y Secret antes de autorizar." }));
      }
    }
  }, [credentials, auth.isAuthenticated]);

  const saveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('canva_creds', JSON.stringify(credentials));
    setShowSettings(false);
    // Al cambiar credenciales, forzamos nueva sesión
    localStorage.removeItem('canva_token');
    setAuth({ accessToken: null, isAuthenticated: false, isLoading: false, error: null });
  };

  const handleCanvaSubmit = async (data: CanvaData) => {
    if (!auth.accessToken) return;
    setProcessing(true);
    setJobStatus(null);
    try {
      const job = await runAutofill(auth.accessToken, data);
      setJobStatus(job);
      if (job.status === 'IN_PROGRESS') {
        const poll = setInterval(async () => {
          try {
            const updatedJob = await checkJobStatus(auth.accessToken!, job.jobId);
            setJobStatus(updatedJob);
            if (updatedJob.status !== 'IN_PROGRESS') {
              clearInterval(poll);
              setProcessing(false);
            }
          } catch (e) {
            clearInterval(poll);
            setProcessing(false);
          }
        }, 3000);
      } else {
        setProcessing(false);
      }
    } catch (err: any) {
      setAuth(prev => ({ ...prev, error: `Error en Canva: ${err.message}` }));
      setProcessing(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('canva_token');
    setAuth({ accessToken: null, isAuthenticated: false, isLoading: false, error: null });
  };

  const currentRedirectUri = window.location.origin.replace(/\/$/, '');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 font-sans">
      <div className="max-w-2xl w-full">
        <header className="text-center mb-10">
          <div className="inline-block p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl shadow-lg mb-6 transform rotate-3">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-2">LPP Integra</h1>
          <p className="text-xl text-slate-500">Automatización de Documentos con Canva</p>
        </header>

        <div className="mb-8">
          <button onClick={() => setShowSettings(!showSettings)} className="flex items-center space-x-2 text-slate-500 hover:text-blue-600 transition-colors mb-4 text-sm font-bold uppercase tracking-wider">
            <svg className={`w-4 h-4 transform transition-transform ${showSettings ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span>Configuración de API {credentials.clientId ? '✅' : '❌'}</span>
          </button>
          {showSettings && (
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100 mb-8 animate-in slide-in-from-top duration-300">
              <h3 className="font-bold text-slate-800 mb-4 text-sm">Ingresa tus credenciales de Canva Developers</h3>
              <form onSubmit={saveCredentials} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-1">CLIENT ID</label>
                  <input type="text" value={credentials.clientId} onChange={e => setCredentials({...credentials, clientId: e.target.value.trim()})} placeholder="OC-..." className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-1">CLIENT SECRET</label>
                  <input type="password" value={credentials.clientSecret} onChange={e => setCredentials({...credentials, clientSecret: e.target.value.trim()})} placeholder="••••••••••••" className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <button type="submit" className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all">Guardar y Reiniciar</button>
              </form>
            </div>
          )}
        </div>

        {auth.error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-xl shadow-sm">
            <p className="font-bold text-sm">Atención:</p>
            <p className="text-xs">{auth.error}</p>
          </div>
        )}

        {auth.isLoading ? (
          <div className="bg-white p-12 rounded-3xl shadow-2xl text-center">
            <div className="flex justify-center mb-4">
              <svg className="animate-spin h-10 w-10 text-blue-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800">Vinculando...</h3>
            <p className="text-sm text-slate-400 mt-2">Estamos validando el acceso con Canva.</p>
          </div>
        ) : !auth.isAuthenticated ? (
          <div className="bg-white p-10 rounded-3xl shadow-2xl text-center border border-slate-100">
            <h3 className="text-2xl font-bold mb-4 text-slate-800">Conectar con Canva</h3>
            <p className="text-sm text-slate-500 mb-8">Haz clic abajo para autorizar la aplicación en tu cuenta de Canva.</p>
            <button 
              onClick={() => initiateAuth(credentials)} 
              disabled={!credentials.clientId || !credentials.clientSecret} 
              className={`w-full py-4 text-lg font-bold rounded-2xl text-white shadow-xl transition-all ${(!credentials.clientId || !credentials.clientSecret) ? 'bg-slate-300' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
            >
              Autorizar Aplicación
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Sesión Activa</span>
              </div>
              <button onClick={logout} className="text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest">Cerrar Sesión</button>
            </div>
            <CanvaForm onSubmit={handleCanvaSubmit} isLoading={processing} />
            {jobStatus && (
              <div className={`p-8 rounded-3xl border-2 shadow-xl animate-in zoom-in duration-300 ${jobStatus.status === 'COMPLETED' ? 'bg-green-50 border-green-200 shadow-green-100' : 'bg-blue-50 border-blue-200 shadow-blue-100'}`}>
                <div className="flex items-center space-x-3 mb-4">
                  <div className={`p-2 rounded-lg ${jobStatus.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'} text-white`}>
                    {jobStatus.status === 'COMPLETED' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    )}
                  </div>
                  <h4 className="font-black text-slate-800">Estado: {jobStatus.status === 'COMPLETED' ? '¡Éxito!' : 'Procesando...'}</h4>
                </div>
                {jobStatus.resultUrl && (
                  <a href={jobStatus.resultUrl} target="_blank" rel="noopener noreferrer" className="block w-full text-center py-5 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 shadow-lg shadow-green-200 transition-all hover:-translate-y-1">
                    ABRIR RESULTADO 🚀
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-12 p-6 bg-slate-900 rounded-3xl shadow-2xl">
          <p className="text-[10px] font-black text-blue-400 mb-3 tracking-[0.2em] uppercase">Redirección necesaria en Canva Developers</p>
          <div className="flex items-center space-x-2 bg-black/40 p-2 rounded-xl border border-slate-700">
            <code className="flex-1 px-2 text-[11px] text-blue-200 font-mono overflow-hidden whitespace-nowrap">{currentRedirectUri}</code>
            <button onClick={() => {navigator.clipboard.writeText(currentRedirectUri); setCopied(true); setTimeout(() => setCopied(false), 2000);}} className="text-[10px] font-black py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all uppercase">
              {copied ? 'Listo' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
