
import React, { useState, useEffect } from 'react';
import { initiateAuth, exchangeToken, runAutofill, checkJobStatus } from './services/canvaService';
import { AuthState, CanvaData, AutofillResult, CanvaCredentials } from './types';
import CanvaForm from './components/CanvaForm';

const App: React.FC = () => {
  // Cargar credenciales guardadas
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

  const currentRedirectUri = window.location.origin.replace(/\/$/, '');

  // Manejar el retorno de OAuth
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !auth.isAuthenticated && credentials.clientId && credentials.clientSecret) {
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
          // Limpiar la URL sin recargar la página
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err: any) {
          console.error("Token exchange failed:", err);
          setAuth(prev => ({ 
            ...prev, 
            isLoading: false, 
            error: `Error de vinculación: ${err.message}. Verifica que el Client Secret sea correcto.` 
          }));
        }
      };
      handleTokenExchange();
    }
  }, [credentials, auth.isAuthenticated]);

  const saveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('canva_creds', JSON.stringify(credentials));
    setShowSettings(false);
    // Si hay un código en la URL pero no estamos autenticados, forzamos un re-render para que el useEffect actúe
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('code')) {
      window.location.reload(); 
    }
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
    setAuth({
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  };

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

        {/* Panel de Configuración de Credenciales */}
        <div className="mb-8">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center space-x-2 text-slate-500 hover:text-blue-600 transition-colors mb-4 text-sm font-bold uppercase tracking-wider"
          >
            <svg className={`w-4 h-4 transform transition-transform ${showSettings ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span>Configuración de API {credentials.clientId ? '✅' : '❌'}</span>
          </button>

          {showSettings && (
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100 mb-8 animate-in slide-in-from-top duration-300">
              <h3 className="font-bold text-slate-800 mb-4">Ingresa tus Credenciales de Canva</h3>
              <form onSubmit={saveCredentials} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client ID</label>
                  <input 
                    type="text" 
                    value={credentials.clientId}
                    onChange={e => setCredentials({...credentials, clientId: e.target.value})}
                    placeholder="OC-..."
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client Secret</label>
                  <input 
                    type="password" 
                    value={credentials.clientSecret}
                    onChange={e => setCredentials({...credentials, clientSecret: e.target.value})}
                    placeholder="cnvca..."
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all">
                  Guardar y Continuar
                </button>
              </form>
            </div>
          )}
        </div>

        {auth.error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-xl shadow-sm">
            <p className="font-bold text-sm">Aviso:</p>
            <p className="text-xs">{auth.error}</p>
          </div>
        )}

        {auth.isLoading ? (
          <div className="bg-white p-12 rounded-3xl shadow-2xl border border-slate-100 text-center animate-pulse">
            <div className="flex justify-center mb-4">
              <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800">Finalizando conexión...</h3>
            <p className="text-slate-500 text-sm">Estamos intercambiando el código de seguridad con Canva.</p>
          </div>
        ) : !auth.isAuthenticated ? (
          <div className="bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 text-center">
            <h3 className="text-2xl font-bold text-slate-800 mb-4">Conectar con Canva</h3>
            <p className="text-slate-500 mb-8 text-sm">Primero ingresa tus credenciales arriba y luego haz clic en el botón.</p>
            
            <button
              onClick={() => initiateAuth(credentials)}
              disabled={!credentials.clientId || !credentials.clientSecret}
              className={`w-full py-4 px-4 text-lg font-bold rounded-2xl text-white transition-all shadow-xl ${
                !credentials.clientId || !credentials.clientSecret 
                ? 'bg-slate-300 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] active:scale-95'
              }`}
            >
              Autorizar Aplicación
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Sincronizado con Canva</span>
              </div>
              <button onClick={logout} className="text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors">Cerrar Sesión</button>
            </div>

            <CanvaForm onSubmit={handleCanvaSubmit} isLoading={processing} />

            {jobStatus && (
              <div className={`p-8 rounded-3xl border-2 transition-all shadow-xl ${
                jobStatus.status === 'FAILED' ? 'bg-red-50 border-red-200' : 
                jobStatus.status === 'COMPLETED' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Estado del Trabajo</h4>
                  <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${
                    jobStatus.status === 'COMPLETED' ? 'bg-green-500 text-white' : 
                    jobStatus.status === 'FAILED' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white animate-pulse'
                  }`}>
                    {jobStatus.status}
                  </span>
                </div>
                
                {jobStatus.status === 'COMPLETED' && jobStatus.resultUrl ? (
                  <div className="text-center">
                    <p className="text-slate-600 mb-6 text-sm italic">¡Plantilla procesada! Se ha creado una copia con tus datos.</p>
                    <a href={jobStatus.resultUrl} target="_blank" rel="noopener noreferrer" className="inline-block w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-2xl shadow-lg transition-transform hover:-translate-y-1">
                      Abrir en Canva 🚀
                    </a>
                  </div>
                ) : jobStatus.status === 'IN_PROGRESS' && (
                  <div className="text-center py-4">
                    <div className="inline-block animate-bounce mb-2">✨</div>
                    <p className="text-blue-700 text-sm font-bold">Generando archivo en Canva...</p>
                  </div>
                )}
                {jobStatus.status === 'FAILED' && (
                  <div className="text-center py-4">
                    <p className="text-red-700 text-sm font-bold">Error al procesar la plantilla.</p>
                    <p className="text-xs text-red-500 mt-2">Asegúrate de que el Template ID sea correcto y que la plantilla sea una "Brand Template".</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* URL Helpers */}
        <div className="mt-12 p-6 bg-slate-900 rounded-2xl shadow-2xl">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-blue-400">Configuración en Canva Developers</p>
          <div className="flex items-center space-x-2 mb-4">
            <code className="flex-1 bg-black/40 p-2.5 rounded-lg text-[11px] font-mono overflow-hidden text-ellipsis whitespace-nowrap border border-slate-700 text-slate-300">
              {currentRedirectUri}
            </code>
            <button 
              onClick={() => {navigator.clipboard.writeText(currentRedirectUri); setCopied(true); setTimeout(() => setCopied(false), 2000);}}
              className={`text-[10px] font-bold py-2 px-4 rounded-lg border transition-all ${copied ? 'bg-green-600 border-green-600 text-white' : 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>
          <p className="text-[10px] leading-relaxed text-slate-500 italic">
            Para que el inicio de sesión funcione, pega esta URL exactamente como aparece arriba en la sección <b>"Authorized redirects"</b> de tu App en el Portal de Canva.
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
