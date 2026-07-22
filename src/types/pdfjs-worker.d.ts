// pdfjs-dist doesn't ship types for this exact subpath — imported directly in
// src/lib/pdf-rasterize.ts to register the worker on the main thread.
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs'
