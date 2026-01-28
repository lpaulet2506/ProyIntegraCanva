
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
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline' | null>(null);

  // Verificar salud del servidor al cargar
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
    const errorDesc = urlParams.get('error_description');

    // Manejo de errores que vienen en la URL (ej: invalid_scope)
    if (error) {
      setAuth(prev => ({ 
        ...prev, 
        isLoading: false,
        error: `Error de Canva: ${error}. ${errorDesc || ''}` 
      }));
      setDebugInfo(`Canva rechazó la petición de autorización: ${error}`);
      // Limpiar la URL para evitar procesar el error múltiples veces
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      return;
    }

    if (code && !auth.isAuthenticated) {
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      
      if (credentials.clientId && credentials.clientSecret) {
        const handleTokenExchange = async () => {
          setAuth(prev => ({ ...prev, isLoading: true, error: null }));
          setDebugInfo('Iniciando intercambio de token...');
          try {
            const token = await exchangeToken(code, credentials);
            localStorage.setItem('canva_token', token);
            setAuth({
              accessToken: token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            setDebugInfo('¡Autenticación completada con éxito!');
          } catch (err: any) {
            console.error("Detalle del error:", err);
            setAuth(prev => ({ 
              ...prev, 
              isLoading: false, 
              error: `Fallo en intercambio: ${err.message}` 
            }));
            setDebugInfo(`Error: ${err.message}`);
          }
        };
        handleTokenExchange();
      }
    }
  }, [credentials, auth.isAuthenticated]);

  const handleCanvaSubmit = async (data: CanvaData) => {
    if (!auth.accessToken) return;
    setProcessing(true);
    setJobStatus(null);
    setDebugInfo('Iniciando proceso de Autofill en Canva...');

    try {
      let result = await runAutofill(auth.accessToken, data);
      setJobStatus(result);
      setDebugInfo(`Trabajo de generación iniciado...`);

      while (result.status === 'IN_PROGRESS') {
        await new Promise(r => setTimeout(r, 2000));
        result = await checkJobStatus(auth.accessToken, result.jobId);
        setJobStatus(result);
        setDebugInfo(`Progreso: ${result.status}`);
      }

      if (result.status === 'COMPLETED') {
        setDebugInfo('¡Documento generado con éxito!');
      } else {
        throw new Error('La generación falló en los servidores de Canva.');
      }

    } catch (err: any) {
      setAuth(prev => ({ ...prev, error: `Error en Autofill: ${err.message}. Asegúrate de que el ID de plantilla sea de una "Plantilla de Marca" (Brand Template) válida.` }));
      setDebugInfo(`Fallo: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const saveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('canva_creds', JSON.stringify(credentials));
    setShowSettings(false);
    localStorage.removeItem('canva_token');
    setAuth({ accessToken: null, isAuthenticated: false, isLoading: false, error: null });
  };

  const logout = () => {
    localStorage.removeItem('canva_token');
    setAuth({ accessToken: null, isAuthenticated: false, isLoading: false, error: null });
    setDebugInfo('');
  };

  const currentRedirectUri = window.location.origin.replace(/\/$/, '');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4 font-sans">
      <div className="max-w-xl w-full">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">LPP Integra</h1>
          <p className="text-slate-500 mt-1">Gestión de Plantillas Canva</p>
          
          <div className="mt-4 flex justify-center">
            <button 
              onClick={checkHealth}
              className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all flex items-center space-x-2 ${
                serverStatus === 'online' ? 'bg-green-50 text-green-700 border-green-200' : 
                serverStatus === 'offline' ? 'bg-red-50 text-red-700 border-red-200' : 
                'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${serverStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span>SERVIDOR: {serverStatus === 'online' ? 'EN LÍNEA' : serverStatus === 'offline' ? 'DESCONECTADO' : 'VERIFICANDO...'}</span>
            </button>
          </div>
        </header>

        {(debugInfo || auth.error) && (
          <div className="mb-6 p-4 bg-slate-900 rounded-xl shadow-inner font-mono text-[10px] text-blue-300">
            <p className="text-slate-500 mb-1 font-bold uppercase tracking-widest border-b border-slate-800 pb-1">Log de Actividad</p>
            <p className="animate-pulse">{'>'} {debugInfo || 'Listo para operar'}</p>
            {auth.error && <p className="text-red-400 mt-1">{'>'} ERROR: {auth.error}</p>}
          </div>
        )}

        <div className="mb-6">
          <button onClick={() => setShowSettings(!showSettings)} className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors flex items-center uppercase tracking-tighter">
            <svg className={`w-3 h-3 mr-1 transform transition-transform ${showSettings ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="3" /></svg>
            Configuración de API
          </button>
          {showSettings && (
            <div className="mt-4 bg-white p-6 rounded-2xl shadow-xl border border-blue-50 animate-in slide-in-from-top-2">
              <form onSubmit={saveCredentials} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 block mb-1">CLIENT ID</label>
                  <input type="text" value={credentials.clientId} onChange={e => setCredentials({...credentials, clientId: e.target.value.trim()})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" required />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 block mb-1">CLIENT SECRET</label>
                  <input type="password" value={credentials.clientSecret} onChange={e => setCredentials({...credentials, clientSecret: e.target.value.trim()})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" required />
                </div>
                <button type="submit" className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-lg text-sm hover:bg-blue-700 transition-colors">Guardar y Reconectar</button>
              </form>
            </div>
          )}
        </div>

        {auth.isLoading ? (
          <div className="bg-white p-12 rounded-3xl shadow-xl text-center border border-slate-100">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-bold text-slate-700">Validando sesión...</p>
          </div>
        ) : !auth.isAuthenticated ? (
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center border border-slate-100">
            <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Acceso Requerido</h3>
            <p className="text-sm text-slate-500 mb-8">Debes autorizar la aplicación para poder generar documentos.</p>
            <button 
              onClick={() => initiateAuth(credentials)} 
              disabled={!credentials.clientId || !credentials.clientSecret}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:bg-slate-200 transition-all"
            >
              Autorizar con Canva
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white px-5 py-3 rounded-xl shadow-sm border border-slate-100">
              <span className="text-[10px] font-bold text-green-600 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                SESIÓN ACTIVA
              </span>
              <button onClick={logout} className="text-[10px] font-bold text-slate-300 hover:text-red-500 uppercase">Cerrar</button>
            </div>
            <CanvaForm onSubmit={handleCanvaSubmit} isLoading={processing} />
            {jobStatus?.resultUrl && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-2xl animate-in zoom-in">
                <a href={jobStatus.resultUrl} target="_blank" rel="noopener noreferrer" className="block w-full text-center py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-all">
                  ¡ABRIR DOCUMENTO! 🎨
                </a>
              </div>
            )}
          </div>
        )}

        <footer className="mt-10 pt-6 border-t border-slate-200">
          <p className="text-[9px] font-black text-slate-400 text-center mb-3 uppercase tracking-widest">Configuración de Redirección</p>
          <div className="flex items-center space-x-2 bg-slate-200/50 p-2 rounded-lg">
            <code className="flex-1 text-[9px] font-mono text-slate-600 truncate px-2">{currentRedirectUri}</code>
            <button onClick={() => {navigator.clipboard.writeText(currentRedirectUri); setCopied(true); setTimeout(() => setCopied(false), 2000);}} className="text-[9px] font-bold py-1.5 px-3 bg-white border border-slate-300 rounded shadow-sm">
              {copied ? 'COPIADO' : 'COPIAR'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
