/* eslint-disable @typescript-eslint/no-unused-vars */
import OpenAI from "openai/index.mjs";
import type { NextApiRequest, NextApiResponse } from "next";
import { FMP_ENDPOINTS } from "@/lib/constants";
import {
  tokenizeText,
  findKeywordMatches,
} from "@/lib/utils/nlpHelperFunctions";
import { OpenAIModelType } from "@/app/components/Header";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TimePeriod {
  year: number;
  quarter?: string;
}

// 1. extract all possible company names from query
// 2. extract all possible time periods from query
async function extractInfo(
  query: string,
  selectedGptModel: OpenAIModelType
): Promise<{ companies: string[]; timePeriods: TimePeriod[] }> {
  const response = await openai.chat.completions.create({
    model: selectedGptModel as string,
    messages: [
      {
        role: "system",
        content: `You are a financial company name and time period extractor.
          1. Extract all possible *company* stock symbols associated with entities mentioned in the query. Do not include personal names (e.g., "Bill Gates").
          If the query includes a individual related to a company (e.g., CEO, founder, employee), return their associated company instead (e.g., "AAPL" for Tim Cook, "SPOT" for Daniel Ek.)
          Extract all company stock symbols, forex, ETFs, and other financial instruments mentioned in the query, always prioritizing retrieving company symbol over all other entities.
          
           2. Extract time periods inferred from the query as list of {year: number, quarter?: string}:
             - year field must be a number like 2024, quarter is optional and must be one of: 'Q1' | 'Q2' | 'Q3' | 'Q4'. no other string or param is allowed in the json response
             - Specific quarters (Q1 2024, first quarter 2022, last quarter)
             - Specific year(s) (2024, 1995)
             - Ranges (2021-2024 -> 2010, 2021, 2024)
             - Recent terms should return the current year with a few recent quarters (recent earnings call, latest comments, last few talks, new deals etc.)
             - Relative terms should return the inferred year and quarter (this year, last quarter, this quarter)
             - do not extract duplicate or overlapping time periods
             - extract up to 4 time periods maximum ordered by newest
          
          Return a JSON object with extracted companies and time periods:
          {
              "companies": ["AMZN", "AAPL", "NVDA", "META"],
              "timePeriods": [
                {"year": 2024, "quarter": "Q3"},
                {"year": 2024, "quarter": "Q2"},
                {"year": 2024, "quarter": "Q1"},
                {"year": 2023, "quarter": "Q4"},
              ],
          }
          example:
          {
              "companies": ["KO", "PEP"],
              "timePeriods": [
                {"year": 2024},
              ],
          }
          example:
          {
              "companies": ["WMT"],
              "timePeriods": [
                {"year": 2024},
                {"year": 2023, "quarter": "Q4"},
              ],
          }
          If nothing can be found, return empty companies and timePeriods:
          {
              "companies": [],
               "timePeriods": [], 
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
    if (!content) return { companies: [], timePeriods: [] };

    const currentDate = new Date();

    const parsedContent = JSON.parse(content);
    return {
      companies: parsedContent.companies || [],
      timePeriods: parsedContent.timePeriods || [
        { year: currentDate.getFullYear() },
      ], //return current year if no time period inferred
    };
  } catch (error) {
    console.error("Error parsing companies:", error);
    return { companies: [], timePeriods: [] };
  }
}

// Get list of relevant FMP endpoints to query based off matching key words in user's query
async function getRelevantEndpoints(query: string): Promise<string[]> {
  const queryWords = tokenizeText(query);

  const endpointMatches = await Promise.all(
    Object.entries(FMP_ENDPOINTS).map(async ([endpoint, info]) => {
      const matches = await findKeywordMatches(queryWords, info.keywords);
      return {
        endpoint,
        matchCount: matches.size,
      };
    })
  );

  // Return endpoints that had at least one match, sorted by number of matches
  return endpointMatches
    .filter((match) => match.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
    .map((match) => match.endpoint);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query, selectedGptModel } = req.body;
    const [{ companies, timePeriods }, endpoints] = await Promise.all([
      extractInfo(query, selectedGptModel),
      getRelevantEndpoints(query),
    ]);

    return res.status(200).json({ companies, endpoints, timePeriods });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      error: "Failed to extract companies",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
