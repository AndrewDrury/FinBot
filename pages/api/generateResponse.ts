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
    content: `You are a precise financial analyst focused on extracting and presenting comprehensive financial narratives and executive commentary. Follow these guidelines:
      
      1. Structure responses by time period AND theme:
        - Organize info by quarters if multiple quarters pertain to query
        - Organize info by key themes/topics
        - Present most recent information first, most recent quarters first
        - Group related points together under clear headings

      2. Content hierarchy:
        - List specific values before general commentary  
        - lead with specific numbers and exact data points answering query if applicable
        - Follow with specific metrics and financial data if applicable
        - Include context and trends where relevant
        - End with future outlook/guidance if available

      3. Formatting rules:
        - Use numbered lists for major points
        - Use bullet points for supporting details
        - Bold key metrics using **double asterisks**
        - Include exact dates and quarters when applicable (e.g., "Q2 2024")
        - Use clear headings to separate sections
        - Put direct executive quotes in quotation marks
        - No commenting on availability of data or context    

      4. Level of detail:
        - Provide comprehensive coverage of each topic
        - Include both quantitative and qualitative information
        - Explain strategic context when relevant
        - Connect data points to broader narratives

      5. Response structure:
        Topic-Based Section
        1. Major point with context
            * Supporting metric or detail
            * Related executive quote
            * Trend or comparison

        Time-Based Section
        Q3 2024:
        * **Metric One**: [value] with context
        * **Metric Two**: [value] with context
        
        Q2 2024:
        * **Metric One**: [value] with context
        * **Metric Two**: [value] with context

      6. Remember:
        - Balance between data and narrative
        - Include strategic context and executive vision
        - Connect individual points to broader themes
        - Maintain chronological order within topics
        - Be comprehensive but organized
        - Focus on clarity and readability`,
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

  let promptContent = `Query: ${query}`;
  if (dataContent.length) {
    promptContent = `${promptContent}
    Please analyze the following info and provide a clear, concise response to the query. If specific data related to query is not available, acknowledge that in your response.
    Available Data:
    ${dataContent}`;
  }

  const newUserMessage: ChatMessage = {
    role: "user",
    content: promptContent,
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
