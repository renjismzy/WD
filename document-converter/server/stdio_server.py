"""Document Converter MCP Server with Stdio transport support."""

import argparse
import asyncio
import sys
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    CallToolRequest,
    ListToolsRequest,
    Tool,
    TextContent,
    CallToolResult,
    ListToolsResult,
)

# Import conversion functions from main server
from document_converter import (
    convert_document,
    list_supported_formats,
    convert_file_batch,
    check_dependencies,
    SUPPORTED_FORMATS
)


class DocumentConverterStdioServer:
    """MCP Document Converter Server with Stdio transport."""
    
    def __init__(self):
        self.server = Server("document-converter-stdio")
        self.setup_handlers()
    
    def setup_handlers(self):
        """Set up MCP request handlers."""
        
        @self.server.list_tools()
        async def list_tools() -> ListToolsResult:
            """List available document conversion tools."""
            return ListToolsResult(
                tools=[
                    Tool(
                        name="convert_document",
                        description="Convert document from one format to another",
                        inputSchema={
                            "type": "object",
                            "properties": {
                                "content": {
                                    "type": "string",
                                    "description": "Document content (text or base64 for binary)"
                                },
                                "input_format": {
                                    "type": "string",
                                    "enum": SUPPORTED_FORMATS['input'],
                                    "description": "Input document format"
                                },
                                "output_format": {
                                    "type": "string",
                                    "enum": SUPPORTED_FORMATS['output'],
                                    "description": "Output document format"
                                },
                                "filename": {
                                    "type": "string",
                                    "description": "Optional filename for context"
                                }
                            },
                            "required": ["content", "input_format", "output_format"]
                        }
                    ),
                    Tool(
                        name="list_supported_formats",
                        description="List all supported input and output formats",
                        inputSchema={
                            "type": "object",
                            "properties": {},
                            "additionalProperties": False
                        }
                    ),
                    Tool(
                        name="convert_file_batch",
                        description="Convert multiple files to the same output format",
                        inputSchema={
                            "type": "object",
                            "properties": {
                                "files": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "content": {"type": "string"},
                                            "input_format": {"type": "string"},
                                            "filename": {"type": "string"}
                                        },
                                        "required": ["content", "input_format"]
                                    },
                                    "description": "List of files to convert"
                                },
                                "output_format": {
                                    "type": "string",
                                    "enum": SUPPORTED_FORMATS['output'],
                                    "description": "Target output format for all files"
                                }
                            },
                            "required": ["files", "output_format"]
                        }
                    )
                ]
            )
        
        @self.server.call_tool()
        async def call_tool(name: str, arguments: dict[str, Any]) -> CallToolResult:
            """Handle tool calls."""
            try:
                if name == "convert_document":
                    result = await convert_document(
                        content=arguments["content"],
                        input_format=arguments["input_format"],
                        output_format=arguments["output_format"],
                        filename=arguments.get("filename")
                    )
                    return CallToolResult(
                        content=[TextContent(type="text", text=result)]
                    )
                
                elif name == "list_supported_formats":
                    result = await list_supported_formats()
                    return CallToolResult(
                        content=[TextContent(type="text", text=result)]
                    )
                
                elif name == "convert_file_batch":
                    result = await convert_file_batch(
                        files=arguments["files"],
                        output_format=arguments["output_format"]
                    )
                    return CallToolResult(
                        content=[TextContent(type="text", text=result)]
                    )
                
                else:
                    raise ValueError(f"Unknown tool: {name}")
            
            except Exception as e:
                return CallToolResult(
                    content=[TextContent(type="text", text=f"Error: {str(e)}")],
                    isError=True
                )
    
    async def run(self):
        """Run the server with stdio transport."""
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options()
            )


async def main():
    """Main entry point for stdio server."""
    parser = argparse.ArgumentParser(
        description="Document Converter MCP Server with Stdio transport"
    )
    parser.add_argument(
        "--check-deps",
        action="store_true",
        help="Check library dependencies and exit"
    )
    args = parser.parse_args()
    
    if args.check_deps:
        deps = check_dependencies()
        print("Library Dependencies:")
        for lib, available in deps.items():
            status = "✓ Available" if available else "✗ Not installed"
            print(f"  {lib}: {status}")
        return
    
    # Print startup info to stderr so it doesn't interfere with stdio protocol
    print("Starting Document Converter MCP Server (Stdio transport)", file=sys.stderr)
    print("Transport: Stdio (JSON-RPC over stdin/stdout)", file=sys.stderr)
    
    deps = check_dependencies()
    print("Library Status:", file=sys.stderr)
    for lib, available in deps.items():
        status = "✓" if available else "✗"
        print(f"  {status} {lib}", file=sys.stderr)
    
    server = DocumentConverterStdioServer()
    await server.run()


if __name__ == "__main__":
    asyncio.run(main())