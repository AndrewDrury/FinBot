/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from "openai/index.mjs";
import type { NextApiRequest, NextApiResponse } from "next";
import { OpenAIModelType } from "@/app/components/Header";

const CHARS_PER_TOKEN = 4;

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

function trimData(obj: any, maxSize: number): CompanyData {
  if (obj.data?.earning_call_transcript) {
    return trimTranscripts(obj, maxSize);
  }

  const stringified = JSON.stringify(obj, null, 0);
  return {
    ...obj,
    data: JSON.parse(stringified.slice(0, maxSize)),
  };
}

function trimTranscripts(
  companyData: CompanyData,
  maxCharsPerCompany: number
): CompanyData {
  if (!companyData.data.earning_call_transcript) {
    return companyData;
  }

  // Sort transcripts by date in desc order (most recent first)
  const sortedTranscripts = [...companyData.data.earning_call_transcript].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Calculate how many characters to allocate per transcript
  const numTranscripts = sortedTranscripts.length;

  const metadataBuffer = JSON.stringify({
    name: companyData.name,
    symbol: companyData.symbol,
    data: { earning_call_transcript: [] },
  }).length;

  const charsPerTranscript = Math.floor(
    (maxCharsPerCompany - metadataBuffer) / numTranscripts
  );

  // Trim each transcript
  const trimmedTranscripts = sortedTranscripts.map((transcript) => {
    // find space needed for transcript metadata
    const transcriptMetadata = {
      symbol: transcript.symbol,
      quarter: transcript.quarter,
      year: transcript.year,
      date: transcript.date,
      content: "",
    };
    const transcriptMetadataSize = JSON.stringify(transcriptMetadata).length;

    // find available space for content
    const maxContentLength = charsPerTranscript - transcriptMetadataSize;

    return {
      ...transcript,
      content: transcript.content.slice(0, maxContentLength),
    };
  });

  // Create new company data object with trimmed transcripts
  const trimmedCompanyData = {
    ...companyData,
    data: {
      ...companyData.data,
      earning_call_transcript: trimmedTranscripts,
    },
  };

  const newCharacterCount = JSON.stringify(trimmedCompanyData).length;

  return {
    ...trimmedCompanyData,
    characterCount: newCharacterCount,
  };
}

function formulatePrompt(
  query: string,
  companiesData: CompanyData[] | null | undefined,
  previousMessages: ChatMessage[],
  selectedGptModel: OpenAIModelType
): ChatMessage[] {
  const maxTokens = selectedGptModel.includes("gpt-4") ? 32768 : 16385;
  const maxCharacters = maxTokens * CHARS_PER_TOKEN;
  // Reserve some tokens for the response
  const maxPromptCharacters = Math.floor(maxCharacters * 0.8);

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
    const availableChars =
      maxPromptCharacters -
      previousMessagesChars -
      systemMessage.content.length;
    const charsPerCompany = Math.floor(availableChars / companiesData.length);

    // Trim company data if necessary
    const trimmedCompaniesData = companiesData.map((company) => {
      if (company.characterCount > charsPerCompany) {
        const trimmedData = trimData(company, charsPerCompany);
        return trimmedData;
      }
      return company;
    });

    dataContent = `\nAvailable Data:\n${trimmedCompaniesData
      .map(
        (company) =>
          `${company.name} (${company.symbol})\n${JSON.stringify(
            company.data,
            null,
            2
          )}`
      )
      .join("\n\n")}`;
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
    if (totalChars + msg.content.length <= maxPromptCharacters) {
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
    const {
      query,
      companiesData,
      messageHistory = [],
      selectedGptModel,
    } = req.body;

    // Formulate messages array with history
    const messages = formulatePrompt(
      query,
      companiesData,
      messageHistory,
      selectedGptModel
    );

    // Generate final response from OpenAI
    const finalResponse = await openai.chat.completions.create({
      model: selectedGptModel,
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
