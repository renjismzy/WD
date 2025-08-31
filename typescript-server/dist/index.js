import express from "express";
import cors from "cors";
import { DocumentConverterServer } from './document-converter.js';
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const HOST = process.env.HOST || "localhost";
async function main() {
    console.log("Starting Document Converter MCP Server (TypeScript)...");
    // Create document converter server
    const docConverter = new DocumentConverterServer();
    // Get the Express app from the document converter
    const app = docConverter.getApp();
    // Additional middleware
    app.use(cors({
        origin: true,
        credentials: true,
        exposedHeaders: ["mcp-session-id"]
    }));
    app.use(express.json({ limit: "50mb" }));
    app.use(express.text({ limit: "50mb" }));
    // Root endpoint - welcome page
    app.get("/", (req, res) => {
        res.json({
            service: "Document Converter MCP Server",
            version: "1.0.0",
            description: "A Model Context Protocol server for document conversion",
            endpoints: {
                status: "/status",
                mcp: "/mcp",
                health: "/health"
            },
            timestamp: new Date().toISOString()
        });
    });
    // Additional health check endpoint
    app.get("/status", (req, res) => {
        res.json({
            status: "healthy",
            service: "document-converter-mcp",
            version: "1.0.0",
            timestamp: new Date().toISOString()
        });
    });
    // Start server
    const httpServer = app.listen(PORT, HOST, () => {
        console.log(`Document Converter MCP Server running on http://${HOST}:${PORT}`);
        console.log(`Health check: http://${HOST}:${PORT}/health`);
        console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
        console.log("\nSupported features:");
        console.log("- Streamable HTTP transport");
        console.log("- Server-Sent Events (SSE)");
        console.log("- Document conversion tools");
        console.log("\nPress Ctrl+C to stop the server");
    });
    // Graceful shutdown
    const shutdown = async () => {
        console.log("\nShutting down server...");
        httpServer.close(() => {
            console.log("HTTP server closed");
        });
        try {
            await docConverter.cleanup();
            console.log("Document converter cleaned up");
        }
        catch (error) {
            console.error("Error during cleanup:", error);
        }
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
});
// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1);
});
// Start the server if this file is run directly
main().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});
export { DocumentConverterServer };
export default main;
//# sourceMappingURL=index.js.map