/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next";
import { FMP_BASE_URL, FMP_ENDPOINTS, type EndpointKey } from "@/lib/constants";

const FMP_API_KEY = process.env.FMP_API_KEY;

interface CompanyInfo {
  name: string;
  symbol: string;
}

async function fetchFMPData(
  symbol: string,
  endpoints: EndpointKey[]
): Promise<any> {
  const data: any = {};

  for (const endpoint of endpoints) {
    const endpointInfo = FMP_ENDPOINTS[endpoint as keyof typeof FMP_ENDPOINTS];
    if (!endpointInfo) continue;

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
      `${FMP_BASE_URL}/search?query=${encodeURIComponent(
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
    const { companies, endpoints } = req.body;

    // Gather data for all companies
    const companiesData = (
      await Promise.all(
        companies.map(async (company: string) => {
          const companyInfo = await searchCompany(company);
          if (!companyInfo) return null;

          const data = await fetchFMPData(companyInfo.symbol, endpoints);
          const companyData = {
            data,
            ...companyInfo,
          };
          const characterCount = JSON.stringify(companyData).length;

          return { ...companyInfo, data, characterCount };
        })
      )
    ).filter(Boolean);

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
