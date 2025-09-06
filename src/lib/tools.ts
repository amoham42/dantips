// Add interface for tools
interface Tool {
    type: 'function';
    name: string;
    description: string;
    parameters?: {
      type: string;
      properties: Record<string, {
        type: string;
        description: string;
      }>;
    };
}

const toolDefinitions = {
    getCurrentTime: {
        description: 'Gets the current time in the user\'s timezone',
        parameters: {}
    },
    scrapeWebsite: {
        description: 'Scrapes a URL and returns content in markdown and HTML formats',
        parameters: {
            url: {
                type: 'string',
                description: 'The URL to scrape'
            }
        }
    },
    searchMedicalLiterature: {
        description: 'Search PubMed for articles about a medical topic and optionally fetch abstracts',
        parameters: {
            query: {
                type: 'string',
                description: 'PubMed search query string'
            },
            maxResults: {
                type: 'number',
                description: 'Maximum number of results to return (1-200)'
            },
            sort: {
                type: 'string',
                description: "Sort order: 'relevance' or 'most recent'"
            },
            includeAbstracts: {
                type: 'boolean',
                description: 'Whether to include abstracts for returned articles'
            }
        }
    }
} as const;

const tools: Tool[] = Object.entries(toolDefinitions).map(([name, config]) => ({
    type: "function",
    name,
    description: config.description,
    parameters: {
    type: 'object',
    properties: config.parameters
    }
}));


export type { Tool };
export { tools };