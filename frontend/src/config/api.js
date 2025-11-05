/**
 * Dynamiczna konfiguracja API
 * Backend i frontend działają na tym samym IP
 * Frontend automatycznie łączy się z backendem na tym samym adresie IP
 */

const BACKEND_PORT = 3002;

// Funkcja zwracająca odpowiedni URL API
export const getApiUrl = () => {
  // 1. NAJWYŻSZY PRIORYTET: Zmienna środowiskowa (dla specjalnych przypadków)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 2. DOMYŚLNIE: Użyj tego samego IP/hostname co frontend
  const hostname = window.location.hostname;

  // Backend działa ZAWSZE na tym samym IP co frontend, tylko na innym porcie
  return `http://${hostname}:${BACKEND_PORT}`;
};

// Eksportuj finalny URL API
export const API_BASE_URL = getApiUrl();

// Helper do budowania pełnych URL endpointów
export const buildApiUrl = (endpoint) => {
  // Usuń początkowy slash jeśli istnieje
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Eksportuj informacje o środowisku (do debugowania)
export const getEnvironmentInfo = () => {
  const hostname = window.location.hostname;
  const frontendPort = window.location.port;

  return {
    frontend: {
      hostname,
      port: frontendPort,
      url: window.location.href
    },
    backend: {
      hostname,
      port: BACKEND_PORT,
      apiUrl: API_BASE_URL
    },
    note: 'Frontend i backend działają na tym samym IP'
  };
};

// Log konfiguracji w trybie development
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:', getEnvironmentInfo());
  console.log('📡 Backend URL:', API_BASE_URL);
}

export default {
  API_BASE_URL,
  buildApiUrl,
  getApiUrl,
  getEnvironmentInfo
};
