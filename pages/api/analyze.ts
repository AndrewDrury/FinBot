/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from "openai/index.mjs";
import type { NextApiRequest, NextApiResponse } from "next";

const FMP_API_KEY = process.env.FMP_API_KEY;
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const fmp_base_url = "https://financialmodelingprep.com/api/v3";
const selectedGptModel = "gpt-3.5-turbo";

const FMP_ENDPOINTS = {
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
    keywords: ["about", "overview", "company", "background", "description"],
  },
  press_releases: {
    endpoint: "/press-releases/{symbol}",
    keywords: ["news", "announcement", "recent", "update", "press"],
  },
  key_executives: {
    endpoint: "/key-executives/{symbol}",
    keywords: ["management", "executive", "CEO", "leadership", "board"],
  },
  analyst_estimates: {
    endpoint: "/analyst-estimates/{symbol}",
    keywords: ["forecast", "estimate", "prediction", "outlook", "guidance"],
  },
  company_notes: {
    endpoint: "/company-notes/{symbol}",
    keywords: ["notes", "details", "information", "specifics"],
  },
  stock_news: {
    endpoint: "/stock_news?tickers={symbol}",
    keywords: ["news", "recent", "update", "development"],
  },
  sec_filings: {
    endpoint: "/sec_filings/{symbol}",
    keywords: ["filing", "SEC", "report", "document", "regulatory"],
  },
};

interface CompanyInfo {
    name: string;
    symbol: string;
}

// exctract all possible company names from query, also extract supported FMP entities like stocks, etfs, etc.
async function extractCompanies(query: string): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: selectedGptModel,
    messages: [
      {
        role: "system",
        content: `You are a financial company name and entity extractor.
        Extract all possible *company* names associated with entities mentioned in the query. Do not include personal names (e.g., "Bill Gates").
        
        If the query includes a prominent individual related to a company (e.g., CEO, founder), return their associated company instead (e.g., "Apple" for Tim Cook, "Spotify" for Daniel Ek.
        
        Extract all symbol names, cryptocurrencies, forex, stocks, ETFs, and other financial instruments mentioned in the query.
        
        Return a JSON object with a single "companies" array containing all of the extracted names defined above. For example:
        {
            "companies": ["Amazon", "Apple", "NVDA"]
        }
        
        If nothing can be found, return:
        {
            "companies": []
        }`,
      },
      {
        role: "user",
        content: query,
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  try {
    const content = response.choices[0].message.content;
    if (!content) return [];

    const parsedContent = JSON.parse(content);
    const entities = Object.values(parsedContent).find(Array.isArray) || [];
    return entities;
  } catch (error) {
    console.error("Error parsing companies:", error);
    return [];
  }
}

async function getRelevantEndpoints(query: string): Promise<string[]> {
  const lowercaseQuery = query.toLowerCase();
  return Object.entries(FMP_ENDPOINTS)
    .filter(([_, info]) =>
      info.keywords.some((keyword) =>
        lowercaseQuery.includes(keyword.toLowerCase())
      )
    )
    .map(([endpoint, _]) => endpoint);
}

async function fetchFMPData(symbol: string, endpoints: string[]): Promise<any> {
  const data: any = {};

  for (const endpoint of endpoints) {
    const endpointInfo = FMP_ENDPOINTS[endpoint as keyof typeof FMP_ENDPOINTS];
    if (!endpointInfo) continue;

    try {
      const url = `${fmp_base_url}${endpointInfo.endpoint.replace(
        "{symbol}",
        symbol
      )}?apikey=${FMP_API_KEY}`;
      const response = await fetch(url);
      const result = await response.json();
      data[endpoint] = result;
      console.log('result', result)
    } catch (error) {
      console.error(`Error fetching ${endpoint} for ${symbol}:`, error);
    }
  }

  return data;
}

async function searchCompany(company: string): Promise<CompanyInfo | null> {
  try {
    const response = await fetch(
      `${fmp_base_url}/search?query=${encodeURIComponent(
        company
      )}&limit=1&apikey=${FMP_API_KEY}`
    );
    const data = await response.json();

    if (data.length > 0) {
      return {
        name: data[0].name,
        symbol: data[0].symbol,
      };
    }
  } catch (error) {
    console.error(`Error searching for company ${company}:`, error);
  }
  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query } = req.body;

    // Extract all potential companies or other financial entities
    const companies = await extractCompanies(query);

    // Find relevant FMP endpoints based on query
    const relevantEndpoints = await getRelevantEndpoints(query);

    // Gather data for all companies
    const companiesData = [];
    for (const company of companies) {
      const companyInfo: CompanyInfo | null = await searchCompany(company);
      if (companyInfo) {
        const data = await fetchFMPData(companyInfo.symbol, relevantEndpoints);
        companiesData.push({
          data,
          ...companyInfo,
        });
      }
    }

    if (companiesData.length === 0) {
      return res.status(404).json({ error: "No entity info found" });
    }

    // formulate final prompt to send to OpenAI to generate response
    const promptContent = 
    `Query: ${query}
        Available Data:
        ${companiesData
          .map(
            (company) => `
            ${company.name} (${company.symbol})
            ${Object.entries(company.data)
            .map(
                ([endpoint, data]) => `
            ${endpoint.replace(/_/g, " ").toUpperCase}:
            ${JSON.stringify(data, null, 2)}
            `
            ).join("\n")}`
        ).join("\n")}
        Please analyze this information and provide a clear, concise response to the query. If specific data is not available, acknowledge that in your response.
    `;

    // Generate final response from OpenAI
    const finalResponse = await openai.chat.completions.create({
      model: selectedGptModel,
      messages: [
        {
          role: "system",
          content: `You are a sophisticated financial analyst with expertise in interpreting various types of financial data. 
            Focus on specifically answering the user's question.
            Format your response in a clear, structured way using markdown when appropriate.
            Support your statements with specific data points when available.`,
        },
        {
          role: "user",
          content: promptContent,
        },
      ],
      temperature: 0.5,
    });

    return res.status(200).json({
      result: finalResponse.choices[0].message.content,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return res.status(500).json({
      error: "Failed to process request",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
