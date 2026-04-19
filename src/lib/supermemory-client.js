import Supermemory from "supermemory";
import { ValidateApiKey, validateContainerTag, SanitizeContent , ValidateContentLength } from "./validate.js";
import {
    DEFAULT_SEARCH_LIMIT,
    DEFAULT_SEARCH_MODE,
    loadConfig,
} from "./config.js";

function dedupeBy(items,getKey){
    const seen = new Set();

    return items.filter((item)=>{
        const key = String(getKey(item)?? "").trim().toLowerCase();
        if(!key || seen.has(key)){
            return false;
        }
        seen.add(key);
        return true;
    })
}

function normalizeSearchResults(results){
    const text = results?.memory ?? results?.chunk ?? results?.content ?? "";
    return {
        id: results?.id ?? null,
        text,
        kind: results?.memory ? "memory" : results?.chunk ? "chunk" : "unknown",
        chunk: results?.chunk ?? null,
        context: results?.context ?? null,
        documents: Array.isArray(results?.documents) ? results.documents : [],
        updatedAt: results?.updatedAt ?? null,
        metadata: results?.metadata ?? {},
        similarity:
        typeof results?.similarity === "number" ? results.similarity : null,
    };
}

export class SupermemoryClient {
    constructor({
        apiKey,
        containerTag,
        apiUrl
    } = {}, cwd = process.cwd()) {
        if (
            apiKey === undefined ||
            containerTag === undefined ||
            apiUrl === undefined
        ) {
            const config = loadConfig(
                {
                    ...process.env,
                    ...(apiKey !== undefined ? { SUPERMEMORY_API_KEY: apiKey } : {}),
                    ...(containerTag !== undefined ? { SUPERMEMORY_CONTAINER_TAG: containerTag } : {}),
                    ...(apiUrl !== undefined ? { SUPERMEMORY_API_URL: apiUrl } : {}),
                },
                cwd,
                "supermemory",
            );

            apiKey = apiKey ?? config.apiKey;
            containerTag = containerTag ?? config.containerTag;
            apiUrl = apiUrl ?? config.apiUrl;
        }

        const keyCheck = ValidateApiKey(apiKey);
        if(!keyCheck.valid){
            throw new Error(`Invalid Supermemory API key: ${keyCheck.reason}`);
        }
        const tagCheck = validateContainerTag(containerTag);
        if(!tagCheck.valid){
            throw new Error(`Invalid Supermemory container tag: ${tagCheck.reason}`);
        }
        this.containerTag = containerTag;
        this.client = new Supermemory({ apiKey, baseURL: apiUrl });
    }

    resolveContainerTag(containerTag){
        const finalTag = containerTag ?? this.containerTag;
        const tagCheck = validateContainerTag(finalTag);
        if(!tagCheck.valid){
            throw new Error(`Invalid Supermemory container tag: ${tagCheck.reason}`);
        }
        return finalTag;
    }
    
    async addMemory(
        content,
        {containerTag,metadata={}, customId, entityContext} = {},
    ){
        const sanitizedContent = SanitizeContent(content);
        const contentCheckq = ValidateContentLength(sanitizedContent);
        if(!contentCheckq.valid){  
            throw new Error(`Invalid memory content: ${contentCheckq.reason}`);
        }
        const payload = {
            content: sanitizedContent,
            containerTag: this.resolveContainerTag(containerTag),
            metadata:{
                sm_source:"gemini-cli-extension",
                ...metadata,
            },
        };
        if(customId) payload.customId = customId;
        if(entityContext) payload.entityContext = entityContext;

        const result = await this.client.add(payload);

        return {
            id: result.id,
            status: result.status,
            containerTag: payload.containerTag,
        }
    }

    async search(query , {
        containerTag,
        limit = DEFAULT_SEARCH_LIMIT,
        mode = DEFAULT_SEARCH_MODE,
        filters,
        threshold,
        rerank,
        rewriteQuery,
    } = {}){
        const normalizedQuery = typeof query === "string" ? query.trim() : "";
        if(!normalizedQuery){
            throw new Error("Search query must be a non-empty string");
        }
        const results = await this.client.search.memories({
            q: normalizedQuery,
            containerTag: this.resolveContainerTag(containerTag),
            limit,
            searchMode:mode,
            filters,
            threshold,
            rerank,
            rewriteQuery,
        });

        const mapped = results.results.map(normalizeSearchResults).filter((item) => item.text);

        return {
            results: dedupeBy(mapped,(item)=>`${item.kind}:${item.text}`),
            total: results.total,
            timing: results.timing,
        };
    }

    async getProfile({containerTag, query, filters, threshold}={}){
        const payload = {
            containerTag: this.resolveContainerTag(containerTag),
        };
        const normalizedQuery = typeof query === "string" ? query.trim() : "";
        if(normalizedQuery){
            payload.q = normalizedQuery;
        }
        if(filters) payload.filters = filters;
        if(typeof threshold === "number") payload.threshold = threshold;

        const result = await this.client.profile(payload);

        const staticFacts = dedupeBy(result.profile?.static??[],(item) => item);
        const dynamicFacts = dedupeBy(result.profile?.dynamic ?? [],(item)=> item);

        const rawSearchResults = Array.isArray(result.searchResults?.results)
      ? result.searchResults.results
      : [];

        const mappedSearchResults = rawSearchResults
        .map(normalizeSearchResults)
        .filter((item) => item.text);
        return {
         profile: {
         static: staticFacts,
         dynamic: dynamicFacts,
        },
        searchResults: result.searchResults
        ? {
            results: dedupeBy(mappedSearchResults, (item) => item.text),
            total: result.searchResults.total,
            timing: result.searchResults.timing,
          }
        : null,
    };
    }
}

export default SupermemoryClient;
