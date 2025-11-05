/**
 * Dynamiczna konfiguracja API
 * Automatycznie wykrywa środowisko i ustawia odpowiedni adres backendu
 */

// Funkcja wykrywająca środowisko
const detectEnvironment = () => {
  const hostname = window.location.hostname;

  // Sprawdź czy to localhost lub IP lokalne
  const isLocalhost = hostname === 'localhost' ||
                     hostname === '127.0.0.1' ||
                     hostname.startsWith('192.168.') ||
                     hostname.startsWith('10.') ||
                     hostname.startsWith('172.');

  return {
    isLocalhost,
    hostname,
    port: window.location.port
  };
};

// Konfiguracja dla różnych środowisk
const environments = {
  // Konfiguracja dla sieci lokalnej
  local: {
    // Backend na tej samej maszynie
    apiUrl: 'http://localhost:3002',
    // Alternatywnie możesz ustawić konkretny IP:
    // apiUrl: 'http://192.168.1.100:3002',
  },

  // Konfiguracja dla domeny produkcyjnej
  production: {
    // Twoja domena - ZMIEŃ NA SWOJĄ!
    apiUrl: 'https://twoja-domena.pl/api',
    // Lub z portem: 'https://twoja-domena.pl:3002'
  },

  // Konfiguracja dla VM (automatycznie użyje IP hosta)
  vm: {
    // Jeśli frontend jest na VM, backend może być na hoście
    apiUrl: `http://${window.location.hostname}:3002`,
  }
};

// Funkcja zwracająca odpowiedni URL API
export const getApiUrl = () => {
  // Najpierw sprawdź czy jest zmienna środowiskowa (najwyższy priorytet)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const env = detectEnvironment();

  // Jeśli jest localhost/lokalna sieć
  if (env.isLocalhost) {
    // Sprawdź czy frontend działa na porcie dev (5173) czy production
    if (env.port === '5173' || env.port === '5174') {
      // Tryb developerski - backend na localhost:3002
      return environments.local.apiUrl;
    } else if (env.hostname.startsWith('192.168.') ||
               env.hostname.startsWith('10.')) {
      // VM w sieci lokalnej - użyj tego samego hosta
      return `http://${env.hostname}:3002`;
    }
    return environments.local.apiUrl;
  }

  // W przeciwnym razie użyj konfiguracji produkcyjnej (domena)
  return environments.production.apiUrl;
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
  const env = detectEnvironment();
  return {
    environment: env.isLocalhost ? 'local' : 'production',
    hostname: env.hostname,
    port: env.port,
    apiUrl: API_BASE_URL
  };
};

// Log konfiguracji w trybie development
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:', getEnvironmentInfo());
}

export default {
  API_BASE_URL,
  buildApiUrl,
  getApiUrl,
  getEnvironmentInfo
};
