export type CompanyClassCode = "PS" | "WK" | "WKK";
export type CompanySpecializationCode = CompanySpecializationDefinition["code"];

export interface CompanySpecializationDefinition {
  code:
    | "PS_AGENCY"
    | "PS_LARGE_FORMAT_PRINT"
    | "PS_ONLINE_SELLER"
    | "PS_AD_PRODUCER"
    | "PS_DISPLAY"
    | "PS_FOREIGN_BROKER"
    | "WK_TRADESHOW_BUILDER"
    | "WK_EVENT_COMPANY"
    | "WK_RETAIL_FITOUT"
    | "WK_POS_PRODUCER"
    | "WK_FURNITURE_PRODUCER"
    | "WK_RETAIL_EQUIPMENT"
    | "WK_BRANDING_STUDIO"
    | "WK_ARCHITECTURE"
    | "WK_FITOUT_CONTRACTOR"
    | "WKK_RETAIL_CHAIN"
    | "WKK_CONSUMER_BRAND"
    | "WKK_SHOPPING_MALL"
    | "WKK_OFFICE_CORPORATE"
    | "WKK_HOSPITALITY"
    | "WKK_AUTO_DEALER"
    | "WKK_RETAIL_STORE";
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
];

export const SPECIALIZATION_BY_CODE = new Map(
  COMPANY_SPECIALIZATIONS.map((item) => [item.code, item])
);

export const CLASS_BY_SPECIALIZATION = new Map(
  COMPANY_SPECIALIZATIONS.map((item) => [item.code, item.companyClass])
);
