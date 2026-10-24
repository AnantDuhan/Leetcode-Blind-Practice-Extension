import type { GraphqlResult } from "../shared/messages";

/**
 * Runs a LeetCode GraphQL query from inside the page (chrome.scripting,
 * world: "MAIN"), so it goes out exactly like LeetCode's own requests, with
 * the user's session. Must be self-contained: it is serialized.
 */
export async function pageGraphql(query: string, variables: Record<string, unknown>): Promise<GraphqlResult> {
  try {
    const response = await fetch("/graphql/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const json = await response.json();
    if (json?.errors?.length) return { ok: false, error: String(json.errors[0]?.message ?? "GraphQL error") };
    return { ok: true, data: json?.data };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
