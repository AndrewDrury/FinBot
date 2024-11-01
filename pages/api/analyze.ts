import OpenAI from "openai/index.mjs";
import type { NextApiRequest, NextApiResponse } from "next";

const FMP_API_KEY = process.env.FMP_API_KEY;
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const selectedGptModel = 'gpt-3.5-turbo'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log(req.body)
    const { query } = req.body;
    console.log("query:", query, process.env.OPENAI_API_KEY);

    // Extract company name from query using OpenAI
    const analysisResponse = await openai.chat.completions.create({
      model: selectedGptModel,
      messages: [
        {
          role: "system",
          content:
            "You are a financial analyst assistant. Your response should include only the company name extracted from the user's query. Format it like this: 'Company Name: <company name>' If no company name is detected, respond with 'Company Name: N/A'",
        },
        {
          role: "user",
          content: query,
        },
      ],
      temperature: 0.3,
    });

    const analysis = analysisResponse.choices[0].message.content;
    console.log("analysisResponse", analysisResponse);
    console.log("analysis", analysis);

    // Parse the company name from the analysis
    const companyNameMatch = analysis?.match(/Company Name:?\s*([^\.\n]+)/i);
    const companyName = companyNameMatch ? companyNameMatch[1].trim() : null;
    console.log("companyNameMatch", companyNameMatch, companyName);

    if (!companyName) {
      return res
        .status(400)
        .json({ error: "Could not identify company name in query" });
    }

    // formulate final prompt to send to OpenAI to generate response
    let promptContent = `Query: ${query}`

    // Fetch relevant data from FMP
    if (companyName !== "N/A") {
        // Get company symbol from FMP
        const symbolResponse = await fetch(
          `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(
            companyName
          )}&limit=1&apikey=${FMP_API_KEY}`
        );
        const symbolData = await symbolResponse.json();
    
        if (!symbolData.length) {
          return res.status(404).json({ error: "Company not found" });
        }
    
        const symbol = symbolData[0].symbol;
    
        // Fetch earnings call transcripts
        const transcriptsResponse = await fetch(
          `https://financialmodelingprep.com/api/v3/earning_call_transcript/${symbol}?apikey=${FMP_API_KEY}`
        );
        const transcripts = await transcriptsResponse.json();
    
        // Get financial metrics
        const metricsResponse = await fetch(
          `https://financialmodelingprep.com/api/v3/income-statement/${symbol}?limit=4&apikey=${FMP_API_KEY}`
        );
        const metrics = await metricsResponse.json();
        console.log("metricsResponse", metricsResponse, metrics);
    
        // Add FMP data on given company to prompt
        promptContent.concat(`
          Company: ${companyName} (${symbol})
          
          Latest Earnings Call Transcripts:
          ${JSON.stringify(transcripts.slice(0, 2))}
          
          Recent Financial Metrics:
          ${JSON.stringify(metrics[0])}
          
          Please analyze this information and provide a clear, concise response to the query.
        `)
    }

    // Generate final response from OpenAI
    const finalResponse = await openai.chat.completions.create({
      model: selectedGptModel,
      messages: [
        {
          role: "system",
          content:
            "You are a financial analyst. Provide a clear, concise answer based on the provided data.",
        },
        {
          role: "user",
          content: promptContent,
        },
      ],
      temperature: 0.5,
    });
    console.log("finalResponse", finalResponse);


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
