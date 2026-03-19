// api/products.js
// Runs on Vercel's servers — env vars are NEVER sent to the browser.

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO  = process.env.GITHUB_REPO;
const ADMIN_USER   = process.env.ADMIN_USER;
const ADMIN_PASS   = process.env.ADMIN_PASS;
const FILE         = "products.json";
const GH_API       = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE}`;

const GH_HEADERS = {
  "Authorization": `token ${GITHUB_TOKEN}`,
  "Accept":        "application/vnd.github.v3+json",
  "Content-Type":  "application/json",
  "User-Agent":    "baz-store-admin"
};

export default async function handler(req, res) {
  // Allow requests from same origin only
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  // ── GET /api/products — public, no auth needed ──
  if (req.method === "GET") {
    try {
      const ghRes = await fetch(GH_API, { headers: GH_HEADERS });
      if (!ghRes.ok) throw new Error("GitHub error: " + ghRes.status);
      const data = await ghRes.json();
      const decoded = JSON.parse(
        Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8")
      );
      return res.status(200).json({ ...decoded, sha: data.sha });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── PUT /api/products — requires admin credentials ──
  if (req.method === "PUT") {
    // Verify credentials sent from admin.html
    const authHeader = req.headers.authorization || "";
    const base64 = authHeader.replace("Basic ", "");
    let user = "", pass = "";
    try {
      [user, pass] = Buffer.from(base64, "base64").toString().split(":");
    } catch {
      return res.status(401).json({ error: "Invalid auth" });
    }

    if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { products, sha } = req.body;
    if (!Array.isArray(products) || !sha) {
      return res.status(400).json({ error: "Missing products or sha" });
    }

    try {
      const content = Buffer.from(
        JSON.stringify({ products }, null, 2)
      ).toString("base64");

      const ghRes = await fetch(GH_API, {
        method: "PUT",
        headers: GH_HEADERS,
        body: JSON.stringify({
          message: "Update products via BAZ Admin",
          content,
          sha
        })
      });

      if (!ghRes.ok) {
        const err = await ghRes.json();
        throw new Error(err.message || "GitHub save failed");
      }

      const data = await ghRes.json();
      return res.status(200).json({ sha: data.content.sha });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
