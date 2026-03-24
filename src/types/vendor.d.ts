// Vendor module declarations per moduli con tipi non risolti correttamente
// da moduleResolution: "bundler" su alcuni ambienti di build (es. Vercel)

declare module 'pdfjs-dist' {
  export const version: string
  export const GlobalWorkerOptions: { workerSrc: string }
  export function getDocument(src: any): { promise: Promise<PDFDocumentProxy> }
  interface PDFDocumentProxy {
    numPages: number
    getPage(num: number): Promise<PDFPageProxy>
  }
  interface PDFPageProxy {
    getViewport(params: { scale: number }): any
    render(params: any): { promise: Promise<void> }
  }
}

declare module 'xlsx' {
  export function read(data: any, opts?: any): WorkBook
  export const utils: {
    sheet_to_csv(ws: any, opts?: any): string
    sheet_to_json(ws: any, opts?: any): any[]
  }
  interface WorkBook {
    SheetNames: string[]
    Sheets: Record<string, any>
  }
}
