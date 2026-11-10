import { useState, useEffect, useCallback } from 'react';

export interface FileNode {
  id: string;
  name: string;
  path: string;
  isDir: boolean;
  ext: string;
  depth: number;
  size: number;
  color: string;
}

export interface FileLink {
  source: string;
  target: string;
}

export interface FileGraphData {
  nodes: FileNode[];
  links: FileLink[];
}

export function useFileGraph(dir: string) {
  const [data, setData] = useState<FileGraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback((scanDir: string) => {
    setLoading(true);
    setError(null);
    fetch(`/api/scan?dir=${encodeURIComponent(scanDir)}&depth=2&max=200`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: FileGraphData) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (dir) scan(dir);
  }, [dir, scan]);

  return { data, loading, error, rescan: scan };
}

export async function openFile(filePath: string): Promise<void> {
  try {
    await fetch(`/api/open?path=${encodeURIComponent(filePath)}`);
  } catch {
    // ignore
  }
}
