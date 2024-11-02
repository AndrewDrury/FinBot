export const GPT_MODEL_NAME = "gpt-3.5-turbo";

export const FMP_BASE_URL = "https://financialmodelingprep.com/api/v3";

export const FMP_ENDPOINT_NAMES: { [id: string] : string } = {
    earnings_call_transcript: "Earning Call Transcript",
    income_statement: "Income Statements",
    company_profile: "Company Profile",
    analyst_estimates: "Analyst Estimates",
    company_notes: "Company Notes",
    sec_filings: "SEC Filings",
    press_releases: "Press Releases",
  };

export const FMP_ENDPOINTS = {
  earnings_call_transcript: {
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
  press_releases: {
    endpoint: "/press-releases/{symbol}",
    keywords: ["news", "announcement", "update", "press"],
  },
};

export type EndpointKey = keyof typeof FMP_ENDPOINTS;
