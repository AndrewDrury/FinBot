export const DEFAULT_GPT_MODEL = "gpt-3.5-turbo";

export const FMP_BASE_URL = "https://financialmodelingprep.com/api";

export const FMP_ENDPOINT_NAMES: { [id: string]: string } = {
  earning_call_transcript: "Earning Call Transcript",
  income_statement: "Income Statements",
  company_profile: "Company Profile",
  analyst_estimates: "Analyst Estimates",
  company_notes: "Company Notes",
  sec_filings: "SEC Filings",
};

export const FMP_ENDPOINTS = {
  earning_call_transcript: {
    endpoint: "/earning_call_transcript/{symbol}",
    keywords: [
      "call",
      "conference",
      "earnings",
      "said",
      "mentioned",
      "commented",
      "statement",
      "announcement",
      "comments",
      "quarter",
      "deals",
    ],
  },
  income_statement: {
    endpoint: "/income-statement/{symbol}",
    keywords: [
      "revenue",
      "profit",
      "income",
      "earnings",
      "margin",
      "financial",
      "performance",
    ],
  },
  company_profile: {
    endpoint: "/profile/{symbol}",
    keywords: ["overview", "background", "describe"],
  },
  analyst_estimates: {
    endpoint: "/analyst-estimates/{symbol}",
    keywords: ["forecast", "estimate", "prediction", "outlook", "guidance"],
  },
  company_notes: {
    endpoint: "/company-notes/{symbol}",
    keywords: ["notes", "details", "information", "specifics"],
  },
  sec_filings: {
    endpoint: "/sec_filings/{symbol}",
    keywords: ["filing", "SEC", "report", "document", "regulatory"],
  },
};

export type EndpointKey = keyof typeof FMP_ENDPOINTS;

export const EXAMPLE_PROMPTS = [
  "Summarize Spotify's latest conference call.",
  "What has Airbnb management said about profitability over the last few earnings calls?",
  "What are Mark Zuckerberg's and Satya Nadella's recent comments about AI?",
  "How many new large deals did ServiceNow sign in the last quarter?",
];
