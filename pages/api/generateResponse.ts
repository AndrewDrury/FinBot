/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from "openai/index.mjs";
import type { NextApiRequest, NextApiResponse } from "next";
import { GPT_MODEL_NAME } from "@/lib/constants";

const CHARS_PER_TOKEN = 4;
const MAX_TOKENS = GPT_MODEL_NAME.includes("gpt-4") ? 32768 : 16385;
const MAX_CHARACTERS = MAX_TOKENS * CHARS_PER_TOKEN;
// Reserve some tokens for the response
const MAX_PROMPT_CHARS = Math.floor(MAX_CHARACTERS * 0.8);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CompanyData {
  name: string;
  symbol: string;
  data: Record<string, any>;
  characterCount: number;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

function trimData(obj: any, maxSize: number): string {
  const stringified = JSON.stringify(obj, null, 0);
  return stringified.slice(0, maxSize);
}

function formulatePrompt(
  query: string,
  companiesData: CompanyData[] | null | undefined,
  previousMessages: ChatMessage[]
): ChatMessage[] {
  const systemMessage: ChatMessage = {
    role: "system",
    content: `You are a sophisticated financial analyst with expertise in interpreting various types of financial data. 
      Focus on specifically answering the user's question.
      Format your response in a clear, structured way using markdown, bolding key words.
      Support your statements with specific data points when available.`,
  };

  let dataContent = "";
  if (Array.isArray(companiesData) && companiesData.length > 0) {
    // Calculate max chars per company accounting for previous messages given prompt char limit
    const previousMessagesChars = previousMessages.reduce(
      (sum, msg) => sum + msg.content.length,
      0
    );
    const availableChars = MAX_PROMPT_CHARS - previousMessagesChars - systemMessage.content.length;
    const charsPerCompany = Math.floor((availableChars / companiesData.length) * 0.98);

    // Trim company data if necessary
    const trimmedCompaniesData = companiesData.map((company) => {
      if (company.characterCount > charsPerCompany) {
        const trimmedDataString = trimData(company.data, charsPerCompany);
        return {
          name: company.name,
          characterCount: company.characterCount,
          symbol: company.symbol,
          data: trimmedDataString,
        };
      }
      return company;
    });

    dataContent = `\nAvailable Data:\n${
      trimmedCompaniesData
        .map(company => 
          `${company.name} (${company.symbol})\n${JSON.stringify(company.data, null, 2)}`
        )
        .join("\n\n")
    }`;
  }

  const newUserMessage: ChatMessage = {
    role: "user",
    content: `Query: ${query}${dataContent}`,
  };

  // Construct messages array with history
  const messages: ChatMessage[] = [systemMessage];

  // Add previous messages while checking total length
  let totalChars = systemMessage.content.length + newUserMessage.content.length;
  
  // Add messages from newest to oldest until we hit the limit
  for (let i = previousMessages.length - 1; i >= 0; i--) {
    const msg = previousMessages[i];
    if (totalChars + msg.content.length <= MAX_PROMPT_CHARS) {
      messages.push(msg);
      totalChars += msg.content.length;
    } else {
      break;
    }
  }

  // Add the new user message last
  messages.push(newUserMessage);

  return messages;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query, companiesData, messageHistory = [] } = req.body;

    // Formulate messages array with history
    const messages = formulatePrompt(query, companiesData, messageHistory);

    // Generate final response from OpenAI
    const finalResponse = await openai.chat.completions.create({
      model: GPT_MODEL_NAME,
      messages,
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