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
      "Firma obsługująca klientów końcowych w zakresie kampanii reklamowych (advertising agency, marketing agency, ad agency | Werbeagentur, Marketingagentur | agence publicitaire, agence marketing), często zamawia różne grupy produktów – od druku po systemy wystawiennicze.",
    companyClass: "PS",
  },
  {
    code: "PS_MEDIA_HOUSE",
    label: "Dom Mediowy",
    description:
      "Firma łącząca różne usługi marketingowe: reklamę, PR, media, content marketing, marketing 360 (media house, full-service agency, integrated marketing | Medienhaus, Full-Service-Agentur | maison de médias, agence full-service). Dom mediowy obsługuje kompleksowe kampanie dla dużych klientów, zamawia produkty reklamowe, materiały promocyjne i systemy wystawiennicze w ramach realizacji kampanii multi-channel.",
    companyClass: "PS",
  },
  {
    code: "PS_LARGE_FORMAT_PRINT",
    label: "Drukarnia wielkoformatowa",
    description:
      "Podmiot zlecający produkcję w Kreativia z powodu braku technologii lub opłacalności (large format printing, wide format print, print shop | Großformatdruck, Druckerei | impression grand format, imprimerie), zamawiający druk i konstrukcje.",
    companyClass: "PS",
  },
  {
    code: "PS_ONLINE_SELLER",
    label: "Sprzedawca internetowy",
    description:
      "Sklep online oferujący standardowe produkty reklamowe (online seller, e-commerce, online store | Online-Händler, E-Commerce | vendeur en ligne, e-commerce). Zamawiający regularnie mniejsze partie produktów reklamowych (rollupy, flagi, ścianki).",
    companyClass: "PS",
  },
  {
    code: "PS_AD_PRODUCER",
    label: "Producent reklam",
    description:
      "Firma wykonująca elementy reklamy wizualnej (ad producer, sign maker, visual advertising producer | Werbeproduzent, Schilderhersteller | producteur publicitaire, fabricant de panneaux) i zamawiająca komponenty lub wydruki (kasetony, pylony, szyldy).",
    companyClass: "PS",
  },
  {
    code: "PS_DISPLAY",
    label: "Display",
    description:
      "Firma oferująca systemy wystawiennicze (display systems, exhibition systems, display supplier | Displaysysteme, Ausstellungssysteme | systèmes d'affichage, systèmes d'exposition), często z własnym montażem i drukiem (ścianki, lady, standy).",
    companyClass: "PS",
  },
  {
    code: "PS_FOREIGN_BROKER",
    label: "Pośrednik zagraniczny",
    description:
      "Handlowiec lub firma sprzedająca produkty Kreativia klientom z rynków zagranicznych (foreign broker, international broker, overseas trader | Auslandsmakler, internationaler Makler | courtier étranger, courtier international), dbająca o lokalną obsługę i komunikację.",
    companyClass: "PS",
  },
  {
    code: "PS_PROMO_GOODS",
    label: "Producent gadżetów promocyjnych",
    description:
      "Firma produkująca gadżety promocyjne (promotional goods, promo items, promotional products | Werbeartikel, Promotion-Artikel | articles promotionnels, objets publicitaires) wykorzystywane w kampaniach marketingowych, eventach i promocjach (opaski, breloki, kubki, torby).",
    companyClass: "PS",
  },
  {
    code: "WK_TRADESHOW_BUILDER",
    label: "Wykonawca stoisk targowych",
    description:
      "Producent stoisk targowych (tradeshow builder, exhibition stand builder, trade show contractor | Messebauer, Ausstellungsstandbauer | constructeur de stands, constructeur d'expositions) wykorzystujący druk, Smart Frame, litery 3D w realizacjach.",
    companyClass: "WK",
  },
  {
    code: "WK_EVENT_COMPANY",
    label: "Firma eventowa",
    description:
      "Realizator wydarzeń, konferencji i eventów promocyjnych (event company, event organizer, conference organizer | Event-Agentur, Veranstaltungsorganisator | société d'événements, organisateur d'événements) – zamawia tkaniny, banery tekstylne, flagi, płotki i inne systemy reklamowe.",
    companyClass: "WK",
  },
  {
    code: "WK_RETAIL_FITOUT",
    label: "Wykonawca Retail",
    description:
      "Firma realizująca zabudowy i ekspozycje sklepowe (retail fitout, shop fitting, retail contractor | Ladeneinrichtung, Shopfitting | aménagement commercial, agencement magasin), korzystająca z tkanin, konstrukcji aluminiowych i oznakowania.",
    companyClass: "WK",
  },
  {
    code: "WK_POS_PRODUCER",
    label: "Producent POS",
    description:
      "Producent stojaków, ekspozytorów i elementów point-of-sale (POS producer, point of sale producer, display stand manufacturer | POS-Hersteller, Werbeträger-Hersteller | producteur POS, fabricant de présentoirs), zamawiający druk i konstrukcje aluminiowe.",
    companyClass: "WK",
  },
  {
    code: "WK_FURNITURE_PRODUCER",
    label: "Producent mebli",
    description:
      "Producent mebli i wyposażenia wnętrz (furniture producer, furniture manufacturer, furniture maker | Möbelhersteller, Möbelproduzent | fabricant de meubles, producteur de mobilier) - w tym mebli sklepowych i biurowych - wykorzystujący elementy Smart Frame i druk.",
    companyClass: "WK",
  },
  {
    code: "WK_RETAIL_EQUIPMENT",
    label: "Producent wyposażenia Retail",
    description:
      "Firma produkująca zabudowy, regały i elementy ekspozycyjne dla sieci handlowych (retail equipment, shop equipment, retail fixtures manufacturer | Ladeneinrichtung, Ladenbau | équipement de magasin, aménagement commercial).",
    companyClass: "WK",
  },
  {
    code: "WK_BRANDING_STUDIO",
    label: "Firma projektowa / Branding",
    description:
      "Biuro projektowe lub agencja brandingowa (branding studio, design studio, branding agency | Branding-Studio, Design-Studio | studio de branding, agence de design) tworząca koncepcje wnętrz i identyfikacji wizualnej, specyfikująca produkty Kreativia.",
    companyClass: "WK",
  },
  {
    code: "WK_ARCHITECTURE",
    label: "Architektura",
    description:
      "Biuro architektoniczne (architecture, architectural office, architectural firm | Architektur, Architekturbüro | architecture, cabinet d'architecture) projektujące przestrzenie komercyjne z wykorzystaniem Smart Frame i elementów dekoracyjnych.",
    companyClass: "WK",
  },
  {
    code: "WK_FITOUT_CONTRACTOR",
    label: "Firma wykończeniowa / Fit-out",
    description:
      "Wykonawca adaptacji i modernizacji przestrzeni komercyjnych (fitout contractor, interior fitout, commercial fitout | Innenausbau, Shopfitting | entreprise d'aménagement, agencement intérieur), zamawiający oznakowanie, tkaniny i konstrukcje aluminiowe.",
    companyClass: "WK",
  },
  {
    code: "WK_EDUCATION_PROVIDER",
    label: "Dostawca usług edukacyjnych",
    description:
      "Firma oferująca kursy, szkolenia, warsztaty i usługi edukacyjne (education provider, training company, educational services | Bildungsanbieter, Schulungsunternehmen | prestataire de formation, centre de formation) w różnych dziedzinach (IT, biznes, umiejętności miękkie, specjalistyczne).",
    companyClass: "WK",
  },
  {
    code: "WK_IT_SERVICES",
    label: "Dostawca usług IT i technologicznych",
    description:
      "Firma oferująca usługi informatyczne, technologie, automatyzację (IT services, technology services, software services | IT-Dienstleistungen, Technologie-Dienstleister | services informatiques, services technologiques), systemy smart home, integrację systemów IT i wsparcie techniczne.",
    companyClass: "WK",
  },
  {
    code: "WK_CULTURAL_INSTITUTION",
    label: "Instytucja kulturalna",
    description:
      "Galeria sztuki, teatr, muzeum, instytucja kulturalna (cultural institution, art gallery, museum, theater | Kulturinstitution, Kunstgalerie, Museum | institution culturelle, galerie d'art), studio artystyczne, organizator wystaw i projektów artystycznych, dostawca usług rozrywkowych i kulturalnych.",
    companyClass: "WK",
  },
  {
    code: "WK_MEDIA_PRODUCTION",
    label: "Produkcja mediów",
    description:
      "Firma oferująca usługi fotograficzne, wideo, produkcję podcastów (media production, video production, photography studio | Medienproduktion, Videoproduktion | production médias, production vidéo), edycję, studio fotograficzne, agencja produkcji mediów i treści multimedialnych.",
    companyClass: "WK",
  },
  {
    code: "WK_MEDICAL_EQUIPMENT",
    label: "Dostawca sprzętu medycznego i kosmetycznego",
    description:
      "Firma oferująca urządzenia medyczne, kosmetyczne, estetyczne (medical equipment, cosmetic equipment, aesthetic equipment supplier | Medizintechnik, Kosmetikgeräte | équipement médical, équipement esthétique), sprzęt do salonów kosmetycznych i klinik medycyny estetycznej.",
    companyClass: "WK",
  },
  {
    code: "WK_REAL_ESTATE",
    label: "Dostawca usług nieruchomości",
    description:
      "Firma zajmująca się wynajmem, zarządzaniem i administracją powierzchni (real estate, property management, commercial real estate | Immobilien, Immobilienverwaltung | immobilier, gestion immobilière) biurowych, magazynowych i komercyjnych.",
    companyClass: "WK",
  },
  {
    code: "WK_GENERAL_PRODUCER",
    label: "Producent ogólny",
    description:
      "Firma produkująca różne wyroby (general producer, manufacturer, industrial producer | Produzent, Hersteller, Industrieunternehmen | producteur général, fabricant industriel) - metalowe, komponenty, konstrukcje, prefabrykaty, produkty przemysłowe - producent wyrobów metalowych, producent pojazdów, budowniczy domów modułowych.",
    companyClass: "WK",
  },
  {
    code: "WK_LANDSCAPE_DESIGN",
    label: "Architektura krajobrazu i ogrodnictwo",
    description:
      "Firma oferująca usługi projektowania ogrodów, architektury krajobrazu (landscape design, garden design, landscaping services | Landschaftsarchitektur, Gartengestaltung | architecture paysagère, aménagement paysager), usług ogrodniczych i aranżacji przestrzeni zewnętrznych.",
    companyClass: "WK",
  },
  {
    code: "WK_FASHION_CONSULTING",
    label: "Konsultant mody i wizerunku",
    description:
      "Firma oferująca doradztwo w zakresie mody, wizerunku (fashion consulting, style consulting, image consulting | Modeberatung, Stilberatung | conseil en mode, conseil en image), stylizacji, personal branding, konsultacje garderoby i budowania wizerunku osobistego i zespołowego.",
    companyClass: "WK",
  },
  {
    code: "WK_INTERNATIONAL_TRADE",
    label: "Handel międzynarodowy",
    description:
      "Firma zajmująca się handlem międzynarodowym (international trade, import export, international trading | Außenhandel, Import-Export | commerce international, import-export), importem i eksportem produktów, prowadząca działalność handlową na rynkach zagranicznych.",
    companyClass: "WK",
  },
  {
    code: "WK_PACKAGING_PRODUCER",
    label: "Producent opakowań",
    description:
      "Firma produkująca opakowania (packaging producer, packaging manufacturer, box manufacturer | Verpackungshersteller, Kartonagenhersteller | fabricant d'emballages, producteur de cartons) - kartonowe, tekturowe, e-commerce, wielkogabarytowe, z nadrukiem - standy reklamowe z tektury, opakowania ekologiczne i biodegradowalne.",
    companyClass: "WK",
  },
  {
    code: "WK_CATERING_SERVICES",
    label: "Usługi cateringowe i gastronomiczne",
    description:
      "Firma oferująca usługi cateringowe, gastronomiczne (catering services, food service, restaurant services | Catering, Gastronomie | services de restauration, traiteur), organizacja przyjęć, catering na eventy, usługi kulinarne, restauracje.",
    companyClass: "WK",
  },
  {
    code: "WK_TRAVEL_TOURISM",
    label: "Biura podróży i turystyka",
    description:
      "Biuro podróży, organizator wycieczek (travel agency, tourism, tour operator | Reisebüro, Tourismus | agence de voyage, tourisme), turystyka krajowa i zagraniczna, organizacja wyjazdów, turystyka biznesowa (MICE), incoming tour operator, podróże grupowe.",
    companyClass: "WK",
  },
  {
    code: "WK_SPORTS_WELLNESS",
    label: "Sport, fitness i wellness",
    description:
      "Firma oferująca usługi sportowe, fitness, wellness (sports wellness, fitness center, gym, wellness center | Fitness, Wellness, Sportstudio | fitness, bien-être, centre sportif), treningi personalne, kluby fitness, usługi rehabilitacyjne, wellness centers, aktywność fizyczna.",
    companyClass: "WK",
  },
  {
    code: "WK_AVIATION_SERVICES",
    label: "Usługi lotnicze i lotnictwo",
    description:
      "Firma oferująca usługi lotnicze (aviation services, airport services, flight training | Luftfahrtdienstleistungen, Flughafenservice | services aéronautiques, services aéroportuaires), obsługa lotnisk, szkolenia lotnicze, symulatory lotu, usługi dla branży lotniczej, aircraft interiors.",
    companyClass: "WK",
  },
  {
    code: "WK_CONFERENCE_CENTER",
    label: "Centra konferencyjne i szkoleniowe",
    description:
      "Centrum konferencyjne, sale szkoleniowe (conference center, training facility, meeting venue | Tagungszentrum, Konferenzzentrum | centre de conférences, salle de formation), organizacja konferencji i szkoleń, event venue, business meetings.",
    companyClass: "WK",
  },
  {
    code: "WK_SPORTS_MARKETING",
    label: "Marketing sportowy",
    description:
      "Firma specjalizująca się w marketingu sportowym (sports marketing, sports sponsorship, sports events | Sportmarketing, Sportsponsoring | marketing sportif, sponsoring sportif), sponsoring sportowy, organizacja wyjazdów sportowych.",
    companyClass: "WK",
  },
  {
    code: "WK_HOSPITALITY_SERVICES",
    label: "Usługi hotelarskie i gastronomiczne",
    description:
      "Firma oferująca usługi hotelarskie (hospitality services, hotel management, hotel services | Gastgewerbe, Hotelmanagement | hôtellerie, gestion hôtelière), zarządzanie hotelem, usługi gastronomiczne dla hoteli.",
    companyClass: "WK",
  },
  {
    code: "WK_MAINTENANCE_REPAIR",
    label: "Serwis i naprawa",
    description:
      "Firma oferująca usługi serwisowe, naprawcze (maintenance services, repair services, facility maintenance | Wartung, Reparatur, Facility Management | maintenance, réparation, services d'entretien), konserwacyjne, utrzymaniowe, serwis urządzeń, naprawa sprzętu.",
    companyClass: "WK",
  },
  {
    code: "WK_AUTOMOTIVE_SERVICE",
    label: "Serwis samochodowy i motoryzacyjny",
    description:
      "Firma oferująca usługi związane z samochodami (automotive service, car service, auto repair | Kfz-Service, Autowerkstatt | service automobile, garage automobile): serwis, naprawa, diagnostyka, detailing, oklejanie, wymiana części, auto spa.",
    companyClass: "WK",
  },
  {
    code: "WK_VISUALIZATION_3D",
    label: "Wizualizacje 3D i rendering",
    description:
      "Firma oferująca wizualizacje 3D, rendering (3D visualization, 3D rendering, CGI services | 3D-Visualisierung, Rendering | visualisation 3D, rendu 3D), modele 3D, wizualizacje architektoniczne, wizualizacje produktów, 3D animation.",
    companyClass: "WK",
  },
  {
    code: "WK_WHOLESALE_DISTRIBUTION",
    label: "Hurtownia i dystrybucja",
    description:
      "Firma zajmująca się hurtową sprzedażą, dystrybucją produktów (wholesale distribution, distributor, wholesale trade | Großhandel, Distributor | distribution en gros, commerce de gros), hurtownia, dystrybutor, import-export hurtowy.",
    companyClass: "WK",
  },
  {
    code: "WK_CONSULTING_SERVICES",
    label: "Usługi konsultingowe i doradcze",
    description:
      "Firma oferująca usługi konsultingowe, doradztwo biznesowe (consulting services, business consulting, advisory services | Unternehmensberatung, Beratungsdienstleistungen | services de conseil, conseil en entreprise), konsultacje, doradztwo strategiczne.",
    companyClass: "WK",
  },
  {
    code: "WK_CLEANING_SERVICES",
    label: "Usługi sprzątania i czyszczenia",
    description:
      "Firma oferująca usługi sprzątania, czyszczenia (cleaning services, janitorial services, professional cleaning | Reinigungsdienst, Gebäudereinigung | services de nettoyage, entreprise de nettoyage), porządkowe, usługi sprzątające.",
    companyClass: "WK",
  },
  {
    code: "WK_OTHER",
    label: "Inne",
    description:
      "Firmy, które nie pasują do żadnej z dostępnych specjalizacji (other, miscellaneous, unclassified | Sonstiges, Verschiedenes | autre, divers). Używane jako kategoria fallback, gdy AI nie może jednoznacznie zaklasyfikować firmy do istniejących specjalizacji.",
    companyClass: "WK",
  },
  {
    code: "WKK_RETAIL_CHAIN",
    label: "Sieciówka",
    description:
      "Sieć handlowa z wieloma lokalizacjami (retail chain, retail network, chain store | Einzelhandelskette, Filialkette | chaîne de magasins, réseau de distribution), zamawiająca regularnie materiały reklamowe i ekspozycyjne.",
    companyClass: "WKK",
  },
  {
    code: "WKK_CONSUMER_BRAND",
    label: "Marka konsumencka",
    description:
      "Duża lub średnia marka (consumer brand, FMCG brand, consumer goods brand | Verbrauchermarke, Konsumgütermarke | marque grand public, marque de grande consommation) - odzież, kosmetyki, FMCG - realizująca kampanie promocyjne i brandingowe.",
    companyClass: "WKK",
  },
  {
    code: "WKK_SHOPPING_MALL",
    label: "Galerie handlowe",
    description:
      "Zarządcy centrów handlowych (shopping mall, shopping center, retail center | Einkaufszentrum, Shopping-Center | centre commercial, galerie marchande) zlecający oznakowanie, ekspozycje lub materiały informacyjne dla najemców.",
    companyClass: "WKK",
  },
  {
    code: "WKK_OFFICE_CORPORATE",
    label: "Biura i korporacje",
    description:
      "Firmy aranżujące przestrzenie biurowe i reprezentacyjne (office corporate, corporate office, business office | Büro, Unternehmen, Corporate Office | bureau d'entreprise, siège social) z użyciem Smart Frame i druku dekoracyjnego.",
    companyClass: "WKK",
  },
  {
    code: "WKK_HOSPITALITY",
    label: "Hotele i Restauracje",
    description:
      "Obiekty hotelowe i gastronomiczne (hospitality, hotel, restaurant | Gastgewerbe, Hotel, Restaurant | hôtellerie, hôtel, restaurant) zamawiające elementy dekoracyjne, oznakowanie i systemy ekspozycyjne.",
    companyClass: "WKK",
  },
  {
    code: "WKK_AUTO_DEALER",
    label: "Salony samochodowe",
    description:
      "Dealerzy i dystrybutorzy marek motoryzacyjnych (auto dealer, car dealer, automotive dealership | Autohändler, Fahrzeughändler | concessionnaire automobile, vendeur automobile), wykorzystujący Smart Frame i systemy ekspozycyjne w salonach.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_STORE",
    label: "Salony sprzedaży",
    description:
      "Punkty sprzedaży detalicznej (retail store, retail shop, retail outlet | Einzelhandelsgeschäft, Laden | magasin de détail, point de vente) zamawiające systemy reklamowe i dekoracyjne do aranżacji wnętrz.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_FASHION",
    label: "Sklepy odzieżowe i moda",
    description:
      "Sklepy oferujące odzież, obuwie, akcesoria modowe i marki fashion (fashion retail, clothing store, fashion store | Modegeschäft, Bekleidungsgeschäft | magasin de mode, boutique de vêtements). Zamawiające systemy wystawiennicze, manekiny i materiały reklamowe do prezentacji kolekcji.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_FURNITURE",
    label: "Sklepy meblowe",
    description:
      "Sklepy meblowe i z wyposażeniem wnętrz (furniture store, home furnishing store | Möbelgeschäft, Einrichtungshaus | magasin de meubles, mobilier). Zamawiające systemy ekspozycyjne, tablice informacyjne i materiały reklamowe do prezentacji mebli i akcesoriów wnętrzarskich.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_ELECTRONICS",
    label: "Sklepy elektroniczne i AGD",
    description:
      "Sklepy z elektroniką, sprzętem AGD i urządzeniami (electronics store, consumer electronics, appliance store | Elektronikgeschäft, Elektrofachmarkt | magasin d'électronique, électroménager). Zamawiające ekspozytory, tablice informacyjne i materiały reklamowe do prezentacji produktów elektronicznych.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_GROCERY",
    label: "Sklepy spożywcze",
    description:
      "Supermarkety, delikatesy i sieci spożywcze (grocery store, supermarket, food store | Lebensmittelgeschäft, Supermarkt | magasin d'alimentation, supermarché). Zamawiające oznakowanie, tablice informacyjne, systemy ekspozycyjne i materiały promocyjne dla produktów spożywczych.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_OFFICE",
    label: "Sklepy biurowe",
    description:
      "Sklepy z materiałami biurowymi, sprzętem biurowym i wyposażeniem biura (office supply store, business supply store | Bürobedarf, Büromaterial | magasin de fournitures de bureau). Zamawiające systemy ekspozycyjne, tablice informacyjne i materiały reklamowe do prezentacji produktów biurowych.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_HOME_DECOR",
    label: "Sklepy z dekoracjami i wystrojem",
    description:
      "Sklepy z dekoracjami, tapetami, tekstyliami i artykułami dekoracyjnymi (home decor store, interior decor store, home goods store | Deko-Geschäft, Wohnaccessoires | magasin de décoration, accessoires de maison). Zamawiające systemy ekspozycyjne, materiały reklamowe i wizualizacje produktów dekoracyjnych.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_COSMETICS",
    label: "Drogerie i perfumerie",
    description:
      "Drogerie, perfumerie i sklepy z kosmetykami (drugstore, perfumery, cosmetics store, beauty store | Drogerie, Parfümerie | droguerie, parfumerie). Sieci drogerii i perfumerii sprzedające kosmetyki, produkty zdrowotne, środki higieniczne, perfumy i artykuły do pielęgnacji. Zamawiające ekspozytory kosmetyczne, tablice informacyjne i materiały reklamowe do prezentacji produktów kosmetycznych.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_SPORTS",
    label: "Sklepy sportowe",
    description:
      "Sklepy z odzieżą sportową, sprzętem sportowym i akcesoriami fitness (sports store, sporting goods store, athletic store | Sportgeschäft, Sportartikel | magasin de sport, articles de sport). Zamawiające systemy ekspozycyjne, tablice informacyjne i materiały reklamowe do prezentacji produktów sportowych.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_AUTOMOTIVE",
    label: "Sklepy motoryzacyjne",
    description:
      "Sklepy z częściami samochodowymi, akcesoriami motoryzacyjnymi i oponami (automotive store, car parts store, auto parts | Autozubehör, Autoteile | magasin automobile, pièces auto) - nie dealerzy. Zamawiające ekspozytory, tablice informacyjne i materiały reklamowe do prezentacji części i akcesoriów.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_JEWELRY",
    label: "Jubilerzy",
    description:
      "Jubilerzy, sklepy z biżuterią, zegarkami i wyrobami ze złota i srebra (jewelry store, jeweler, watch store | Juwelier, Uhrengeschäft | bijouterie, joaillier). Zamawiające gabloty ekspozycyjne, systemy oświetleniowe i materiały reklamowe do prezentacji biżuterii.",
    companyClass: "WKK",
  },
  {
    code: "WKK_RETAIL_OTHER",
    label: "Inne sklepy retail",
    description:
      "Inne sklepy detaliczne (other retail, miscellaneous retail store | Sonstiger Einzelhandel | autres commerces de détail), które nie pasują do pozostałych kategorii retail. Zamawiające systemy ekspozycyjne, tablice informacyjne i materiały reklamowe do prezentacji produktów.",
    companyClass: "WKK",
  },
];

export const SPECIALIZATION_BY_CODE = new Map(
  COMPANY_SPECIALIZATIONS.map((item) => [item.code, item])
);

export const CLASS_BY_SPECIALIZATION = new Map(
  COMPANY_SPECIALIZATIONS.map((item) => [item.code, item.companyClass])
);
