'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from './skeleton';

const Worker = dynamic(() => import('@react-pdf-viewer/core').then(mod => mod.Worker), { ssr: false });
const Viewer = dynamic(() => import('@react-pdf-viewer/core').then(mod => mod.Viewer), { ssr: false });

export function PdfViewerClient({ fileUrl }: { fileUrl: string }) {
    if (!fileUrl) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                Aucun document à afficher.
            </div>
        );
    }
    
    return (
        <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`}>
           <div className="h-full w-full">
              <Viewer fileUrl={fileUrl} />
           </div>
        </Worker>
    );
}

export function PdfViewerSkeleton() {
    return <Skeleton className="w-full h-full" />;
}
