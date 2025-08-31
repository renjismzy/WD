import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Document conversion libraries (same as in document-converter.ts)
let marked: any = null;
let turndown: any = null;
let puppeteer: any = null;
let officegen: any = null;
let mammoth: any = null;
let pdfParse: any = null;

// Try to import optional dependencies
try {
  marked = require("marked");
} catch (e) {
  // marked not available
}

try {
  turndown = require("turndown");
} catch (e) {
  // turndown not available
}

try {
  puppeteer = require("puppeteer");
} catch (e) {
  // puppeteer not available
}

try {
  officegen = require("officegen");
} catch (e) {
  // officegen not available
}

try {
  mammoth = require("mammoth");
} catch (e) {
  // mammoth not available
}

try {
  pdfParse = require("pdf-parse");
} catch (e) {
  // pdf-parse not available
}

// Supported formats
const SUPPORTED_FORMATS = {
  input: ["txt", "md", "html", "docx", "pdf", "rtf"],
  output: ["txt", "md", "html", "docx", "pdf", "rtf"],
};

interface ConversionFile {
  content: string;
  input_format: string;
  filename?: string;
}

interface LibraryStatus {
  [key: string]: boolean;
}

// Helper functions (same as in document-converter.ts)
function checkDependencies(): LibraryStatus {
  return {
    marked: marked !== null,
    turndown: turndown !== null,
    puppeteer: puppeteer !== null,
    officegen: officegen !== null,
    mammoth: mammoth !== null,
    "pdf-parse": pdfParse !== null,
  };
}

function convertTextToMarkdown(text: string): string {
  const lines = text.split("\n");
  const markdownLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      markdownLines.push("");
    } else if (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3) {
      markdownLines.push(`# ${trimmedLine.toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}`);
    } else if (trimmedLine.endsWith(":")) {
      markdownLines.push(`## ${trimmedLine.slice(0, -1)}`);
    } else {
      markdownLines.push(trimmedLine);
    }
  }

  return markdownLines.join("\n");
}

function convertMarkdownToHtml(mdText: string): string {
  if (!marked) {
    throw new Error("Marked library not available. Install with: npm install marked");
  }

  const html = marked.parse(mdText);
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Converted Document</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
        pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
        blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 20px; color: #666; }
    </style>
</head>
<body>
${html}
</body>
</html>`;
}

function convertHtmlToText(htmlContent: string): string {
  return htmlContent
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function convertHtmlToMarkdown(htmlContent: string): string {
  if (!turndown) {
    let text = convertHtmlToText(htmlContent);
    return convertTextToMarkdown(text);
  }

  const turndownService = new turndown();
  return turndownService.turndown(htmlContent);
}

async function convertToPdf(content: string, contentType: string = "text"): Promise<Buffer> {
  if (!puppeteer) {
    throw new Error("Puppeteer library not available. Install with: npm install puppeteer");
  }

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  let htmlContent: string;
  if (contentType === "html") {
    htmlContent = content;
  } else if (contentType === "markdown") {
    htmlContent = convertMarkdownToHtml(content);
  } else {
    const escapedContent = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const paragraphs = escapedContent.split("\n\n");
    const htmlParagraphs = paragraphs
      .filter(para => para.trim())
      .map(para => `<p>${para.replace(/\n/g, "<br>")}</p>`);
    
    htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Converted Document</title>
    <style>body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }</style>
</head>
<body>
${htmlParagraphs.join("")}
</body>
</html>`;
  }

  await page.setContent(htmlContent);
  const pdfBuffer = await page.pdf({
    format: "A4",
    margin: {
      top: "1in",
      right: "1in",
      bottom: "1in",
      left: "1in",
    },
  });

  await browser.close();
  return pdfBuffer;
}

