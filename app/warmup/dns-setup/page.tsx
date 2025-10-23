'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DNSSetupInstructions() {
  const [selectedDomain, setSelectedDomain] = useState('kreativia.eu');

  const domains = [
    { name: 'kreativia.eu', subdomain: 'bartgrafic.home.pl' },
    { name: 'kreativia.pl', subdomain: 'bartgrafic.home.pl' }
  ];

  const currentDomain = domains.find(d => d.name === selectedDomain);

  const dnsRecords = [
    {
      name: 'SPF Record',
      type: 'TXT',
      host: '@',
      value: `v=spf1 include:${currentDomain?.subdomain} ~all`,
      description: 'Określa które serwery mogą wysyłać maile w imieniu domeny',
      critical: true
    },
    {
      name: 'DKIM Record',
      type: 'TXT',
      host: 'default._domainkey',
      value: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...',
      description: 'Klucz kryptograficzny do weryfikacji autentyczności maili',
      critical: true,
      note: 'Poproś hosting o wygenerowanie klucza DKIM'
    },
    {
      name: 'DMARC Record',
      type: 'TXT',
      host: '_dmarc',
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${selectedDomain}`,
      description: 'Polityka autentykacji maili - na początku ustaw "none"',
      critical: true
    }
  ];

  const subdomainExamples = [
    { subdomain: 'mail.kreativia.eu', purpose: 'Główna skrzynka mailowa' },
    { subdomain: 'outreach.kreativia.eu', purpose: 'Skrzynka do cold mailingu' },
    { subdomain: 'followup.kreativia.eu', purpose: 'Skrzynka do follow-upów' },
    { subdomain: 'nurture.kreativia.eu', purpose: 'Skrzynka do nurturing' },
    { subdomain: 'prospect.kreativia.eu', purpose: 'Skrzynka do prospektowania' }
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Link href="/warmup" className="text-blue-600 hover:text-blue-800">
            ← Powrót do warmup
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Konfiguracja DNS dla Warmup</h1>
        <p className="text-gray-600 mt-2">
          Instrukcje konfiguracji rekordów DNS wymaganych do prawidłowego rozgrzewania skrzynek mailowych
        </p>
      </div>

      {/* Domain Selector */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Wybierz domenę</h2>
        <div className="flex space-x-4">
          {domains.map((domain) => (
            <button
              key={domain.name}
              onClick={() => setSelectedDomain(domain.name)}
              className={`px-4 py-2 rounded-lg border ${
                selectedDomain === domain.name
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {domain.name}
            </button>
          ))}
        </div>
      </div>

      {/* Critical Warning */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 font-bold">!</span>
            </div>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-semibold text-red-800">KRYTYCZNE (bez tego = spam 100%)</h3>
            <p className="text-red-700 mt-2">
              Bez poprawnej konfiguracji DNS wszystkie maile będą trafiać do spam. 
              To ustawienia które musisz skonfigurować w panelu domeny (np. home.pl) - 5 minut roboty.
            </p>
          </div>
        </div>
      </div>

      {/* DNS Records */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Rekordy DNS dla {selectedDomain}</h2>
        </div>
        
        <div className="p-6">
          {dnsRecords.map((record, index) => (
            <div key={index} className="mb-8 last:mb-0">
              <div className="flex items-center space-x-2 mb-3">
                <h3 className="text-lg font-semibold">{record.name}</h3>
                {record.critical && (
                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                    KRYTYCZNY
                  </span>
                )}
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg mb-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Typ:</span>
                    <div className="mt-1 font-mono bg-white px-2 py-1 rounded border">
                      {record.type}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Host/Nazwa:</span>
                    <div className="mt-1 font-mono bg-white px-2 py-1 rounded border">
                      {record.host}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Wartość:</span>
                    <div className="mt-1 font-mono bg-white px-2 py-1 rounded border break-all">
                      {record.value}
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-gray-600 text-sm mb-2">{record.description}</p>
              
              {record.note && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-yellow-800 text-sm">
                    <strong>Uwaga:</strong> {record.note}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Subdomain Examples */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Przykłady subdomen</h2>
          <p className="text-gray-600 text-sm mt-1">
            Zamiast wariacji nazwiska (b.kosiba@, bkosiba@) lepiej używać subdomen
          </p>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subdomainExamples.map((example, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="font-mono text-blue-600 font-medium">
                  {example.subdomain}
                </div>
                <div className="text-gray-600 text-sm mt-1">
                  {example.purpose}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Zalety subdomen:</h4>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Łatwiejsze zarządzanie DNS</li>
              <li>• Lepsza separacja reputacji</li>
              <li>• Możliwość różnych konfiguracji SMTP</li>
              <li>• Profesjonalniejszy wygląd</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Instrukcje konfiguracji</h2>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <div>
                <h4 className="font-semibold">Zaloguj się do panelu domeny</h4>
                <p className="text-gray-600 text-sm">
                  Przejdź do panelu domeny (np. home.pl) i znajdź sekcję "DNS" lub "Rekordy DNS"
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <div>
                <h4 className="font-semibold">Dodaj rekordy DNS</h4>
                <p className="text-gray-600 text-sm">
                  Skopiuj i wklej każdy rekord z tabeli powyżej. Upewnij się, że wartości są dokładnie takie same.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold">3</span>
              </div>
              <div>
                <h4 className="font-semibold">Poczekaj na propagację</h4>
                <p className="text-gray-600 text-sm">
                  Zmiany DNS mogą potrwać 15-60 minut. Możesz sprawdzić propagację na dnschecker.org
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold">4</span>
              </div>
              <div>
                <h4 className="font-semibold">Sprawdź konfigurację</h4>
                <p className="text-gray-600 text-sm">
                  Wróć do dashboard warmup i kliknij "Sprawdź DNS" dla swojej skrzynki
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help */}
      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2">Potrzebujesz pomocy?</h3>
        <p className="text-gray-600 text-sm mb-4">
          Jeśli masz problemy z konfiguracją DNS, skontaktuj się z hostingiem lub administratorem domeny.
        </p>
        <div className="flex space-x-4">
          <Link
            href="/warmup"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Powrót do warmup
          </Link>
          <a
            href="https://dnschecker.org"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Sprawdź propagację DNS
          </a>
        </div>
      </div>
    </div>
  );
}
