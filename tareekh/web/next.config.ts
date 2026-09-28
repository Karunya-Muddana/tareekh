import { withAui } from "@assistant-ui/next";
import type { NextConfig } from "next";

// The FastAPI backend does the real work (OCR, memory, answers). The browser talks to it through /backend/*.
const BACKEND = process.env.TAREEKH_BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/backend/:path*", destination: `${BACKEND}/:path*` }];
  },
};

export default withAui(nextConfig);
