
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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !auth.isAuthenticated) {
      console.log("Detectado código de autorización:", code);
      // Limpiamos la URL
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
            setDebugInfo('Vinculación exitosa.');
          } catch (err: any) {
            console.error("Error en App.tsx:", err);
            const errMsg = `Fallo de vinculación: ${err.message}`;
            setAuth(prev => ({ ...prev, isLoading: false, error: errMsg }));
            setDebugInfo(`Error: ${err.message}`);
          }
        };
        handleTokenExchange();
      } else {
        setAuth(prev => ({ ...prev, error: "Configura las credenciales primero." }));
      }
    }
  }, [credentials, auth.isAuthenticated]);

  // Fix: Implemented handleCanvaSubmit to orchestrate the autofill process and poll for job completion
  const handleCanvaSubmit = async (data: CanvaData) => {
    if (!auth.accessToken) {
      setAuth(prev => ({ ...prev, error: "No hay token de acceso. Por favor, autoriza la aplicación primero." }));
      return;
    }

    setProcessing(true);
    setJobStatus(null);
    setDebugInfo('Iniciando generación en Canva...');

    try {
      let result = await runAutofill(auth.accessToken, data);
      setJobStatus(result);
      setDebugInfo(`Trabajo iniciado: ${result.jobId}. Procesando...`);

      // Polling to track the progress of the Canva job
      let attempts = 0;
      const maxAttempts = 30; // ~60 seconds timeout
      while (result.status === 'IN_PROGRESS' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        result = await checkJobStatus(auth.accessToken, result.jobId);
        setJobStatus(result);
        setDebugInfo(`Estado: ${result.status} (Intento ${attempts + 1})`);
        attempts++;
      }

      if (result.status === 'COMPLETED') {
        setDebugInfo('¡Éxito! El documento se ha generado correctamente.');
      } else if (result.status === 'FAILED') {
        throw new Error('La generación del diseño falló en Canva.');
      } else if (attempts >= maxAttempts) {
        throw new Error('El proceso de Canva excedió el tiempo de espera.');
      }
    } catch (err: any) {
      console.error("Error en handleCanvaSubmit:", err);
      setAuth(prev => ({ ...prev, error: err.message }));
      setDebugInfo(`Error: ${err.message}`);
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 font-sans">
      <div className="max-w-2xl w-full">
        <header className="text-center mb-10">
          <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-2">LPP Integra</h1>
          <p className="text-xl text-slate-500">Automatización de Documentos con Canva</p>
        </header>

        {/* Panel de Depuración (Sólo visible si hay error o carga) */}
        {(debugInfo || auth.error) && (
          <div className="mb-6 p-4 bg-black rounded-xl border border-slate-700 font-mono text-[10px] text-green-400 overflow-hidden">
            <p className="text-slate-500 border-b border-slate-800 mb-2 pb-1 uppercase font-bold">Consola de Depuración:</p>
            <p>> {debugInfo || 'Esperando acciones...'}</p>
            {auth.error && <p className="text-red-400">> ERROR: {auth.error}</p>}
          </div>
        )}

        <div className="mb-8">
          <button onClick={() => setShowSettings(!showSettings)} className="flex items-center space-x-2 text-slate-500 hover:text-blue-600 transition-colors mb-4 text-sm font-bold uppercase tracking-wider">
            <svg className={`w-4 h-4 transform transition-transform ${showSettings ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span>Configuración {credentials.clientId ? '✅' : '❌'}</span>
          </button>
          {showSettings && (
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100 mb-8 animate-in slide-in-from-top duration-300">
              <form onSubmit={saveCredentials} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400">CLIENT ID</label>
                  <input type="text" value={credentials.clientId} onChange={e => setCredentials({...credentials, clientId: e.target.value.trim()})} placeholder="OC-..." className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400">CLIENT SECRET</label>
                  <input type="password" value={credentials.clientSecret} onChange={e => setCredentials({...credentials, clientSecret: e.target.value.trim()})} placeholder="••••••••••••" className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <button type="submit" className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all">Guardar Cambios</button>
              </form>
            </div>
          )}
        </div>

        {auth.isLoading ? (
          <div className="bg-white p-12 rounded-3xl shadow-2xl text-center">
            <svg className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <h3 className="text-xl font-bold text-slate-800">Vinculando cuenta...</h3>
          </div>
        ) : !auth.isAuthenticated ? (
          <div className="bg-white p-10 rounded-3xl shadow-2xl text-center border border-slate-100">
            <h3 className="text-2xl font-bold mb-4 text-slate-800">Paso 1: Conectar con Canva</h3>
            <p className="text-sm text-slate-500 mb-8">Debes autorizar esta herramienta en tu portal de Canva Developers.</p>
            <button 
              onClick={() => initiateAuth(credentials)} 
              disabled={!credentials.clientId || !credentials.clientSecret} 
              className={`w-full py-4 text-lg font-bold rounded-2xl text-white shadow-xl transition-all ${(!credentials.clientId || !credentials.clientSecret) ? 'bg-slate-300' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
            >
              Autorizar Ahora
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-white px-6 py-3 rounded-xl shadow-sm border border-slate-100">
              <span className="text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                Conectado
              </span>
              <button onClick={logout} className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase">Desconectar</button>
            </div>
            <CanvaForm onSubmit={handleCanvaSubmit} isLoading={processing} />
            {jobStatus && (
              <div className="p-6 bg-white rounded-2xl shadow-xl border-2 border-blue-50">
                <h4 className="font-bold text-slate-800 mb-2">Estado: {jobStatus.status}</h4>
                {jobStatus.resultUrl && (
                  <a href={jobStatus.resultUrl} target="_blank" rel="noopener noreferrer" className="block w-full text-center py-4 bg-blue-600 text-white font-bold rounded-xl">VER EN CANVA</a>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-12 p-6 bg-slate-900 rounded-2xl">
          <p className="text-[9px] font-black text-blue-400 mb-2 uppercase tracking-widest text-center">URL de Redirección para Canva</p>
          <div className="flex items-center space-x-2 bg-black/50 p-2 rounded-lg border border-slate-700">
            <code className="flex-1 px-2 text-[10px] text-blue-200 font-mono truncate">{currentRedirectUri}</code>
            <button onClick={() => {navigator.clipboard.writeText(currentRedirectUri); setCopied(true); setTimeout(() => setCopied(false), 2000);}} className="text-[9px] font-bold py-1.5 px-3 rounded bg-blue-600 text-white">
              {copied ? 'COPIADO' : 'COPIAR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
