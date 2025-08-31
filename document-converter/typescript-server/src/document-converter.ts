import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response } from "express";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";

// Optional dependencies
let marked: any;
let turndown: any;
let puppeteer: any;
let mammoth: any;
let pdfParse: any;

try {
  marked = require('marked');
} catch (e) {
  console.warn('marked not available - Markdown to HTML conversion disabled');
}

try {
  turndown = require('turndown');
} catch (e) {
  console.warn('turndown not available - HTML to Markdown conversion disabled');
}

try {
  puppeteer = require('puppeteer');
} catch (e) {
  console.warn('puppeteer not available - PDF generation disabled');
}

try {
  mammoth = require('mammoth');
} catch (e) {
  console.warn('mammoth not available - DOCX conversion disabled');
}

try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.warn('pdf-parse not available - PDF parsing disabled');
}

interface ConversionFile {
  content: string;
  input_format: string;
  filename?: string;
}

export class DocumentConverterServer extends EventEmitter {
  private server: Server;
  private app: express.Application;
  private toolInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.server = new Server(
      {
        name: "document-converter",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.app = express();
    this.setupToolHandlers();
    this.setupRoutes();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "convert-document",
            description: "Convert document between different formats (txt, md, html, pdf, docx)",
            inputSchema: {
              type: "object",
              properties: {
                content: {
                  type: "string",
                  description: "Document content to convert"
                },
                input_format: {
                  type: "string",
                  enum: ["txt", "md", "html", "pdf", "docx"],
                  description: "Input format"
                },
                output_format: {
                  type: "string",
                  enum: ["txt", "md", "html", "pdf", "docx"],
                  description: "Output format"
                },
                filename: {
                  type: "string",
                  description: "Optional filename for context"
                }
              },
              required: ["content", "input_format", "output_format"]
            }
          },
          {
            name: "list-supported-formats",
            description: "List all supported input and output formats",
            inputSchema: {
              type: "object",
              properties: {}
            }
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
                      filename: { type: "string" }
                    },
                    required: ["content", "input_format"]
                  },
                  description: "Array of files to convert"
                },
                output_format: {
                  type: "string",
                  enum: ["txt", "md", "html", "pdf", "docx"],
                  description: "Target output format for all files"
                }
              },
              required: ["files", "output_format"]
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "convert-document":
          const result = await this.convertDocument(
            args?.content as string,
            args?.input_format as string,
            args?.output_format as string,
            args?.filename as string | undefined
          );
          return {
            content: [{
              type: "text",
              text: result
            }]
          };

        case "list-supported-formats":
          const formats = this.listSupportedFormats();
          return {
            content: [{
              type: "text",
              text: formats
            }]
          };

        case "convert-file-batch":
          const batchResult = await this.convertFileBatch(
            args?.files as ConversionFile[],
            args?.output_format as string
          );
          return {
            content: [{
              type: "text",
              text: batchResult
            }]
          };

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private setupRoutes() {
    this.app.use(express.json());
    
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', service: 'document-converter' });
    });

    // MCP endpoint
    this.app.post('/mcp', async (req: Request, res: Response) => {
      try {
        const request = req.body;
        
        // Handle different MCP methods
        if (request.method === 'initialize') {
          res.json({
            jsonrpc: '2.0',
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: 'document-converter',
                version: '1.0.0'
              }
            },
            id: request.id
          });
        } else if (request.method === 'tools/list') {
           // Directly return the tools list
           const tools = [
             {
               name: "convert-document",
               description: "Convert document between different formats (txt, md, html, pdf, docx)",
               inputSchema: {
                 type: "object",
                 properties: {
                   content: {
                     type: "string",
                     description: "Document content to convert"
                   },
                   input_format: {
                     type: "string",
                     enum: ["txt", "md", "html", "pdf", "docx"],
                     description: "Input format"
                   },
                   output_format: {
                     type: "string",
                     enum: ["txt", "md", "html", "pdf", "docx"],
                     description: "Output format"
                   },
                   filename: {
                     type: "string",
                     description: "Optional filename for context"
                   }
                 },
                 required: ["content", "input_format", "output_format"]
               }
             },
             {
               name: "list-supported-formats",
               description: "List all supported input and output formats",
               inputSchema: {
                 type: "object",
                 properties: {}
               }
             }
           ];
           res.json({
             jsonrpc: '2.0',
             result: { tools },
             id: request.id
           });
         } else if (request.method === 'tools/call') {
           const { name, arguments: args } = request.params;
           let result: any;
           
           if (name === 'convert-document') {
             result = {
               content: [{
                 type: 'text',
                 text: await this.convertDocument(
                   args.content,
                   args.input_format,
                   args.output_format,
                   args.filename
                 )
               }]
             };
           } else if (name === 'list-supported-formats') {
             result = {
               content: [{
                 type: 'text',
                 text: 'Supported formats:\nInput/Output: txt, md, html\nInput only: pdf, docx (requires additional libraries)\nOutput only: pdf (requires puppeteer)'
               }]
             };
           } else {
             throw new Error(`Unknown tool: ${name}`);
           }
           
           res.json({
             jsonrpc: '2.0',
             result,
             id: request.id
           });
        } else {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`
            },
            id: request.id
          });
        }
      } catch (error) {
        console.error('MCP request error:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error'
          },
          id: req.body?.id
        });
      }
    });
  }

  private async convertDocument(
    content: string,
    inputFormat: string,
    outputFormat: string,
    filename?: string
  ): Promise<string> {
    try {
      if (inputFormat === outputFormat) {
        return content;
      }

      let workingContent = content;
      let workingType = inputFormat;

      // Convert to intermediate format if needed
      if (inputFormat === 'docx' && mammoth) {
        const buffer = Buffer.from(content, 'base64');
        const result = await mammoth.extractRawText({ buffer });
        workingContent = result.value;
        workingType = 'txt';
      } else if (inputFormat === 'pdf' && pdfParse) {
        const buffer = Buffer.from(content, 'base64');
        const data = await pdfParse(buffer);
        workingContent = data.text;
        workingType = 'txt';
      }

      // Convert to target format
      switch (outputFormat) {
        case 'txt':
          return this.convertToText(workingContent, workingType);
        case 'md':
          return this.convertToMarkdown(workingContent, workingType);
        case 'html':
          return this.convertToHtml(workingContent, workingType);
        case 'pdf':
          return await this.convertToPdf(workingContent, workingType);
        case 'docx':
          return this.convertToDocx(workingContent, workingType);
        default:
          throw new Error(`Unsupported output format: ${outputFormat}`);
      }
    } catch (error) {
      throw new Error(`Conversion failed: ${error}`);
    }
  }

  private convertToText(content: string, inputType: string): string {
    if (inputType === 'html') {
      return content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
    if (inputType === 'md') {
      return content.replace(/[#*`_\[\]()]/g, '').replace(/\s+/g, ' ').trim();
    }
    return content;
  }

  private convertToMarkdown(content: string, inputType: string): string {
    if (inputType === 'html' && turndown) {
      const turndownService = new turndown();
      return turndownService.turndown(content);
    }
    if (inputType === 'txt') {
      const lines = content.split('\n');
      return lines.map(line => {
        if (!line.trim()) return '';
        if (line.toUpperCase() === line && line.length > 3) {
          return `# ${line.toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}`;
        }
        if (line.endsWith(':')) {
          return `## ${line.slice(0, -1)}`;
        }
        return line;
      }).join('\n');
    }
    return content;
  }

  private convertToHtml(content: string, inputType: string): string {
    if (inputType === 'md') {
      if (marked) {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Converted Document</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
        pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
${marked.parse(content)}
</body>
</html>`;
      } else {
        // Simple markdown to HTML conversion fallback
        const htmlContent = this.simpleMarkdownToHtml(content);
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Converted Document</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1, h2, h3, h4, h5, h6 { color: #333; }
        code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
        pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
      }
    }
    if (inputType === 'txt') {
      const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Text Document</title>
</head>
<body>
<pre>${escaped}</pre>
</body>
</html>`;
    }
    return content;
  }

  private simpleMarkdownToHtml(markdown: string): string {
    let html = markdown;
    
    // Escape HTML characters first
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold and italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    
    // Wrap in paragraphs
    html = '<p>' + html + '</p>';
    
    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>.*?<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre>.*?<\/pre>)<\/p>/g, '$1');
    
    return html;
  }

  private async convertToPdf(content: string, inputType: string): Promise<string> {
    if (!puppeteer) {
      throw new Error('PDF conversion requires puppeteer');
    }

    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      
      let htmlContent = content;
      if (inputType !== 'html') {
        htmlContent = this.convertToHtml(content, inputType);
      }
      
      await page.setContent(htmlContent);
      const pdfBuffer = await page.pdf({ format: 'A4' });
      return Buffer.from(pdfBuffer).toString('base64');
    } finally {
      await browser.close();
    }
  }

  private convertToDocx(content: string, inputType: string): string {
    // Simplified DOCX generation - in practice, you'd use a proper library
    throw new Error('DOCX generation not implemented in this demo');
  }

  private listSupportedFormats(): string {
    const formats = {
      input: ['txt', 'md', 'html'],
      output: ['txt', 'md', 'html']
    };

    if (mammoth) formats.input.push('docx');
    if (pdfParse) formats.input.push('pdf');
    if (puppeteer) formats.output.push('pdf');

    return `Document Converter - Supported Formats\n` +
           `========================================\n\n` +
           `Input Formats: ${formats.input.join(', ')}\n` +
           `Output Formats: ${formats.output.join(', ')}\n\n` +
           `Available Libraries:\n` +
           `- marked: ${marked ? '✓' : '✗'}\n` +
           `- turndown: ${turndown ? '✓' : '✗'}\n` +
           `- puppeteer: ${puppeteer ? '✓' : '✗'}\n` +
           `- mammoth: ${mammoth ? '✓' : '✗'}\n` +
           `- pdf-parse: ${pdfParse ? '✓' : '✗'}`;
  }

  private async convertFileBatch(
    files: ConversionFile[],
    outputFormat: string
  ): Promise<string> {
    const results = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const converted = await this.convertDocument(
          file.content,
          file.input_format,
          outputFormat,
          file.filename
        );
        results.push({
          filename: file.filename || `file_${i + 1}`,
          status: 'success',
          content: converted.substring(0, 100) + (converted.length > 100 ? '...' : '')
        });
      } catch (error) {
        results.push({
          filename: file.filename || `file_${i + 1}`,
          status: 'error',
          error: String(error)
        });
      }
    }

    return `Batch Conversion Results (${files.length} files to ${outputFormat})\n` +
           `${'='.repeat(50)}\n\n` +
           results.map(r => 
             `File: ${r.filename}\n` +
             `Status: ${r.status}\n` +
             (r.status === 'error' ? `Error: ${r.error}\n` : `Preview: ${r.content}\n`) +
             `${'-'.repeat(30)}\n`
           ).join('');
  }

  getApp(): express.Application {
    return this.app;
  }

  async cleanup() {
    if (this.toolInterval) {
      clearInterval(this.toolInterval);
    }
    await this.server.close();
  }
}