"use client"

import { toast } from "sonner"
import FirecrawlApp from '@mendable/firecrawl-js';
import { executeMedicalSearch, type MedicalSearchParams } from '@/lib/medical-search';

type ScrapeResultMaybe = {
  success?: boolean;
  error?: string;
  url?: string;
};

export const useToolsFunctions = () => {

  const timeFunction = () => {
    const now = new Date()
    return {
      success: true,
      time: now.toLocaleTimeString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      message: "The current time is " + now.toLocaleTimeString() + " in " + Intl.DateTimeFormat().resolvedOptions().timeZone + " timezone."
    }
  }

  const scrapeWebsite = async ({ url }: { url: string }) => {
    const apiKey = process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY;
    try {
      const app = new FirecrawlApp({ apiKey: apiKey });
      const scrapeResult = await app.scrape(url, { formats: ['markdown', 'html'] }) as ScrapeResultMaybe;

      if (!scrapeResult?.success) {
        console.log(scrapeResult?.error)
        return {
          success: false,
          message: `Failed to scrape: ${scrapeResult?.error}`
        };
      }

      toast.success("Scraped website content successfully 📋", {
        description: "Here is the scraped website content: " + JSON.stringify(scrapeResult?.url) + "Summarize and explain it to the user now in a response."
      })
    
      return {
        success: true,
        message: "Here is the scraped website content: " + JSON.stringify(scrapeResult?.url) + "Summarize and explain it to the user now in a response."
      };

    } catch (error) {
      return {
        success: false,
        message: `Error scraping website: ${error}`
      };
    }
  }

  const searchMedicalLiterature = async (
    params: MedicalSearchParams
  ) => {
    try {
      const result = await executeMedicalSearch(params);
      toast.success("Fetched medical literature 📚", {
        description: `Found ${result.returned} of ${result.totalMatches} results from PubMed.`
      })
      return {
        success: true,
        ...result
      }
    } catch (error) {
      return {
        success: false,
        message: `Error searching medical literature: ${error}`
      }
    }
  }

  return {
    timeFunction,
    scrapeWebsite,
    searchMedicalLiterature
  }
}