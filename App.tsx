
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
      setAuth(prev => ({ ...prev, error: `Canva: ${error}` }));
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      return;
    }

    if (code && !auth.isAuthenticated) {
      // Limpiar URL inmediatamente para evitar dobles peticiones
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      
      const handleTokenExchange = async () => {
        setAuth(prev => ({ ...prev, isLoading: true, error: null }));
        setDebugInfo('Intercambiando código por token (Modo n8n)...');
        try {
          const token = await exchangeToken(code, credentials);
          localStorage.setItem('canva_token', token);
          setAuth({
            accessToken: token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          setDebugInfo('¡Conexión establecida!');
        } catch (err: any) {
          setAuth(prev => ({ 
            ...prev, 
            isLoading: false, 
            error: `Error de Token: ${err.message}` 
          }));
          setDebugInfo(`Fallo: ${err.message}`);
        }
      };
      handleTokenExchange();
    }
  }, [credentials, auth.isAuthenticated]);

  const handleCanvaSubmit = async (data: CanvaData) => {
    if (!auth.accessToken) return;
    setProcessing(true);
    setJobStatus(null);
    setDebugInfo('Enviando datos a Canva...');

    try {
      let result = await runAutofill(auth.accessToken, data);
      setJobStatus(result);

      while (result.status === 'IN_PROGRESS') {
        setDebugInfo(`Canva está trabajando... (${result.status})`);
        await new Promise(r => setTimeout(r, 2000));
        result = await checkJobStatus(auth.accessToken, result.jobId);
        setJobStatus(result);
      }

      if (result.status === 'COMPLETED') {
        setDebugInfo('¡Proceso completado con éxito!');
      } else {
        throw new Error('Canva no pudo generar el diseño.');
      }
    } catch (err: any) {
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
    logout();
  };

  const logout = () => {
    localStorage.removeItem('canva_token');
    setAuth({ accessToken: null, isAuthenticated: false, isLoading: false, error: null });
    setDebugInfo('');
    setJobStatus(null);
  };

  const currentRedirectUri = window.location.origin.replace(/\/$/, '');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4 font-sans">
      <div className="max-w-xl w-full">
        <header className="text-center mb-8">
          <div className="bg-blue-600 text-white inline-block px-4 py-1 rounded-full text-[10px] font-black tracking-widest mb-2 uppercase">LPP Integra</div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Canva Automator</h1>
          
          <div className="mt-4 flex justify-center">
            <button onClick={checkHealth} className="text-[10px] font-bold px-3 py-1 rounded-full border bg-white flex items-center space-x-2">
              <span className={`w-1.5 h-1.5 rounded-full ${serverStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-slate-500 uppercase">Servidor Proxy: {serverStatus || '...'}</span>
            </button>
          </div>
        </header>

        {/* Debug Log */}
        <div className="mb-6 bg-slate-900 p-4 rounded-xl font-mono text-[10px] text-blue-400 border border-slate-800 shadow-lg">
          <div className="flex justify-between border-b border-slate-800 pb-2 mb-2">
            <span className="text-slate-500 font-bold uppercase tracking-widest">Estado de Integración</span>
            <span className="text-slate-700">v1.0.2</span>
          </div>
          <p className="flex items-start">
            <span className="mr-2 text-slate-600">INF:</span> 
            <span>{debugInfo || 'Esperando acción...'}</span>
          </p>
          {auth.error && (
            <p className="mt-1 flex items-start text-red-400">
              <span className="mr-2 opacity-50">ERR:</span> 
              <span>{auth.error}</span>
            </p>
          )}
        </div>

        <div className="mb-6">
          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className="w-full flex justify-between items-center px-4 py-2 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
          >
            <span className="flex items-center uppercase tracking-tight">
              <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
              Configuración de Credenciales
            </span>
            <svg className={`w-3 h-3 transform transition-transform ${showSettings ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
          </button>
          
          {showSettings && (
            <div className="mt-2 bg-white p-6 rounded-xl shadow-xl border border-blue-100 space-y-4 animate-in slide-in-from-top-2">
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 mb-4">
                <p className="text-[10px] text-yellow-800 font-bold uppercase mb-1">Guía Importante (Modo n8n):</p>
                <ol className="text-[10px] text-yellow-700 space-y-1 list-decimal ml-3">
                  <li>Crea una app en <a href="https://www.canva.com/developers/" target="_blank" className="underline">Canva Dev Portal</a>.</li>
                  <li>Copia el <b>Client ID</b> y <b>Client Secret</b> abajo.</li>
                  <li>Agrega esta URL exacta en <b>Redirect URLs</b> de Canva:</li>
                </ol>
                <div className="mt-2 flex space-x-1">
                  <code className="bg-white px-2 py-1 rounded text-[9px] font-mono flex-1 truncate">{currentRedirectUri}</code>
                  <button onClick={() => {navigator.clipboard.writeText(currentRedirectUri); setCopied(true); setTimeout(() => setCopied(false), 2000);}} className="text-[9px] bg-yellow-200 px-2 py-1 rounded font-bold">{copied ? 'COPIADO' : 'COPIAR'}</button>
                </div>
              </div>

              <form onSubmit={saveCredentials} className="space-y-3">
                <input type="text" placeholder="Client ID" value={credentials.clientId} onChange={e => setCredentials({...credentials, clientId: e.target.value.trim()})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" required />
                <input type="password" placeholder="Client Secret" value={credentials.clientSecret} onChange={e => setCredentials({...credentials, clientSecret: e.target.value.trim()})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" required />
                <button type="submit" className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg text-xs hover:bg-blue-700 transition-colors">Guardar y Reconectar</button>
              </form>
            </div>
          )}
        </div>

        {auth.isLoading ? (
          <div className="bg-white p-12 rounded-3xl shadow-xl text-center border border-slate-100">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-bold text-slate-600 animate-pulse">Sincronizando con Canva...</p>
          </div>
        ) : !auth.isAuthenticated ? (
          <div className="bg-white p-10 rounded-3xl shadow-2xl text-center border border-slate-100">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" strokeWidth="2" strokeLinecap="round" /></svg>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Conexión Requerida</h3>
            <p className="text-sm text-slate-500 mb-8">Debes autorizar esta aplicación en tu cuenta de Canva para poder inyectar datos en tus plantillas.</p>
            <button 
              onClick={() => initiateAuth(credentials)} 
              disabled={!credentials.clientId || !credentials.clientSecret}
              className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 transition-all"
            >
              CONECTAR CON CANVA
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-white px-5 py-2.5 rounded-xl shadow-sm border border-slate-100">
              <span className="text-[10px] font-black text-green-600 flex items-center uppercase tracking-widest">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                Conectado
              </span>
              <button onClick={logout} className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase">Desconectar</button>
            </div>
            
            <CanvaForm onSubmit={handleCanvaSubmit} isLoading={processing} />
            
            {jobStatus?.resultUrl && (
              <div className="p-4 bg-green-600 rounded-2xl shadow-2xl shadow-green-200 animate-bounce-short">
                <a 
                  href={jobStatus.resultUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex flex-col items-center justify-center text-white space-y-1"
                >
                  <span className="text-[10px] font-black opacity-80 uppercase tracking-tighter">¡Éxito! Diseño Generado</span>
                  <span className="text-lg font-black">ABRIR EN CANVA →</span>
                </a>
              </div>
            )}
          </div>
        )}

        <footer className="mt-12 text-center text-slate-400 text-[10px] font-medium">
          <p>© 2024 LPP Integra. Integración vía Canva Connect API v1.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
