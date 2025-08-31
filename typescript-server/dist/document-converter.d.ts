import express from "express";
import { EventEmitter } from "events";
export declare class DocumentConverterServer extends EventEmitter {
    private server;
    private app;
    private toolInterval?;
    constructor();
    private setupToolHandlers;
    private setupRoutes;
    private convertDocument;
    private convertToText;
    private convertToMarkdown;
    private convertToHtml;
    private convertToPdf;
    private convertToDocx;
    private listSupportedFormats;
    private convertFileBatch;
    getApp(): express.Application;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=document-converter.d.ts.map