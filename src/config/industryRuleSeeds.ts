import { IndustryRuleEntry } from "@/services/industryClassification";

export const INDUSTRY_RULE_SEEDS: IndustryRuleEntry[] = [
  {
    industry: "entertainment",
    matches: [
      { specializationCode: "WK_EVENT_COMPANY", score: 4 },
      { specializationCode: "WKK_HOSPITALITY", score: 2 },
    ],
  },
  {
    industry: "marketing & advertising",
    matches: [
      { specializationCode: "PS_AGENCY", score: 5 },
      { specializationCode: "WK_BRANDING_STUDIO", score: 3 },
    ],
  },
  {
    industry: "civic & social organization",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
      { specializationCode: "WKK_HOSPITALITY", score: 1 },
    ],
  },
  {
    industry: "furniture",
    matches: [
      { specializationCode: "WK_FURNITURE_PRODUCER", score: 5 },
      { specializationCode: "WK_RETAIL_EQUIPMENT", score: 3 },
    ],
  },
  {
    industry: "construction",
    matches: [
      { specializationCode: "WK_FITOUT_CONTRACTOR", score: 5 },
      { specializationCode: "WK_RETAIL_FITOUT", score: 3 },
    ],
  },
  {
    industry: "sports",
    matches: [
      { specializationCode: "WKK_RETAIL_STORE", score: 3 },
      { specializationCode: "WKK_CONSUMER_BRAND", score: 2 },
    ],
  },
  {
    industry: "primary/secondary education",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
      { specializationCode: "WKK_HOSPITALITY", score: 1 },
    ],
  },
  {
    industry: "public relations & communications",
    matches: [
      { specializationCode: "PS_AGENCY", score: 4 },
      { specializationCode: "WK_BRANDING_STUDIO", score: 3 },
    ],
  },
  {
    industry: "architecture & planning",
    matches: [
      { specializationCode: "WK_ARCHITECTURE", score: 5 },
      { specializationCode: "WK_FITOUT_CONTRACTOR", score: 3 },
    ],
  },
  {
    industry: "design",
    matches: [
      { specializationCode: "WK_BRANDING_STUDIO", score: 5 },
      { specializationCode: "WK_ARCHITECTURE", score: 3 },
    ],
  },
  {
    industry: "events services",
    matches: [
      { specializationCode: "WK_EVENT_COMPANY", score: 5 },
      { specializationCode: "WK_TRADESHOW_BUILDER", score: 3 },
    ],
  },
  {
    industry: "information technology & services",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
      { specializationCode: "WK_BRANDING_STUDIO", score: 1 },
    ],
  },
  {
    industry: "fine art",
    matches: [
      { specializationCode: "WK_BRANDING_STUDIO", score: 3 },
      { specializationCode: "PS_DISPLAY", score: 2 },
    ],
  },
  {
    industry: "graphic design",
    matches: [
      { specializationCode: "WK_BRANDING_STUDIO", score: 4 },
      { specializationCode: "PS_AGENCY", score: 3 },
    ],
  },
  {
    industry: "hospitality",
    matches: [
      { specializationCode: "WKK_HOSPITALITY", score: 5 },
      { specializationCode: "WKK_RETAIL_CHAIN", score: 3 },
    ],
  },
  {
    industry: "online media",
    matches: [
      { specializationCode: "PS_ONLINE_SELLER", score: 3 },
      { specializationCode: "PS_AGENCY", score: 3 },
    ],
  },
  {
    industry: "nonprofit organization management",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
      { specializationCode: "WKK_HOSPITALITY", score: 1 },
    ],
  },
  {
    industry: "printing",
    matches: [
      { specializationCode: "PS_LARGE_FORMAT_PRINT", score: 5 },
      { specializationCode: "PS_AD_PRODUCER", score: 3 },
    ],
  },
  {
    industry: "mental health care",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
      { specializationCode: "WKK_HOSPITALITY", score: 1 },
    ],
  },
  {
    industry: "leisure, travel & tourism",
    matches: [
      { specializationCode: "WKK_HOSPITALITY", score: 4 },
      { specializationCode: "WK_EVENT_COMPANY", score: 3 },
    ],
  },
  {
    industry: "retail",
    matches: [
      { specializationCode: "WKK_RETAIL_STORE", score: 5 },
      { specializationCode: "WKK_RETAIL_CHAIN", score: 4 },
    ],
  },
  {
    industry: "photography",
    matches: [
      { specializationCode: "WK_BRANDING_STUDIO", score: 3 },
      { specializationCode: "PS_AGENCY", score: 2 },
    ],
  },
  {
    industry: "investment management",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "wholesale",
    matches: [
      { specializationCode: "PS_ONLINE_SELLER", score: 3 },
      { specializationCode: "PS_FOREIGN_BROKER", score: 3 },
    ],
  },
  {
    industry: "import & export",
    matches: [
      { specializationCode: "PS_FOREIGN_BROKER", score: 5 },
    ],
  },
  {
    industry: "aviation & aerospace",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "real estate",
    matches: [
      { specializationCode: "WK_FITOUT_CONTRACTOR", score: 4 },
      { specializationCode: "WK_ARCHITECTURE", score: 3 },
    ],
  },
  {
    industry: "media production",
    matches: [
      { specializationCode: "PS_AGENCY", score: 3 },
      { specializationCode: "WK_EVENT_COMPANY", score: 3 },
    ],
  },
  {
    industry: "publishing",
    matches: [
      { specializationCode: "PS_AGENCY", score: 3 },
      { specializationCode: "WK_BRANDING_STUDIO", score: 3 },
    ],
  },
  {
    industry: "mechanical or industrial engineering",
    matches: [
      { specializationCode: "WK_POS_PRODUCER", score: 3 },
      { specializationCode: "WK_FURNITURE_PRODUCER", score: 2 },
    ],
  },
  {
    industry: "professional training & coaching",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "information services",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "building materials",
    matches: [
      { specializationCode: "WK_FITOUT_CONTRACTOR", score: 4 },
      { specializationCode: "WK_RETAIL_EQUIPMENT", score: 2 },
    ],
  },
  {
    industry: "environmental services",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "shipbuilding",
    matches: [
      { specializationCode: "WK_POS_PRODUCER", score: 2 },
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 1 },
    ],
  },
  {
    industry: "health, wellness & fitness",
    matches: [
      { specializationCode: "WKK_HOSPITALITY", score: 3 },
      { specializationCode: "WKK_RETAIL_STORE", score: 2 },
    ],
  },
  {
    industry: "telecommunications",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "packaging & containers",
    matches: [
      { specializationCode: "PS_AD_PRODUCER", score: 3 },
      { specializationCode: "WK_POS_PRODUCER", score: 3 },
    ],
  },
  {
    industry: "management consulting",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 4 },
    ],
  },
  {
    industry: "electrical/electronic manufacturing",
    matches: [
      { specializationCode: "WK_POS_PRODUCER", score: 3 },
      { specializationCode: "WK_RETAIL_EQUIPMENT", score: 2 },
    ],
  },
  {
    industry: "machinery",
    matches: [
      { specializationCode: "WK_POS_PRODUCER", score: 3 },
      { specializationCode: "WK_FURNITURE_PRODUCER", score: 2 },
    ],
  },
  {
    industry: "international trade & development",
    matches: [
      { specializationCode: "PS_FOREIGN_BROKER", score: 4 },
      { specializationCode: "PS_ONLINE_SELLER", score: 2 },
    ],
  },
  {
    industry: "oil & energy",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "outsourcing/offshoring",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "transportation/trucking/railroad",
    matches: [
      { specializationCode: "WKK_RETAIL_CHAIN", score: 3 },
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "security & investigations",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "apparel & fashion",
    matches: [
      { specializationCode: "WKK_CONSUMER_BRAND", score: 5 },
      { specializationCode: "WKK_RETAIL_CHAIN", score: 3 },
    ],
  },
  {
    industry: "textiles",
    matches: [
      { specializationCode: "PS_LARGE_FORMAT_PRINT", score: 3 },
      { specializationCode: "WK_RETAIL_EQUIPMENT", score: 3 },
    ],
  },
  {
    industry: "music",
    matches: [
      { specializationCode: "WK_EVENT_COMPANY", score: 3 },
      { specializationCode: "PS_AGENCY", score: 2 },
    ],
  },
  {
    industry: "financial services",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "writing & editing",
    matches: [
      { specializationCode: "PS_AGENCY", score: 3 },
    ],
  },
  {
    industry: "food & beverages",
    matches: [
      { specializationCode: "WKK_CONSUMER_BRAND", score: 4 },
      { specializationCode: "WKK_RETAIL_CHAIN", score: 3 },
    ],
  },
  {
    industry: "restaurants",
    matches: [
      { specializationCode: "WKK_HOSPITALITY", score: 5 },
      { specializationCode: "WKK_RETAIL_STORE", score: 3 },
    ],
  },
  {
    industry: "individual & family services",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
      { specializationCode: "WKK_HOSPITALITY", score: 1 },
    ],
  },
  {
    industry: "higher education",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "philanthropy",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
      { specializationCode: "WKK_HOSPITALITY", score: 1 },
    ],
  },
  {
    industry: "civil engineering",
    matches: [
      { specializationCode: "WK_FITOUT_CONTRACTOR", score: 4 },
      { specializationCode: "WK_TRADESHOW_BUILDER", score: 3 },
    ],
  },
  {
    industry: "automotive",
    matches: [
      { specializationCode: "WKK_AUTO_DEALER", score: 5 },
      { specializationCode: "WKK_RETAIL_CHAIN", score: 2 },
    ],
  },
  {
    industry: "consumer services",
    matches: [
      { specializationCode: "WKK_RETAIL_STORE", score: 3 },
      { specializationCode: "WKK_CONSUMER_BRAND", score: 2 },
    ],
  },
  {
    industry: "education management",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "mining & metals",
    matches: [
      { specializationCode: "WK_POS_PRODUCER", score: 2 },
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "legal services",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "luxury goods & jewelry",
    matches: [
      { specializationCode: "WKK_CONSUMER_BRAND", score: 4 },
      { specializationCode: "WKK_RETAIL_STORE", score: 3 },
    ],
  },
  {
    industry: "consumer electronics",
    matches: [
      { specializationCode: "WKK_CONSUMER_BRAND", score: 4 },
      { specializationCode: "WKK_RETAIL_CHAIN", score: 3 },
    ],
  },
  {
    industry: "computer games",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "paper & forest products",
    matches: [
      { specializationCode: "PS_LARGE_FORMAT_PRINT", score: 3 },
      { specializationCode: "WK_POS_PRODUCER", score: 2 },
    ],
  },
  {
    industry: "performing arts",
    matches: [
      { specializationCode: "WK_EVENT_COMPANY", score: 4 },
      { specializationCode: "WK_TRADESHOW_BUILDER", score: 2 },
    ],
  },
  {
    industry: "recreational facilities & services",
    matches: [
      { specializationCode: "WKK_HOSPITALITY", score: 4 },
      { specializationCode: "WK_EVENT_COMPANY", score: 2 },
    ],
  },
  {
    industry: "facilities services",
    matches: [
      { specializationCode: "WK_FITOUT_CONTRACTOR", score: 3 },
      { specializationCode: "WK_RETAIL_FITOUT", score: 2 },
    ],
  },
  {
    industry: "research",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "law practice",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "medical practice",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
      { specializationCode: "WKK_HOSPITALITY", score: 2 },
    ],
  },
  {
    industry: "government administration",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
      { specializationCode: "WKK_HOSPITALITY", score: 1 },
    ],
  },
  {
    industry: "warehousing",
    matches: [
      { specializationCode: "WKK_RETAIL_CHAIN", score: 3 },
      { specializationCode: "WKK_RETAIL_STORE", score: 2 },
    ],
  },
  {
    industry: "glass, ceramics & concrete",
    matches: [
      { specializationCode: "WK_FITOUT_CONTRACTOR", score: 3 },
      { specializationCode: "WK_POS_PRODUCER", score: 2 },
    ],
  },
  {
    industry: "international affairs",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
      { specializationCode: "WKK_HOSPITALITY", score: 1 },
    ],
  },
  {
    industry: "food production",
    matches: [
      { specializationCode: "WKK_CONSUMER_BRAND", score: 4 },
      { specializationCode: "WKK_RETAIL_CHAIN", score: 3 },
    ],
  },
  {
    industry: "animation",
    matches: [
      { specializationCode: "PS_AGENCY", score: 3 },
      { specializationCode: "WK_EVENT_COMPANY", score: 3 },
    ],
  },
  {
    industry: "internet",
    matches: [
      { specializationCode: "PS_ONLINE_SELLER", score: 3 },
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "insurance",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "sporting goods",
    matches: [
      { specializationCode: "WKK_CONSUMER_BRAND", score: 4 },
      { specializationCode: "WKK_RETAIL_STORE", score: 3 },
    ],
  },
  {
    industry: "banking",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "human resources",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "logistics & supply chain",
    matches: [
      { specializationCode: "WKK_RETAIL_CHAIN", score: 3 },
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "translation & localization",
    matches: [
      { specializationCode: "PS_AGENCY", score: 2 },
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 1 },
    ],
  },
  {
    industry: "consumer goods",
    matches: [
      { specializationCode: "WKK_CONSUMER_BRAND", score: 4 },
      { specializationCode: "WKK_RETAIL_STORE", score: 3 },
    ],
  },
  {
    industry: "libraries",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "e-learning",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "chemicals",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
      { specializationCode: "WK_POS_PRODUCER", score: 2 },
    ],
  },
  {
    industry: "computer hardware",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
      { specializationCode: "WKK_CONSUMER_BRAND", score: 2 },
    ],
  },
  {
    industry: "museums & institutions",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
      { specializationCode: "WKK_HOSPITALITY", score: 2 },
    ],
  },
  {
    industry: "renewables & environment",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "public safety",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
      { specializationCode: "WKK_HOSPITALITY", score: 1 },
    ],
  },
  {
    industry: "think tanks",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "staffing & recruiting",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "market research",
    matches: [
      { specializationCode: "PS_AGENCY", score: 3 },
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "airlines/aviation",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
      { specializationCode: "WKK_HOSPITALITY", score: 2 },
    ],
  },
  {
    industry: "plastics",
    matches: [
      { specializationCode: "WK_POS_PRODUCER", score: 3 },
      { specializationCode: "PS_AD_PRODUCER", score: 2 },
    ],
  },
  {
    industry: "hospital & health care",
    matches: [
      { specializationCode: "WKK_HOSPITALITY", score: 3 },
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "commercial real estate",
    matches: [
      { specializationCode: "WK_RETAIL_FITOUT", score: 4 },
      { specializationCode: "WK_FITOUT_CONTRACTOR", score: 4 },
    ],
  },
  {
    industry: "program development",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "religious institutions",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
      { specializationCode: "WKK_HOSPITALITY", score: 1 },
    ],
  },
  {
    industry: "medical devices",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
      { specializationCode: "WKK_CONSUMER_BRAND", score: 2 },
    ],
  },
  {
    industry: "business supplies & equipment",
    matches: [
      { specializationCode: "PS_AD_PRODUCER", score: 3 },
      { specializationCode: "WK_POS_PRODUCER", score: 3 },
    ],
  },
  {
    industry: "government relations",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "computer & network security",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "semiconductors",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "farming",
    matches: [
      { specializationCode: "WKK_CONSUMER_BRAND", score: 2 },
      { specializationCode: "WKK_RETAIL_CHAIN", score: 2 },
    ],
  },
  {
    industry: "fund-raising",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "veterinary",
    matches: [
      { specializationCode: "WKK_HOSPITALITY", score: 2 },
      { specializationCode: "WKK_RETAIL_STORE", score: 2 },
    ],
  },
  {
    industry: "defense & space",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "arts & crafts",
    matches: [
      { specializationCode: "PS_DISPLAY", score: 3 },
      { specializationCode: "WK_BRANDING_STUDIO", score: 2 },
    ],
  },
  {
    industry: "law enforcement",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "railroad manufacture",
    matches: [
      { specializationCode: "WK_POS_PRODUCER", score: 3 },
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "venture capital & private equity",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "industrial automation",
    matches: [
      { specializationCode: "WK_POS_PRODUCER", score: 3 },
      { specializationCode: "WK_RETAIL_EQUIPMENT", score: 3 },
    ],
  },
  {
    industry: "capital markets",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "cosmetics",
    matches: [
      { specializationCode: "WKK_CONSUMER_BRAND", score: 4 },
      { specializationCode: "WKK_RETAIL_STORE", score: 3 },
    ],
  },
  {
    industry: "maritime",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "package/freight delivery",
    matches: [
      { specializationCode: "WKK_RETAIL_CHAIN", score: 3 },
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "dairy",
    matches: [
      { specializationCode: "WKK_CONSUMER_BRAND", score: 3 },
      { specializationCode: "WKK_RETAIL_CHAIN", score: 2 },
    ],
  },
  {
    industry: "executive office",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "wine & spirits",
    matches: [
      { specializationCode: "WKK_CONSUMER_BRAND", score: 4 },
      { specializationCode: "WKK_RETAIL_STORE", score: 3 },
    ],
  },
  {
    industry: "broadcast media",
    matches: [
      { specializationCode: "PS_AGENCY", score: 4 },
      { specializationCode: "WK_EVENT_COMPANY", score: 3 },
    ],
  },
  {
    industry: "computer networking",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 3 },
    ],
  },
  {
    industry: "utilities",
    matches: [
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "pharmaceuticals",
    matches: [
      { specializationCode: "WKK_CONSUMER_BRAND", score: 4 },
      { specializationCode: "WKK_OFFICE_CORPORATE", score: 2 },
    ],
  },
  {
    industry: "gambling & casinos",
    matches: [
      { specializationCode: "WKK_HOSPITALITY", score: 4 },
      { specializationCode: "WK_EVENT_COMPANY", score: 3 },
    ],
  },
];
