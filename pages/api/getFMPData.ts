/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next";
import { FMP_BASE_URL, FMP_ENDPOINTS, type EndpointKey } from "@/lib/constants";

const FMP_API_KEY = process.env.FMP_API_KEY;

interface CompanyInfo {
  name: string;
  symbol: string;
}

interface TimePeriod {
  year: number;
  quarter?: string;
}

async function fetchEarningTranscriptData(
  symbol: string,
  timePeriod: TimePeriod
): Promise<any> {
  try {
    // If quarter is specified, use specific quarter endpoint first
    if (
      timePeriod.quarter &&
      ["Q1", "Q2", "Q3", "Q4"].includes(timePeriod.quarter)
    ) {
      const quarterNum = parseInt(timePeriod.quarter.slice(1));
      const quarterUrl = `${FMP_BASE_URL}/v3/earning_call_transcript/${symbol}?year=${timePeriod.year}&quarter=${quarterNum}&apikey=${FMP_API_KEY}`;

      const quarterResponse = await fetch(quarterUrl);
      const quarterJsonResponse = await quarterResponse.json();

      // If quarter endpoint returns empty array, fall back to year endpoint
      if (
        Array.isArray(quarterJsonResponse) &&
        quarterJsonResponse.length === 0
      ) {
        const yearUrl = `${FMP_BASE_URL}/v4/batch_earning_call_transcript/${symbol}?year=${timePeriod.year}&apikey=${FMP_API_KEY}`;
        const yearResponse = await fetch(yearUrl);
        const yearJsonResponse = await yearResponse.json();
        return yearJsonResponse;
      }

      return quarterJsonResponse;
    }
    // If only year is specified, use batch endpoint
    else {
      const currentDate = new Date();
      const url = `${FMP_BASE_URL}/v4/batch_earning_call_transcript/${symbol}?year=${
        timePeriod.year ?? currentDate.getFullYear()
      }&apikey=${FMP_API_KEY}`;
      const response = await fetch(url);
      const jsonResponse = await response.json();
      return jsonResponse;
    }
  } catch (error) {
    console.error(`Error fetching transcript for ${symbol}:`, error);
    return null;
  }
}

async function fetchFMPData(
  symbol: string,
  endpoints: EndpointKey[],
  timePeriods: TimePeriod[]
): Promise<any> {
  const data: any = {};

  for (const endpoint of endpoints) {
    const endpointInfo = FMP_ENDPOINTS[endpoint as keyof typeof FMP_ENDPOINTS];
    if (!endpointInfo) continue;

    // call earning call transcripts using time periods
    if (endpoint === "earning_call_transcript") {
      data[endpoint] = [];
      for (const period of timePeriods) {
        const transcriptData = await fetchEarningTranscriptData(symbol, period);
        if (transcriptData) {
          if (Array.isArray(transcriptData)) {
            data[endpoint].push(...transcriptData);
          } else {
            data[endpoint].push(transcriptData);
          }
        }
      }
      continue;
    }

    // other endpoints
    try {
      const url = `${FMP_BASE_URL}${endpointInfo.endpoint.replace(
        "{symbol}",
        symbol
      )}?apikey=${FMP_API_KEY}`;
      const response = await fetch(url);
      const result = await response.json();
      data[endpoint] = result;
    } catch (error) {
      console.error(`Error fetching ${endpoint} for ${symbol}:`, error);
    }
  }
  return data;
}

async function searchCompany(company: string): Promise<CompanyInfo | null> {
  try {
    const response = await fetch(
      `${FMP_BASE_URL}/v3/search?query=${encodeURIComponent(
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
    const { companies, endpoints, timePeriods } = req.body;

    // Gather data for all companies
    const companiesData = await Promise.all(
      companies.map(async (company: string) => {
        const companyInfo = await searchCompany(company);
        if (!companyInfo) return null;

        const data = await fetchFMPData(
          companyInfo.symbol,
          endpoints,
          timePeriods
        );
        const companyData = {
          data,
          ...companyInfo,
        };
        const characterCount = JSON.stringify(companyData).length;
        return { ...companyInfo, data, characterCount };
      })
    );

    if (companiesData.length === 0) {
      return res.status(404).json({ error: "No company info found" });
    }

    return res.status(200).json({
      companiesData: JSON.stringify(companiesData),
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return res.status(500).json({
      error: "Failed to process fmp data request",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
