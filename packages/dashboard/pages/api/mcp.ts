import type { NextApiRequest, NextApiResponse } from "next";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "@/lib/mcp-server";
import { getUserByToken } from "@/lib/db-mcp";

// Disable Next.js body parser so the MCP transport can read the raw stream
export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  // Each user authenticates with their own MCP token; the token determines
  // which user's data this MCP session can touch.
  const user = token ? await getUserByToken(token) : null;
  if (!user) {
    const host = req.headers.host;
    const proto = (req.headers["x-forwarded-proto"] as string) ?? "https";
    const resourceMetadata = `${proto}://${host}/.well-known/oauth-protected-resource`;
    res.setHeader(
      "WWW-Authenticate",
      `Bearer realm="recall-mcp", resource_metadata="${resourceMetadata}"`,
    );
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Stateless mode: new server + transport per request (serverless-compatible)
  const server = createMcpServer(user.id);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (err) {
    console.error("[recall-mcp] Error handling MCP request:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
