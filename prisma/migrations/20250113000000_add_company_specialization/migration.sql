-- Create CompanySpecialization table
CREATE TABLE IF NOT EXISTS "CompanySpecialization" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL UNIQUE,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "companyClass" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstCompanyId" INTEGER,
    "firstCompanyName" TEXT,
    "firstCompanyReason" TEXT,
    "aiConfidence" REAL,
    FOREIGN KEY ("firstCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "CompanySpecialization_code_idx" ON "CompanySpecialization"("code");
CREATE INDEX IF NOT EXISTS "CompanySpecialization_companyClass_idx" ON "CompanySpecialization"("companyClass");
CREATE INDEX IF NOT EXISTS "CompanySpecialization_createdBy_idx" ON "CompanySpecialization"("createdBy");
CREATE INDEX IF NOT EXISTS "CompanySpecialization_createdAt_idx" ON "CompanySpecialization"("createdAt");

-- Insert existing specializations from config
INSERT OR IGNORE INTO "CompanySpecialization" ("code", "label", "description", "companyClass", "createdBy", "createdAt", "updatedAt")
VALUES
    ('PS_AGENCY', 'Agencja reklamowa', 'Firma obsługująca klientów końcowych w zakresie kampanii reklamowych, często zamawia różne grupy produktów – od druku po systemy wystawiennicze.', 'PS', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('PS_LARGE_FORMAT_PRINT', 'Drukarnia wielkoformatowa', 'Podmiot zlecający produkcję w Kreativia z powodu braku technologii lub opłacalności, zamawiający druk i konstrukcje.', 'PS', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('PS_ONLINE_SELLER', 'Sprzedawca internetowy', 'Sklep online oferujący standardowe produkty reklamowe (rollupy, flagi, ścianki), zamawiający regularnie mniejsze partie.', 'PS', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('PS_AD_PRODUCER', 'Producent reklam', 'Firma wykonująca elementy reklamy wizualnej (kasetony, pylony, szyldy) i zamawiająca komponenty lub wydruki.', 'PS', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('PS_DISPLAY', 'Display', 'Firma oferująca systemy wystawiennicze (ścianki, lady, standy), często z własnym montażem i drukiem.', 'PS', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('PS_FOREIGN_BROKER', 'Pośrednik zagraniczny', 'Handlowiec lub firma sprzedająca produkty Kreativia klientom z rynków zagranicznych, dbająca o lokalną obsługę i komunikację.', 'PS', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WK_TRADESHOW_BUILDER', 'Wykonawca stoisk targowych', 'Producent stoisk targowych wykorzystujący druk, Smart Frame, litery 3D w realizacjach.', 'WK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WK_EVENT_COMPANY', 'Firma eventowa', 'Realizator wydarzeń, konferencji i eventów promocyjnych – zamawia tkaniny, banery tekstylne, flagi, płotki i inne systemy reklamowe.', 'WK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WK_RETAIL_FITOUT', 'Wykonawca Retail', 'Firma realizująca zabudowy i ekspozycje sklepowe, korzystająca z tkanin, konstrukcji aluminiowych i oznakowania.', 'WK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WK_POS_PRODUCER', 'Producent POS', 'Producent stojaków, ekspozytorów i elementów point-of-sale, zamawiający druk i konstrukcje aluminiowe.', 'WK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WK_FURNITURE_PRODUCER', 'Producent mebli', 'Producent mebli i wyposażenia wnętrz (w tym mebli sklepowych i biurowych) wykorzystujący elementy Smart Frame i druk.', 'WK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WK_RETAIL_EQUIPMENT', 'Producent wyposażenia Retail', 'Firma produkująca zabudowy, regały i elementy ekspozycyjne dla sieci handlowych.', 'WK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WK_BRANDING_STUDIO', 'Firma projektowa / Branding', 'Biuro projektowe lub agencja brandingowa tworząca koncepcje wnętrz i identyfikacji wizualnej, specyfikująca produkty Kreativia.', 'WK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WK_ARCHITECTURE', 'Architektura', 'Biuro architektoniczne projektujące przestrzenie komercyjne z wykorzystaniem Smart Frame i elementów dekoracyjnych.', 'WK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WK_FITOUT_CONTRACTOR', 'Firma wykończeniowa / Fit-out', 'Wykonawca adaptacji i modernizacji przestrzeni komercyjnych, zamawiający oznakowanie, tkaniny i konstrukcje aluminiowe.', 'WK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WKK_RETAIL_CHAIN', 'Sieciówka', 'Sieć handlowa z wieloma lokalizacjami, zamawiająca regularnie materiały reklamowe i ekspozycyjne.', 'WKK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WKK_CONSUMER_BRAND', 'Marka konsumencka', 'Duża lub średnia marka (odzież, kosmetyki, FMCG) realizująca kampanie promocyjne i brandingowe.', 'WKK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WKK_SHOPPING_MALL', 'Galerie handlowe', 'Zarządcy centrów handlowych zlecający oznakowanie, ekspozycje lub materiały informacyjne dla najemców.', 'WKK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WKK_OFFICE_CORPORATE', 'Biura i korporacje', 'Firmy aranżujące przestrzenie biurowe i reprezentacyjne z użyciem Smart Frame i druku dekoracyjnego.', 'WKK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WKK_HOSPITALITY', 'Hotele i Restauracje', 'Obiekty hotelowe i gastronomiczne zamawiające elementy dekoracyjne, oznakowanie i systemy ekspozycyjne.', 'WKK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WKK_AUTO_DEALER', 'Salony samochodowe', 'Dealerzy i dystrybutorzy marek motoryzacyjnych, wykorzystujący Smart Frame i systemy ekspozycyjne w salonach.', 'WKK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WKK_RETAIL_STORE', 'Salony sprzedaży', 'Punkty sprzedaży detalicznej zamawiające systemy reklamowe i dekoracyjne do aranżacji wnętrz.', 'WKK', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

