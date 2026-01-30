
import React, { useState, useEffect } from 'react';
import { initiateAuth, exchangeToken, runAutofill, checkJobStatus } from './services/canvaService';
import { AuthState, CanvaData, AutofillResult, CanvaCredentials } from './types';
import CanvaForm from './components/CanvaForm';
import { CANVA_CONFIG } from './constants';

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
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline' | null>(null);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setServerStatus('checking');
    try {
      const res = await fetch('/api/health');
      if (res.ok) setServerStatus('online');
      else setServerStatus('offline');
    } catch (e) {
      setServerStatus('offline');
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      setAuth(prev => ({ ...prev, error: `Canva Error: ${error}` }));
      window.history.replaceState({}, document.title, "/");
      return;
    }

    if (code && !auth.isAuthenticated && !auth.isLoading) {
      // Limpiamos la URL inmediatamente para evitar que un refresh intente usar el mismo código
      window.history.replaceState({}, document.title, "/");
      
      const handleTokenExchange = async () => {
        setAuth(prev => ({ ...prev, isLoading: true, error: null }));
        setDebugInfo('Validando conexión con Canva...');
        try {
          const token = await exchangeToken(code, credentials);
          localStorage.setItem('canva_token', token);
          setAuth({
            accessToken: token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          setDebugInfo('¡Conexión lista para usar!');
        } catch (err: any) {
          setAuth(prev => ({ 
            ...prev, 
            isLoading: false, 
            error: err.message 
          }));
          setDebugInfo(`Error en vinculación: ${err.message}`);
        }
      };
      handleTokenExchange();
    }
  }, [credentials, auth.isAuthenticated, auth.isLoading]);

  const handleCanvaSubmit = async (data: CanvaData) => {
    if (!auth.accessToken) return;
    setProcessing(true);
    setJobStatus(null);
    setDebugInfo('Generando documento en Canva...');

    try {
      let result = await runAutofill(auth.accessToken, data);
      setJobStatus(result);

      while (result.status === 'IN_PROGRESS') {
        setDebugInfo(`Procesando diseño... Estado: ${result.status}`);
        await new Promise(r => setTimeout(r, 2500));
        result = await checkJobStatus(auth.accessToken, result.jobId);
        setJobStatus(result);
      }

      if (result.status === 'COMPLETED') {
        setDebugInfo('¡Documento generado correctamente!');
      } else {
        throw new Error('Canva reportó un fallo en la generación.');
      }
    } catch (err: any) {
      setAuth(prev => ({ ...prev, error: err.message }));
      setDebugInfo(`Fallo: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const saveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('canva_creds', JSON.stringify(credentials));
    setShowSettings(false);
    logout();
    setDebugInfo('Credenciales guardadas. Por favor, conecta de nuevo.');
  };

  const logout = () => {
    localStorage.removeItem('canva_token');
    setAuth({ accessToken: null, isAuthenticated: false, isLoading: false, error: null });
    setJobStatus(null);
  };

  const currentRedirectUri = CANVA_CONFIG.REDIRECT_URI;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center py-10 px-4">
      <div className="max-w-xl w-full">
        <header className="text-center mb-8">
          <div className="bg-indigo-600 text-white inline-block px-3 py-1 rounded-md text-[10px] font-bold tracking-widest mb-3 uppercase">LPP Integra</div>
          <h1 className="text-3xl font-black text-slate-900">Canva Automator</h1>
          <p className="text-slate-500 text-sm mt-1">Inyecta datos en tus plantillas automáticamente</p>
        </header>

        {/* GUÍA DE CONFIGURACIÓN - AHORA MÁS VISIBLE */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <button 
              onClick={() => setShowSettings(!showSettings)} 
              className="w-full px-6 py-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <span className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center">
                <svg className="w-4 h-4 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                Configuración de la API
              </span>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${showSettings ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2" /></svg>
            </button>

            {showSettings && (
              <div className="p-6 space-y-6 animate-in slide-in-from-top-2">
                <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
                  <h4 className="text-xs font-black text-amber-800 uppercase mb-2">Paso 1: Configurar en Canva</h4>
                  <p className="text-[11px] text-amber-700 mb-3 leading-relaxed">
                    Ve a tu app en <a href="https://www.canva.com/developers/" target="_blank" className="underline font-bold">Canva Developers</a> y en <b>Redirect URLs</b> agrega exactamente esta dirección:
                  </p>
                  <div className="flex items-center space-x-2">
                    <code className="bg-white border border-amber-200 px-3 py-2 rounded text-[10px] font-mono flex-1 truncate text-amber-900 font-bold">
                      {currentRedirectUri}
                    </code>
                    <button 
                      onClick={() => {navigator.clipboard.writeText(currentRedirectUri); setCopied(true); setTimeout(() => setCopied(false), 2000);}}
                      className={`px-3 py-2 rounded text-[10px] font-bold transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-amber-200 text-amber-800 hover:bg-amber-300'}`}
                    >
                      {copied ? '¡COPIADO!' : 'COPIAR'}
                    </button>
                  </div>
                </div>

                <form onSubmit={saveCredentials} className="space-y-4">
                  <h4 className="text-xs font-black text-slate-700 uppercase">Paso 2: Ingresar Credenciales</h4>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Client ID</label>
                    <input type="text" value={credentials.clientId} onChange={e => setCredentials({...credentials, clientId: e.target.value.trim()})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Pega tu Client ID" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Client Secret</label>
                    <input type="password" value={credentials.clientSecret} onChange={e => setCredentials({...credentials, clientSecret: e.target.value.trim()})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Pega tu Client Secret" required />
                  </div>
                  <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                    Guardar Cambios
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* LOG DE ACTIVIDAD */}
        <div className="mb-6 bg-slate-900 rounded-2xl p-4 shadow-xl border border-slate-800">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actividad del Sistema</span>
            <span className="flex items-center text-[9px] text-slate-600">
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${serverStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
              Proxy: {serverStatus === 'online' ? 'En línea' : 'Desconectado'}
            </span>
          </div>
          <div className="font-mono text-[11px] space-y-1">
            <p className="text-indigo-400 flex">
              <span className="text-slate-600 mr-2">LOG:</span>
              <span>{debugInfo || 'Listo para operar.'}</span>
            </p>
            {auth.error && (
              <p className="text-red-400 flex animate-pulse">
                <span className="text-red-900 mr-2">ERR:</span>
                <span>{auth.error}</span>
              </p>
            )}
          </div>
        </div>

        {!auth.isAuthenticated ? (
          <div className="bg-white p-10 rounded-3xl shadow-xl text-center border border-slate-100">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Requiere Vinculación</h3>
            <p className="text-sm text-slate-500 mb-8">Debes autorizar la aplicación con tu cuenta de Canva para poder editar plantillas.</p>
            <button 
              onClick={() => initiateAuth(credentials)} 
              disabled={!credentials.clientId || auth.isLoading}
              className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all transform active:scale-95 shadow-xl shadow-indigo-100"
            >
              {auth.isLoading ? 'CONECTANDO...' : 'CONECTAR AHORA'}
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Sincronizado con Canva</span>
              </div>
              <button onClick={logout} className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-md transition-colors uppercase">Desvincular</button>
            </div>
            
            <CanvaForm onSubmit={handleCanvaSubmit} isLoading={processing} />
            
            {jobStatus?.resultUrl && (
              <div className="p-6 bg-green-500 rounded-2xl shadow-xl shadow-green-100 text-center transform transition-all hover:scale-105">
                <p className="text-[10px] font-bold text-green-100 uppercase mb-2">¡Diseño creado con éxito!</p>
                <a 
                  href={jobStatus.resultUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center justify-center px-6 py-3 bg-white text-green-600 font-black rounded-xl shadow-sm hover:shadow-md transition-all"
                >
                  ABRIR EN CANVA
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 00-2 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              </div>
            )}
          </div>
        )}

        <footer className="mt-12 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">© 2024 LPP Integra • Canva Connect v1.1</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
