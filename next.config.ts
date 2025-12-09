import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    /* config options here */
    reactCompiler: true,
    output: 'export',
    allowedDevOrigins: ["172.19.55.185"]
};

export default nextConfig;
