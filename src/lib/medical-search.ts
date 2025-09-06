// Removed dependency on external JSONSchema types to simplify typing

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TOOL_NAME = "MyMedicalChatbot";
const CONTACT_EMAIL = "armanrasa0@gmail.com";
const NCBI_API_KEY = process.env.NCBI_API_KEY || ""; // optional

type PubMedSummary = {
  uid: string;
  title?: string;
  pubdate?: string;
  source?: string;
  authors?: { name: string }[];
  doi?: string;
  url?: string;
};

export type MedicalSearchParams = {
  query: string;
  maxResults?: number;
  sort?: "relevance" | "most recent";
  includeAbstracts?: boolean;
};

async function esearchPubMed(term: string, retmax: number, sort: string) {
  const url = new URL(`${EUTILS_BASE}/esearch.fcgi`);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("term", term);
  url.searchParams.set("retmode", "json");
  url.searchParams.set("retmax", String(retmax));
  if (sort) url.searchParams.set("sort", sort);
  url.searchParams.set("tool", TOOL_NAME);
  url.searchParams.set("email", CONTACT_EMAIL);
  if (NCBI_API_KEY) url.searchParams.set("api_key", NCBI_API_KEY);

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error(`esearch failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as {
    esearchresult?: { idlist?: string[]; count?: string };
  };
  const ids: string[] = data?.esearchresult?.idlist ?? [];
  const count = Number(data?.esearchresult?.count ?? 0);
  return { ids, count };
}

async function esummaryPubMed(ids: string[]): Promise<PubMedSummary[]> {
  if (!ids.length) return [];
  const url = new URL(`${EUTILS_BASE}/esummary.fcgi`);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("id", ids.join(","));
  url.searchParams.set("retmode", "json");
  url.searchParams.set("tool", TOOL_NAME);
  url.searchParams.set("email", CONTACT_EMAIL);
  if (NCBI_API_KEY) url.searchParams.set("api_key", NCBI_API_KEY);

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error(`esummary failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { result?: { uids?: string[]; [k: string]: unknown } };
  const result = data?.result ?? {};
  const uids: string[] = result?.uids ?? [];
  return uids.map((uid) => {
    const r = result[uid] as {
      articleids?: { idtype: string; value: string }[];
      title?: string;
      pubdate?: string;
      fulljournalname?: string;
      source?: string;
      authors?: Array<{ name?: string } | string>;
    };
    const doi = (r.articleids || []).find((a) => a.idtype === "doi")?.value || undefined;
    const authorsRaw = Array.isArray(r.authors) ? r.authors : [];
    const authors: { name: string }[] = authorsRaw
      .map((a) => (typeof a === "string" ? { name: a } : { name: a?.name ?? "" }))
      .filter((a) => Boolean(a.name));
    return {
      uid,
      title: r.title,
      pubdate: r.pubdate,
      source: r.fulljournalname || r.source,
      authors,
      doi,
      url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
    } as PubMedSummary;
  });
}

async function efetchAbstracts(ids: string[]): Promise<Record<string, string>> {
  const url = new URL(`${EUTILS_BASE}/efetch.fcgi`);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("id", ids.join(","));
  url.searchParams.set("retmode", "xml");
  url.searchParams.set("rettype", "abstract");
  url.searchParams.set("tool", TOOL_NAME);
  url.searchParams.set("email", CONTACT_EMAIL);
  if (NCBI_API_KEY) url.searchParams.set("api_key", NCBI_API_KEY);

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error(`efetch failed: ${res.status} ${res.statusText}`);
  const xml = await res.text();

  const map: Record<string, string> = {};
  const recordRegex =
    /<PubmedArticle>[\s\S]*?<PMID[^>]*>(\d+)<\/PMID>[\s\S]*?<Abstract>([\s\S]*?)<\/Abstract>[\s\S]*?<\/PubmedArticle>/g;
  let m: RegExpExecArray | null;
  while ((m = recordRegex.exec(xml)) !== null) {
    const pmid = m[1];
    const abstractXml = m[2];
    const text = abstractXml
      .replace(/<AbstractText[^>]*>/g, "")
      .replace(/<\/AbstractText>/g, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (pmid) map[pmid] = text;
  }
  return map;
}

export async function executeMedicalSearch(params: MedicalSearchParams) {
  const { query, maxResults = 20, sort = "most recent", includeAbstracts = false } = params;

  const { ids, count } = await esearchPubMed(
    query,
    Math.min(maxResults, 200),
    sort === "most recent" ? "most+recent" : "relevance",
  );

  const summaries = await esummaryPubMed(ids);

  let abstracts: Record<string, string> = {};
  if (includeAbstracts && ids.length) {
    abstracts = await efetchAbstracts(ids);
  }

  const items = summaries.map((s) => ({
    pmid: s.uid,
    title: s.title,
    journal: s.source,
    pubdate: s.pubdate,
    doi: s.doi,
    url: s.url,
    authors: (s.authors || []).map((a) => a.name).filter(Boolean),
    abstract: abstracts[s.uid],
  }));

  return {
    query,
    totalMatches: count,
    returned: items.length,
    items,
    source: "NCBI PubMed (E-utilities)",
    disclaimer:
      "For informational purposes only. Not a substitute for professional medical advice.",
  };
}

export const medicalSearchJSONSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description:
        "PubMed search string (supports field tags, MeSH, boolean ops). Example: 'asthma AND inhaled corticosteroids[Title/Abstract]'",
    },
    maxResults: { type: "integer", minimum: 1, maximum: 200, default: 20 },
    sort: { enum: ["relevance", "most recent"], default: "most recent" },
    includeAbstracts: { type: "boolean", default: false },
  },
  required: ["query"],
  additionalProperties: false,
} as const;