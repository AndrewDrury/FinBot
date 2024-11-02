/* eslint-disable @typescript-eslint/no-unused-vars */
import OpenAI from "openai/index.mjs";
import type { NextApiRequest, NextApiResponse } from "next";
import { FMP_ENDPOINTS, GPT_MODEL_NAME } from '@/lib/constants';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// extract all possible company names from query, also extract supported FMP entities like stocks, etfs, etc.
async function extractCompanies(query: string): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: GPT_MODEL_NAME,
    messages: [
      {
        role: "system",
        content: `You are a financial company name and entity extractor.
          Extract all possible *company* names associated with entities mentioned in the query. Do not include personal names (e.g., "Bill Gates").
          If the query includes a prominent individual related to a company (e.g., CEO, founder), return their associated company instead (e.g., "Apple" for Tim Cook, "Spotify" for Daniel Ek.
          Extract all company names, symbol names, forex, stocks, ETFs, and other financial instruments mentioned in the query.
          Return a JSON object with a single "companies" array containing all of the extracted names defined above. For example:
          {
              "companies": ["Amazon", "Apple", "Nvidia", "Meta"]
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

// Get list of relevant FMP endpoints to query based off matching key words in user's query
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query } = req.body;
    const [companies, endpoints] = await Promise.all([
      extractCompanies(query),
      Promise.resolve(getRelevantEndpoints(query))
    ]);

    return res.status(200).json({ companies, endpoints });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      error: "Failed to extract companies",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
