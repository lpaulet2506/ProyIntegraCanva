
import React, { useState, useEffect } from 'react';
import { initiateAuth, exchangeToken, runAutofill, checkJobStatus } from './services/canvaService';
import { AuthState, CanvaData, AutofillResult } from './types';
import CanvaForm from './components/CanvaForm';
import { CANVA_CONFIG } from './constants';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({
    accessToken: localStorage.getItem('canva_token'),
    isAuthenticated: !!localStorage.getItem('canva_token'),
    isLoading: false,
    error: null,
  });

  const [jobStatus, setJobStatus] = useState<AutofillResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Normalizamos la URL para el usuario
  const currentRedirectUri = window.location.origin.replace(/\/$/, '');
  const isHttps = window.location.protocol === 'https:';
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !auth.isAuthenticated) {
      const handleTokenExchange = async () => {
        setAuth(prev => ({ ...prev, isLoading: true }));
        try {
          const token = await exchangeToken(code);
          localStorage.setItem('canva_token', token);
          setAuth({
            accessToken: token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err: any) {
          setAuth(prev => ({ ...prev, isLoading: false, error: err.message }));
        }
      };
      handleTokenExchange();
    }
  }, [auth.isAuthenticated]);

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
      setAuth(prev => ({ ...prev, error: `Error: ${err.message}` }));
      setProcessing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentRedirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-block p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl shadow-lg mb-6 transform rotate-3">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-2">LPP Integra</h1>
          <p className="text-xl text-slate-500">Automatización de Documentos con Canva</p>
        </div>

        {/* Security Alert if not HTTPS */}
        {!isHttps && !isLocalhost && (
          <div className="mb-8 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-start space-x-3 text-amber-800 shadow-sm">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <div>
              <p className="font-bold text-sm">Advertencia de Seguridad</p>
              <p className="text-xs mt-1">Canva requiere obligatoriamente que la URL sea <strong>HTTPS</strong>. Si estás en un entorno de desarrollo local, considera usar una herramienta como ngrok para obtener una URL válida.</p>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {auth.error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-xl animate-pulse">
            <p className="font-bold">Error detectado:</p>
            <p className="text-sm">{auth.error}</p>
          </div>
        )}

        {/* Auth / Main Content */}
        {!auth.isAuthenticated ? (
          <div className="bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 text-center">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Vinculación Requerida</h3>
              <p className="text-slate-500">Autoriza a la integración para acceder a tus plantillas de marca.</p>
            </div>
            
            <button
              onClick={initiateAuth}
              disabled={auth.isLoading}
              className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-lg font-bold rounded-2xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-xl"
            >
              {auth.isLoading ? (
                <span className="flex items-center"><svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Conectando...</span>
              ) : (
                'Iniciar Sesión con Canva'
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-between items-center bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                <span className="text-sm font-semibold text-slate-700">Canva Conectado</span>
              </div>
              <button onClick={logout} className="text-xs font-bold text-red-500 hover:text-red-700 uppercase tracking-widest transition-colors">Cerrar Sesión</button>
            </div>

            <CanvaForm onSubmit={handleCanvaSubmit} isLoading={processing} />

            {/* Results Display */}
            {jobStatus && (
              <div className={`p-8 rounded-3xl border-2 transition-all shadow-xl ${
                jobStatus.status === 'FAILED' ? 'bg-red-50 border-red-200' : 
                jobStatus.status === 'COMPLETED' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200 animate-pulse'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Resultado del Proceso</h4>
                  <span className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
                    jobStatus.status === 'COMPLETED' ? 'bg-green-500 text-white' : 
                    jobStatus.status === 'FAILED' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                  }`}>
                    {jobStatus.status}
                  </span>
                </div>
                
                {jobStatus.status === 'COMPLETED' && jobStatus.resultUrl ? (
                  <div className="text-center">
                    <p className="text-slate-600 mb-6 font-medium">¡Éxito! Tu documento personalizado está listo.</p>
                    <a 
                      href={jobStatus.resultUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white text-lg font-bold rounded-2xl shadow-lg transform transition hover:-translate-y-1 active:scale-95"
                    >
                      Ver Diseño en Canva 🚀
                    </a>
                  </div>
                ) : jobStatus.status === 'IN_PROGRESS' ? (
                  <div className="text-center py-4">
                    <p className="text-blue-700 font-bold">Canva está trabajando en tu diseño...</p>
                  </div>
                ) : jobStatus.status === 'FAILED' && (
                  <p className="text-red-600 font-medium">Fallo en el proceso. Revisa IDs y nombres de capas.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Professional Help Guide & URL Display */}
        <div className="mt-16 p-8 bg-slate-800 rounded-3xl text-slate-300 shadow-2xl">
          <div className="mb-8 p-6 bg-slate-900/50 rounded-2xl border border-slate-700">
            <h3 className="text-lg font-bold text-blue-400 mb-2 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              URL para el Portal de Canva
            </h3>
            <p className="text-sm text-slate-400 mb-4">Copia esta URL y pégala en <strong>"Authorized redirects"</strong>:</p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 bg-black/30 p-3 rounded-xl text-blue-300 font-mono text-sm break-all border border-slate-700">
                {currentRedirectUri}
              </code>
              <button 
                onClick={copyToClipboard}
                className={`p-3 rounded-xl transition-all ${copied ? 'bg-green-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
              >
                {copied ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                )}
              </button>
            </div>

            {/* FQDN Troubleshooting Message */}
            <div className="mt-6 p-4 bg-blue-900/30 rounded-xl border border-blue-800/50 text-xs">
              <p className="font-bold text-blue-300 mb-2">¿Ves el error "Must have an FQDN" en Canva?</p>
              <ul className="list-disc ml-4 space-y-1 text-slate-400">
                <li>Asegúrate de incluir <code className="text-blue-200">https://</code> al principio.</li>
                <li>Si estás usando una IP (ej: 127.0.0.1) o solo "localhost", Canva lo rechazará.</li>
                <li>La URL debe tener un formato de dominio real (ej: <code className="text-blue-200">mi-app.preview.sh</code>).</li>
                <li>Asegúrate de que no haya espacios al principio o al final de la URL que pegas.</li>
              </ul>
            </div>
          </div>

          <h3 className="text-xl font-bold text-white mb-6 flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Guía de Configuración
          </h3>
          <div className="grid md:grid-cols-2 gap-8 text-sm">
            <div className="space-y-4">
              <p className="font-bold text-blue-400 border-b border-slate-700 pb-2 uppercase tracking-widest text-xs">En tu Diseño de Canva</p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="bg-slate-700 text-white w-5 h-5 rounded-full flex items-center justify-center mr-2 flex-shrink-0 text-[10px]">1</span>
                  Nombra las capas como: <code className="text-blue-300">nombre</code>, <code className="text-blue-300">monto</code> y <code className="text-blue-300">direccion</code>.
                </li>
                <li className="flex items-start">
                  <span className="bg-slate-700 text-white w-5 h-5 rounded-full flex items-center justify-center mr-2 flex-shrink-0 text-[10px]">2</span>
                  Publica como <strong>Plantilla de Marca</strong>.
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <p className="font-bold text-blue-400 border-b border-slate-700 pb-2 uppercase tracking-widest text-xs">En el Panel de Desarrollador</p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="bg-slate-700 text-white w-5 h-5 rounded-full flex items-center justify-center mr-2 flex-shrink-0 text-[10px]">3</span>
                  Pega la URL de arriba en <strong>Authorized redirects</strong>.
                </li>
                <li className="flex items-start">
                  <span className="bg-slate-700 text-white w-5 h-5 rounded-full flex items-center justify-center mr-2 flex-shrink-0 text-[10px]">4</span>
                  Asegúrate de que la URL guardada sea <strong>HTTPS</strong>.
                </li>
              </ul>
            </div>
          </div>
        </div>

        <footer className="mt-12 text-center text-slate-400 text-xs">
          LPP_integraCanvApp &bull; Cliente ID: {CANVA_CONFIG.CLIENT_ID} &bull; v1.0.3
        </footer>
      </div>
    </div>
  );
};

export default App;
