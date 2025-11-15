export type CompanyClassCode = "PS" | "WK" | "WKK";
export type CompanySpecializationCode = CompanySpecializationDefinition["code"];

export interface CompanySpecializationDefinition {
  code:
    | "PS_AGENCY"
    | "PS_MEDIA_HOUSE"
    | "PS_LARGE_FORMAT_PRINT"
    | "PS_ONLINE_SELLER"
    | "PS_AD_PRODUCER"
    | "PS_DISPLAY"
    | "PS_FOREIGN_BROKER"
    | "PS_PROMO_GOODS"
    | "PS_POS_EQUIPMENT_SUPPLIER"
    | "WK_TRADESHOW_BUILDER"
    | "WK_EVENT_COMPANY"
    | "WK_RETAIL_FITOUT"
    | "WK_POS_PRODUCER"
    | "WK_FURNITURE_PRODUCER"
    | "WK_RETAIL_EQUIPMENT"
    | "WK_BRANDING_STUDIO"
    | "WK_ARCHITECTURE"
    | "WK_FITOUT_CONTRACTOR"
    | "WK_EDUCATION_PROVIDER"
    | "WK_IT_SERVICES"
    | "WK_CULTURAL_INSTITUTION"
    | "WK_MEDIA_PRODUCTION"
    | "WK_MEDICAL_EQUIPMENT"
    | "WK_REAL_ESTATE"
    | "WK_GENERAL_PRODUCER"
    | "WK_LANDSCAPE_DESIGN"
    | "WK_FASHION_CONSULTING"
    | "WK_INTERNATIONAL_TRADE"
    | "WK_PACKAGING_PRODUCER"
    | "WK_CATERING_SERVICES"
    | "WK_TRAVEL_TOURISM"
    | "WK_SPORTS_WELLNESS"
    | "WK_AVIATION_SERVICES"
    | "WK_CONFERENCE_CENTER"
    | "WK_SPORTS_MARKETING"
    | "WK_HOSPITALITY_SERVICES"
    | "WK_MAINTENANCE_REPAIR"
    | "WK_AUTOMOTIVE_SERVICE"
    | "WK_VISUALIZATION_3D"
    | "WK_WHOLESALE_DISTRIBUTION"
    | "WK_CONSULTING_SERVICES"
    | "WK_CLEANING_SERVICES"
    | "WK_OTHER"
    | "WKK_RETAIL_CHAIN"
    | "WKK_CONSUMER_BRAND"
    | "WKK_SHOPPING_MALL"
    | "WKK_OFFICE_CORPORATE"
    | "WKK_HOSPITALITY"
    | "WKK_AUTO_DEALER"
    | "WKK_RETAIL_STORE"
    | "WKK_RETAIL_FASHION"
    | "WKK_RETAIL_FURNITURE"
    | "WKK_RETAIL_ELECTRONICS"
    | "WKK_RETAIL_GROCERY"
    | "WKK_RETAIL_OFFICE"
    | "WKK_RETAIL_HOME_DECOR"
    | "WKK_RETAIL_COSMETICS"
    | "WKK_RETAIL_SPORTS"
    | "WKK_RETAIL_AUTOMOTIVE"
    | "WKK_RETAIL_JEWELRY"
    | "WKK_RETAIL_OTHER";
  label: string;
  description: string;
  companyClass: CompanyClassCode;
}

