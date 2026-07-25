import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    /*
     * Pinnaa workspace-juuri tähän hakemistoon. Ilman tätä Next 16 yrittää
     * päätellä juuren ja sekoaa .claude/worktrees-kopioihin (jokainen on oma
     * Next-projektinsa lockfileineen) -> "Next.js package not found".
     */
    root: __dirname,
  },
};

export default nextConfig;