async function convertToDocx(content: string, contentType: string = "text"): Promise<Buffer> {
  if (!officegen) {
    throw new Error("Officegen library not available. Install with: npm install officegen");
  }

  return new Promise((resolve, reject) => {
    const docx = officegen("docx");

    let textContent: string;
    if (contentType === "html") {
      textContent = convertHtmlToText(content);
    } else if (contentType === "markdown") {
      textContent = content.replace(/[#*_`]/g, "");
    } else {
      textContent = content;
    }

    const paragraphs = textContent.split("\n\n");
    
    for (const para of paragraphs) {
      if (para.trim()) {
        if (para.length < 50 && (para === para.toUpperCase() || para.startsWith("#"))) {
          const pObj = docx.createP();
          pObj.addText(para.replace(/^#+\s*/, "").trim(), { bold: true, font_size: 16 });
        } else {
          const pObj = docx.createP();
          pObj.addText(para.trim());
        }
      }
    }

    const chunks: Buffer[] = [];
    docx.on("data", (chunk: Buffer) => chunks.push(chunk));
    docx.on("end", () => resolve(Buffer.concat(chunks)));
    docx.on("error", reject);
    
    docx.generate();
  });
}

export class DocumentConverterStdioServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "document-converter-stdio",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
  }

  private setupTools() {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "convert-document",
            description: "Convert document from one format to another",
            inputSchema: {
              type: "object",
              properties: {
                content: {
                  type: "string",
                  description: "Document content (text or base64 for binary formats)",
                },
                input_format: {
                  type: "string",
                  enum: SUPPORTED_FORMATS.input,
                  description: "Input document format",
                },
                output_format: {
                  type: "string",
                  enum: SUPPORTED_FORMATS.output,
                  description: "Output document format",
                },
                filename: {
                  type: "string",
                  description: "Optional filename for context",
                },
              },
              required: ["content", "input_format", "output_format"],
            },
          },
          {
            name: "list-supported-formats",
            description: "List all supported input and output formats",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
          {
            name: "convert-file-batch",
            description: "Convert multiple files to the same output format",
            inputSchema: {
              type: "object",
              properties: {
                files: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      content: { type: "string" },
                      input_format: { type: "string" },
                      filename: { type: "string" },
                    },
                    required: ["content", "input_format"],
                  },
                  description: "List of files to convert",
                },
                output_format: {
                  type: "string",
                  enum: SUPPORTED_FORMATS.output,
                  description: "Target output format for all files",
                },
              },
              required: ["files", "output_format"],
            },
          },
        ],
      };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "convert-document":
            const result = await this.convertDocument(
              args?.content as string,
              args?.input_format as string,
              args?.output_format as string,
              args?.filename as string | undefined
            );
            return {
              content: [
                {
                  type: "text",
                  text: result,
                },
              ],
            };

          case "list-supported-formats":
            const formats = this.listSupportedFormats();
            return {
              content: [
                {
                  type: "text",
                  text: formats,
                },
              ],
            };

          case "convert-file-batch":
            const batchResult = await this.convertFileBatch(
              args?.files as ConversionFile[],
              args?.output_format as string
            );
            return {
              content: [
                {
                  type: "text",
                  text: batchResult,
                },
              ],
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private async convertDocument(
    content: string,
    inputFormat: string,
    outputFormat: string,
    filename?: string
  ): Promise<string> {
    const input = inputFormat.toLowerCase().trim();
    const output = outputFormat.toLowerCase().trim();

    if (!SUPPORTED_FORMATS.input.includes(input)) {
      throw new Error(`Unsupported input format '${input}'. Supported: ${SUPPORTED_FORMATS.input.join(", ")}`);
    }

    if (!SUPPORTED_FORMATS.output.includes(output)) {
      throw new Error(`Unsupported output format '${output}'. Supported: ${SUPPORTED_FORMATS.output.join(", ")}`);
    }

    try {
      let workingContent: string;
      let workingType: string;

      if (input === "txt") {
        workingContent = content;
        workingType = "text";
      } else if (input === "md") {
        workingContent = content;
        workingType = "markdown";
      } else if (input === "html") {
        workingContent = content;
        workingType = "html";
      } else if (input === "docx") {
        if (!mammoth) {
          throw new Error("Mammoth library not available for DOCX processing. Install with: npm install mammoth");
        }
        
        const binaryContent = Buffer.from(content, "base64");
        const result = await mammoth.extractRawText({ buffer: binaryContent });
        workingContent = result.value;
        workingType = "text";
      } else if (input === "pdf") {
        if (!pdfParse) {
          throw new Error("pdf-parse library not available for PDF processing. Install with: npm install pdf-parse");
        }
        
        const binaryContent = Buffer.from(content, "base64");
        const data = await pdfParse(binaryContent);
        workingContent = data.text;
        workingType = "text";
      } else {
        workingContent = content;
        workingType = "text";
      }

      // Convert to output format
      if (output === "txt") {
        if (workingType === "html") {
          return convertHtmlToText(workingContent);
        } else if (workingType === "markdown") {
          return workingContent.replace(/[#*_`]/g, "");
        } else {
          return workingContent;
        }
      } else if (output === "md") {
        if (workingType === "text") {
          return convertTextToMarkdown(workingContent);
        } else if (workingType === "html") {
          return convertHtmlToMarkdown(workingContent);
        } else {
          return workingContent;
        }
      } else if (output === "html") {
        if (workingType === "markdown") {
          return convertMarkdownToHtml(workingContent);
        } else if (workingType === "text") {
          const escapedContent = workingContent
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          const paragraphs = escapedContent.split("\n\n");
          const htmlParagraphs = paragraphs
            .filter(para => para.trim())
            .map(para => `<p>${para.replace(/\n/g, "<br>")}</p>`);
          
          return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Converted Document</title>
    <style>body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }</style>
</head>
<body>
${htmlParagraphs.join("")}
</body>
</html>`;
        } else {
          return workingContent;
        }
      } else if (output === "pdf") {
        const pdfBuffer = await convertToPdf(workingContent, workingType);
        return pdfBuffer.toString("base64");
      } else if (output === "docx") {
        const docxBuffer = await convertToDocx(workingContent, workingType);
        return docxBuffer.toString("base64");
      } else {
        throw new Error(`Output format '${output}' conversion not implemented`);
      }
    } catch (error) {
      throw new Error(`Conversion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private listSupportedFormats(): string {
    const deps = checkDependencies();
    
    let result = "Document Converter - Supported Formats\n";
    result += "=" + "=".repeat(39) + "\n\n";
    
    result += "Input Formats: " + SUPPORTED_FORMATS.input.join(", ") + "\n";
    result += "Output Formats: " + SUPPORTED_FORMATS.output.join(", ") + "\n\n";
    
    result += "Library Dependencies:\n";
    result += "-".repeat(20) + "\n";
    for (const [lib, available] of Object.entries(deps)) {
      const status = available ? "✓ Available" : "✗ Not installed";
      result += `${lib}: ${status}\n`;
    }
    
    result += "\nInstallation Commands:\n";
    result += "-".repeat(20) + "\n";
    result += "npm install marked turndown puppeteer officegen mammoth pdf-parse\n\n";
    
    result += "Notes:\n";
    result += "- Binary formats (PDF, DOCX) require base64 encoding\n";
    result += "- Some conversions may require additional system dependencies\n";
    result += "- Puppeteer may require additional setup for headless Chrome\n";
    
    return result;
  }

  private async convertFileBatch(
    files: ConversionFile[],
    outputFormat: string
  ): Promise<string> {
    const results: any[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const fileInfo = files[i];
      const content = fileInfo.content || "";
      const inputFormat = fileInfo.input_format || "txt";
      const filename = fileInfo.filename || `file_${i + 1}`;
      
      try {
        const converted = await this.convertDocument(content, inputFormat, outputFormat, filename);
        results.push({
          filename,
          status: "success",
          content: converted,
        });
      } catch (error) {
        results.push({
          filename,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    let output = `Batch Conversion Results (${files.length} files to ${outputFormat})\n`;
    output += "=".repeat(50) + "\n\n";
    
    for (const result of results) {
      output += `File: ${result.filename}\n`;
      output += `Status: ${result.status}\n`;
      if (result.status === "error") {
        output += `Error: ${result.error}\n`;
      } else {
        const contentPreview = result.content.length > 100 
          ? result.content.substring(0, 100) + "..." 
          : result.content;
        output += `Content Preview: ${contentPreview}\n`;
      }
      output += "-".repeat(30) + "\n";
    }
    
    return output;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Document Converter MCP Server (Stdio) started");
  }
}

// Main function for stdio server
async function main() {
  const server = new DocumentConverterStdioServer();
  await server.run();
}

// Start the server directly
main().catch((error) => {
  console.error("Failed to start stdio server:", error);
  process.exit(1);
});

export default DocumentConverterStdioServer;