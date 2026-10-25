import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    agentFeedback: true,
  },
  turbopack: {
    root: path.resolve('..'),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
