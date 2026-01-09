
'use client';

import React, { useState, useEffect } from 'react';
import { Skeleton } from './skeleton';

// Define types for the dynamically imported components
type ViewerType = React.ComponentType<React.ComponentProps<any>>;
type WorkerType = React.ComponentType<React.ComponentProps<any>>;
type DefaultLayoutPlugin = () => any;

export function PdfViewerClient({ fileUrl }: { fileUrl: string }) {
    const [Viewer, setViewer] = useState<ViewerType | null>(null);
    const [Worker, setWorker] = useState<WorkerType | null>(null);
    const [defaultLayoutPluginInstance, setDefaultLayoutPluginInstance] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadPdfViewer = async () => {
            try {
                const { Viewer: ViewerComponent, Worker: WorkerComponent } = await import('@react-pdf-viewer/core');
                const { defaultLayoutPlugin } = await import('@react-pdf-viewer/default-layout');
                
                setViewer(() => ViewerComponent);
                setWorker(() => WorkerComponent);
                setDefaultLayoutPluginInstance(defaultLayoutPlugin());
            } catch (error) {
                console.error("Failed to load PDF Viewer components", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadPdfViewer();
    }, []);

    if (isLoading) {
        return <PdfViewerSkeleton />;
    }

    if (!fileUrl) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                Aucun document à afficher.
            </div>
        );
    }
    
    if (!Viewer || !Worker || !defaultLayoutPluginInstance) {
         return <PdfViewerSkeleton />;
    }
    
    return (
        <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`}>
           <div className="h-full w-full">
              <Viewer fileUrl={fileUrl} plugins={[defaultLayoutPluginInstance]} />
           </div>
        </Worker>
    );
}

export function PdfViewerSkeleton() {
    return <Skeleton className="w-full h-full" />;
}
