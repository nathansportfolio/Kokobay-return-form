import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/returns/form", destination: "/", permanent: true },
      { source: "/operations", destination: "/", permanent: true },
      { source: "/returns", destination: "/", permanent: true },
      { source: "/returns/:path*", destination: "/", permanent: true },
      { source: "/order-tracking", destination: "/track-order", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
