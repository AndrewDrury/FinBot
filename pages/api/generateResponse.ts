/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from "openai/index.mjs";
import type { NextApiRequest, NextApiResponse } from "next";
import { GPT_MODEL_NAME } from "@/lib/constants";

const CHARS_PER_TOKEN = 4;
const MAX_TOKENS = GPT_MODEL_NAME.includes("gpt-4") ? 32768 : 16385;
const MAX_CHARACTERS = MAX_TOKENS * CHARS_PER_TOKEN;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CompanyData {
  name: string;
  symbol: string;
  data: Record<string, any>;
  characterCount: number;
}

function trimData(obj: any, maxSize: number): string {
  const stringified = JSON.stringify(obj, null, 0);
  return stringified.slice(0, maxSize);
}

function formulatePrompt(query: string, companiesData: CompanyData[]): string {
  let promptContent = `Query: ${query}`;

  if (companiesData && companiesData.length) {
    // Calculate max chars per company to maintain fairness and include a 98% limit safety margin, remove 192 characters already in prompt
    const charsPerCompany = Math.floor(
      ((MAX_CHARACTERS - 200) / companiesData.length) * 0.98
    );

    // Trim company data if necessary and build prompt
    const trimmedCompaniesData = companiesData.map((company) => {
      if (company.characterCount > charsPerCompany) {
        const trimmedDataString = trimData(company.data, charsPerCompany);
        return {
          ...company,
          data: trimmedDataString,
        };
      }
      return company;
    });

    if (trimmedCompaniesData.length) {
      // Construct the prompt
      promptContent = `${promptContent}
            Please analyze the following info and provide a clear, concise response to the query. If specific data related to query is not available, acknowledge that in your response.
            Available Data:
            ${JSON.stringify(
              trimmedCompaniesData
                .map(
                  (company) => `
                ${company.name} (${company.symbol})
                ${company.data}
                `
                )
                .join("\n")
            )}`;
    }
  }

  // Final safety check - fallback in case limit is exceeded
  return promptContent.length > MAX_CHARACTERS
    ? promptContent.slice(0, MAX_CHARACTERS)
    : promptContent;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query, companiesData } = req.body;

    // formulate final prompt to send to OpenAI to generate response
    const promptContent = formulatePrompt(query, companiesData);

    // Generate final response from OpenAI
    const finalResponse = await openai.chat.completions.create({
      model: GPT_MODEL_NAME,
      messages: [
        {
          role: "system",
          content: `You are a sophisticated financial analyst with expertise in interpreting various types of financial data. 
            Focus on specifically answering the user's question.
            Format your response in a clear, structured way using markdown, bolding key words.
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