export const COMPANY_SPECIALIZATIONS: CompanySpecializationDefinition[] = [
  {
    code: "PS_AGENCY",
    label: "Agencja reklamowa",
    description:
      "Firma obsługująca klientów końcowych w zakresie kampanii reklamowych, często zamawia różne grupy produktów – od druku po systemy wystawiennicze.",
    companyClass: "PS",
  },
  {
    code: "PS_MEDIA_HOUSE",
    label: "Dom Mediowy",
    description:
      "Firma łącząca różne usługi marketingowe: reklamę, PR, media, content marketing, marketing 360. Dom mediowy obsługuje kompleksowe kampanie dla dużych klientów, zamawia produkty reklamowe, materiały promocyjne i systemy wystawiennicze w ramach realizacji kampanii multi-channel.",
    companyClass: "PS",
  },
  {
    code: "PS_LARGE_FORMAT_PRINT",
    label: "Drukarnia wielkoformatowa",
    description:
      "Podmiot zlecający produkcję w Kreativia z powodu braku technologii lub opłacalności, zamawiający druk i konstrukcje.",
    companyClass: "PS",
  },
  {
    code: "PS_ONLINE_SELLER",
    label: "Sprzedawca internetowy",
    description:
      "Sklep online oferujący standardowe produkty reklamowe (rollupy, flagi, ścianki), zamawiający regularnie mniejsze partie.",
    companyClass: "PS",
  },
  {
    code: "PS_AD_PRODUCER",
    label: "Producent reklam",
    description:
      "Firma wykonująca elementy reklamy wizualnej (kasetony, pylony, szyldy) i zamawiająca komponenty lub wydruki.",
    companyClass: "PS",
  },
  {
    code: "PS_DISPLAY",
    label: "Display",
    description:
      "Firma oferująca systemy wystawiennicze (ścianki, lady, standy), często z własnym montażem i drukiem.",
    companyClass: "PS",
  },
  {
    code: "PS_FOREIGN_BROKER",
    label: "Pośrednik zagraniczny",
    description:
      "Handlowiec lub firma sprzedająca produkty Kreativia klientom z rynków zagranicznych, dbająca o lokalną obsługę i komunikację.",
    companyClass: "PS",
  },
  {
    code: "PS_PROMO_GOODS",
    label: "Producent gadżetów promocyjnych",
    description:
      "Firma produkująca gadżety promocyjne (opaski, breloki, kubki, torby) wykorzystywane w kampaniach marketingowych, eventach i promocjach.",
    companyClass: "PS",
  },
  {
    code: "PS_POS_EQUIPMENT_SUPPLIER",
    label: "Dostawca sprzętu POS",
    description:
      "Firma oferująca kasy fiskalne, drukarki fiskalne, terminale płatnicze, systemy POS i wyposażenie do prowadzenia biznesu.",
    companyClass: "PS",
  },
  {
    code: "WK_TRADESHOW_BUILDER",
    label: "Wykonawca stoisk targowych",
    description:
      "Producent stoisk targowych wykorzystujący druk, Smart Frame, litery 3D w realizacjach.",
    companyClass: "WK",
  },
  {
    code: "WK_EVENT_COMPANY",
    label: "Firma eventowa",
    description:
      "Realizator wydarzeń, konferencji i eventów promocyjnych – zamawia tkaniny, banery tekstylne, flagi, płotki i inne systemy reklamowe.",
    companyClass: "WK",
  },
  {
    code: "WK_RETAIL_FITOUT",
    label: "Wykonawca Retail",
    description:
      "Firma realizująca zabudowy i ekspozycje sklepowe, korzystająca z tkanin, konstrukcji aluminiowych i oznakowania.",
    companyClass: "WK",
  },
  {
    code: "WK_POS_PRODUCER",
    label: "Producent POS",
    description:
      "Producent stojaków, ekspozytorów i elementów point-of-sale, zamawiający druk i konstrukcje aluminiowe.",
    companyClass: "WK",
  },
  {
    code: "WK_FURNITURE_PRODUCER",
    label: "Producent mebli",
    description:
      "Producent mebli i wyposażenia wnętrz (w tym mebli sklepowych i biurowych) wykorzystujący elementy Smart Frame i druk.",
    companyClass: "WK",
  },
  {
    code: "WK_RETAIL_EQUIPMENT",
    label: "Producent wyposażenia Retail",
    description:
      "Firma produkująca zabudowy, regały i elementy ekspozycyjne dla sieci handlowych.",
    companyClass: "WK",
  },
  {
    code: "WK_BRANDING_STUDIO",
    label: "Firma projektowa / Branding",
    description:
      "Biuro projektowe lub agencja brandingowa tworząca koncepcje wnętrz i identyfikacji wizualnej, specyfikująca produkty Kreativia.",
    companyClass: "WK",
  },
  {
    code: "WK_ARCHITECTURE",
    label: "Architektura",
    description:
      "Biuro architektoniczne projektujące przestrzenie komercyjne z wykorzystaniem Smart Frame i elementów dekoracyjnych.",
    companyClass: "WK",
  },
  {
    code: "WK_FITOUT_CONTRACTOR",
    label: "Firma wykończeniowa / Fit-out",
    description:
      "Wykonawca adaptacji i modernizacji przestrzeni komercyjnych, zamawiający oznakowanie, tkaniny i konstrukcje aluminiowe.",
    companyClass: "WK",
  },
  {
    code: "WK_EDUCATION_PROVIDER",
    label: "Dostawca usług edukacyjnych",
    description:
      "Firma oferująca kursy, szkolenia, warsztaty i usługi edukacyjne w różnych dziedzinach (IT, biznes, umiejętności miękkie, specjalistyczne).",
    companyClass: "WK",
  },
  {
    code: "WK_IT_SERVICES",
    label: "Dostawca usług IT i technologicznych",
    description:
      "Firma oferująca usługi informatyczne, technologie, automatyzację, systemy smart home, integrację systemów IT i wsparcie techniczne.",
    companyClass: "WK",
  },
  {
    code: "WK_CULTURAL_INSTITUTION",
    label: "Instytucja kulturalna",
    description:
      "Galeria sztuki, teatr, muzeum, instytucja kulturalna, studio artystyczne, organizator wystaw i projektów artystycznych, dostawca usług rozrywkowych i kulturalnych.",
    companyClass: "WK",
  },
  {
    code: "WK_MEDIA_PRODUCTION",
    label: "Produkcja mediów",
    description:
      "Firma oferująca usługi fotograficzne, wideo, produkcję podcastów, edycję, studio fotograficzne, agencja produkcji mediów i treści multimedialnych.",
    companyClass: "WK",
  },
  {
    code: "WK_MEDICAL_EQUIPMENT",
    label: "Dostawca sprzętu medycznego i kosmetycznego",
    description:
      "Firma oferująca urządzenia medyczne, kosmetyczne, estetyczne, sprzęt do salonów kosmetycznych i klinik medycyny estetycznej.",
    companyClass: "WK",
  },
  {
    code: "WK_REAL_ESTATE",
    label: "Dostawca usług nieruchomości",
    description:
      "Firma zajmująca się wynajmem, zarządzaniem i administracją powierzchni biurowych, magazynowych i komercyjnych.",
    companyClass: "WK",
  },
  {
    code: "WK_GENERAL_PRODUCER",
    label: "Producent ogólny",
    description:
      "Firma produkująca różne wyroby (metalowe, komponenty, konstrukcje, prefabrykaty, produkty przemysłowe) - producent wyrobów metalowych, producent pojazdów, budowniczy domów modułowych.",
    companyClass: "WK",
  },
  {
    code: "WK_LANDSCAPE_DESIGN",
    label: "Architektura krajobrazu i ogrodnictwo",
    description:
      "Firma oferująca usługi projektowania ogrodów, architektury krajobrazu, usług ogrodniczych i aranżacji przestrzeni zewnętrznych.",
    companyClass: "WK",
  },
  {
    code: "WK_FASHION_CONSULTING",
    label: "Konsultant mody i wizerunku",
    description:
      "Firma oferująca doradztwo w zakresie mody, wizerunku, stylizacji, personal branding, konsultacje garderoby i budowania wizerunku osobistego i zespołowego.",
    companyClass: "WK",
  },
  {
    code: "WK_INTERNATIONAL_TRADE",
    label: "Handel międzynarodowy",
    description:
      "Firma zajmująca się handlem międzynarodowym, importem i eksportem produktów, prowadząca działalność handlową na rynkach zagranicznych.",
    companyClass: "WK",
  },
  {
    code: "WK_PACKAGING_PRODUCER",
    label: "Producent opakowań",
    description:
      "Firma produkująca opakowania (kartonowe, tekturowe, e-commerce, wielkogabarytowe, z nadrukiem), standy reklamowe z tektury, opakowania ekologiczne i biodegradowalne.",
    companyClass: "WK",
  },
  {
    code: "WK_CATERING_SERVICES",
    label: "Usługi cateringowe i gastronomiczne",
    description:
      "Firma oferująca usługi cateringowe, gastronomiczne, organizacja przyjęć, catering na eventy, usługi kulinarne, restauracje, food service.",
    companyClass: "WK",
  },
  {
    code: "WK_TRAVEL_TOURISM",
    label: "Biura podróży i turystyka",
    description:
      "Biuro podróży, organizator wycieczek, turystyka krajowa i zagraniczna, organizacja wyjazdów, turystyka biznesowa (MICE), incoming tour operator, podróże grupowe.",
    companyClass: "WK",
  },
  {
    code: "WK_SPORTS_WELLNESS",
    label: "Sport, fitness i wellness",
    description:
      "Firma oferująca usługi sportowe, fitness, wellness, treningi personalne, kluby fitness, usługi rehabilitacyjne, wellness centers, aktywność fizyczna.",
    companyClass: "WK",
  },
  {
    code: "WK_AVIATION_SERVICES",
    label: "Usługi lotnicze i lotnictwo",
    description:
      "Firma oferująca usługi lotnicze, obsługa lotnisk, szkolenia lotnicze, symulatory lotu, usługi dla branży lotniczej, aviation services, aircraft interiors.",
    companyClass: "WK",
  },
  {
    code: "WK_CONFERENCE_CENTER",
    label: "Centra konferencyjne i szkoleniowe",
    description:
      "Centrum konferencyjne, sale szkoleniowe, organizacja konferencji i szkoleń, event venue, conference center, business meetings, training facilities.",
    companyClass: "WK",
  },
  {
    code: "WK_SPORTS_MARKETING",
    label: "Marketing sportowy",
    description:
      "Firma specjalizująca się w marketingu sportowym, sponsoring sportowy, organizacja wyjazdów sportowych, sport marketing, sports events, sports sponsorship.",
    companyClass: "WK",
  },
  {
    code: "WK_HOSPITALITY_SERVICES",
    label: "Usługi hotelarskie i gastronomiczne",
    description:
      "Firma oferująca usługi hotelarskie, zarządzanie hotelem, usługi gastronomiczne dla hoteli, hospitality services, hotel management, hotel services.",
    companyClass: "WK",
  },
  {
    code: "WK_MAINTENANCE_REPAIR",
    label: "Serwis i naprawa",
    description:
      "Firma oferująca usługi serwisowe, naprawcze, konserwacyjne, utrzymaniowe, maintenance services, repair services, serwis urządzeń, naprawa sprzętu.",
    companyClass: "WK",
  },
  {
    code: "WK_AUTOMOTIVE_SERVICE",
    label: "Serwis samochodowy i motoryzacyjny",
    description:
      "Firma oferująca usługi związane z samochodami: serwis, naprawa, diagnostyka, detailing, oklejanie, wymiana części, auto spa, automotive services, car service.",
    companyClass: "WK",
  },
  {
    code: "WK_VISUALIZATION_3D",
    label: "Wizualizacje 3D i rendering",
    description:
      "Firma oferująca wizualizacje 3D, rendering, modele 3D, wizualizacje architektoniczne, wizualizacje produktów, CGI, 3D animation, visualization services.",
    companyClass: "WK",
  },
  {
    code: "WK_WHOLESALE_DISTRIBUTION",
    label: "Hurtownia i dystrybucja",
    description:
      "Firma zajmująca się hurtową sprzedażą, dystrybucją produktów, wholesale trade, distributor, hurtownia, dystrybutor, import-export hurtowy.",
    companyClass: "WK",
  },
  {
    code: "WK_CONSULTING_SERVICES",
    label: "Usługi konsultingowe i doradcze",
    description:
      "Firma oferująca usługi konsultingowe, doradztwo biznesowe, consulting services, advisory, konsultacje, doradztwo strategiczne, business consulting.",
    companyClass: "WK",
  },
  {
    code: "WK_CLEANING_SERVICES",
    label: "Usługi sprzątania i czyszczenia",
    description:
      "Firma oferująca usługi sprzątania, czyszczenia, porządkowe, cleaning services, janitorial services, usługi sprzątające, professional cleaning.",
    companyClass: "WK",
  },
  {
    code: "WK_OTHER",
    label: "Inne",
    description:
      "Firmy, które nie pasują do żadnej z dostępnych specjalizacji. Używane jako kategoria fallback, gdy AI nie może jednoznacznie zaklasyfikować firmy do istniejących specjalizacji.",
    companyClass: "WK",
  },
  {
    code: "WKK_RETAIL_CHAIN",
    label: "Sieciówka",
    description:
      "Sieć handlowa z wieloma lokalizacjami, zamawiająca regularnie materiały reklamowe i ekspozycyjne.",
    companyClass: "WKK",
  },
  {
    code: "WKK_CONSUMER_BRAND",
    label: "Marka konsumencka",
    description:
      "Duża lub średnia marka (odzież, kosmetyki, FMCG) realizująca kampanie promocyjne i brandingowe.",
    companyClass: "WKK",
  },
  {
    code: "WKK_SHOPPING_MALL",
    label: "Galerie handlowe",
    description:
      "Zarządcy centrów handlowych zlecający oznakowanie, ekspozycje lub materiały informacyjne dla najemców.",
    companyClass: "WKK",
  },
  {
    code: "WKK_OFFICE_CORPORATE",
    label: "Biura i korporacje",
    description:
      "Firmy aranżujące przestrzenie biurowe i reprezentacyjne z użyciem Smart Frame i druku dekoracyjnego.",
    companyClass: "WKK",
  },
  {
    code: "WKK_HOSPITALITY",
    label: "Hotele i Restauracje",
    description:
      "Obiekty hotelowe i gastronomiczne zamawiające elementy dekoracyjne, oznakowanie i systemy ekspozycyjne.",
    companyClass: "WKK",
  },
  {
    code: "WKK_AUTO_DEALER",
    label: "Salony samochodowe",
    description:
      "Dealerzy i dystrybutorzy marek motoryzacyjnych, wykorzystujący Smart Frame i systemy ekspozycyjne w salonach.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_STORE",
    label: "Salony sprzedaży",
    description:
      "Punkty sprzedaży detalicznej zamawiające systemy reklamowe i dekoracyjne do aranżacji wnętrz.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_FASHION",
    label: "Sklepy odzieżowe i moda",
    description:
      "Sklepy oferujące odzież, obuwie, akcesoria modowe i marki fashion. Zamawiające systemy wystawiennicze, manekiny i materiały reklamowe do prezentacji kolekcji.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_FURNITURE",
    label: "Sklepy meblowe",
    description:
      "Sklepy meblowe i z wyposażeniem wnętrz. Zamawiające systemy ekspozycyjne, tablice informacyjne i materiały reklamowe do prezentacji mebli i akcesoriów wnętrzarskich.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_ELECTRONICS",
    label: "Sklepy elektroniczne i AGD",
    description:
      "Sklepy z elektroniką, sprzętem AGD i urządzeniami. Zamawiające ekspozytory, tablice informacyjne i materiały reklamowe do prezentacji produktów elektronicznych.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_GROCERY",
    label: "Sklepy spożywcze",
    description:
      "Supermarkety, delikatesy i sieci spożywcze. Zamawiające oznakowanie, tablice informacyjne, systemy ekspozycyjne i materiały promocyjne dla produktów spożywczych.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_OFFICE",
    label: "Sklepy biurowe",
    description:
      "Sklepy z materiałami biurowymi, sprzętem biurowym i wyposażeniem biura. Zamawiające systemy ekspozycyjne, tablice informacyjne i materiały reklamowe do prezentacji produktów biurowych.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_HOME_DECOR",
    label: "Sklepy z dekoracjami i wystrojem",
    description:
      "Sklepy z dekoracjami, tapetami, tekstyliami i artykułami dekoracyjnymi. Zamawiające systemy ekspozycyjne, materiały reklamowe i wizualizacje produktów dekoracyjnych.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_COSMETICS",
    label: "Drogerie i perfumerie",
    description:
      "Drogerie, perfumerie i sklepy z kosmetykami. Zamawiające ekspozytory kosmetyczne, tablice informacyjne i materiały reklamowe do prezentacji produktów kosmetycznych.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_SPORTS",
    label: "Sklepy sportowe",
    description:
      "Sklepy z odzieżą sportową, sprzętem sportowym i akcesoriami fitness. Zamawiające systemy ekspozycyjne, tablice informacyjne i materiały reklamowe do prezentacji produktów sportowych.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_AUTOMOTIVE",
    label: "Sklepy motoryzacyjne",
    description:
      "Sklepy z częściami samochodowymi, akcesoriami motoryzacyjnymi i oponami (nie dealerzy). Zamawiające ekspozytory, tablice informacyjne i materiały reklamowe do prezentacji części i akcesoriów.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_JEWELRY",
    label: "Jubilerzy",
    description:
      "Jubilerzy, sklepy z biżuterią, zegarkami i wyrobami ze złota i srebra. Zamawiające gabloty ekspozycyjne, systemy oświetleniowe i materiały reklamowe do prezentacji biżuterii.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_OTHER",
    label: "Inne sklepy retail",
    description:
      "Inne sklepy detaliczne, które nie pasują do pozostałych kategorii retail. Zamawiające systemy ekspozycyjne, tablice informacyjne i materiały reklamowe do prezentacji produktów.",
    companyClass: "WKK",
  },
];

export const SPECIALIZATION_BY_CODE = new Map(
  COMPANY_SPECIALIZATIONS.map((item) => [item.code, item])
);

export const CLASS_BY_SPECIALIZATION = new Map(
  COMPANY_SPECIALIZATIONS.map((item) => [item.code, item.companyClass])
);
