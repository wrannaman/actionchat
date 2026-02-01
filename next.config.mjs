/** @type {import('next').NextConfig} */
const nextConfig = {
  // Auto-enable standalone for Docker builds
  ...(process.env.STANDALONE === "true" && { output: "standalone" }),
  allowedDevOrigins: ["localhost"],
};

export default nextConfig;
