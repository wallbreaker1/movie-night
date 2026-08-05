'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    fetch('/api/state')
      .then(res => res.ok)
      .then(ok => setIsAuthenticated(ok))
      .catch(() => setIsAuthenticated(false));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMsg = 'Upload failed';
        try {
          const json = JSON.parse(text);
          errorMsg = json.error || json.details || errorMsg;
        } catch {
          errorMsg = text || errorMsg;
        }
        setError(errorMsg);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setResult(data);
        setFile(null);
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Upload to R2</h1>

        {isAuthenticated === false && (
          <div className="mb-6 p-4 bg-yellow-900/50 border border-yellow-700 rounded-lg">
            <p className="font-medium">Not authenticated</p>
            <p className="text-sm mt-1">
              You need to{' '}
              <a href="/login" className="text-blue-400 hover:underline">
                log in
              </a>{' '}
              first to upload files.
            </p>
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-6">
          <div>
            <label className="block mb-2 text-sm font-medium">
              Select file
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              disabled={uploading || !isAuthenticated}
              className="block w-full text-sm text-gray-300 border border-gray-600 rounded-lg cursor-pointer bg-gray-900 focus:outline-none p-2"
            />
            {file && (
              <p className="mt-2 text-sm text-gray-400">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!file || uploading || !isAuthenticated}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <p className="font-medium">Error:</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 p-4 bg-green-900/50 border border-green-700 rounded-lg">
            <p className="font-medium mb-2">Upload successful!</p>
            <div className="text-sm space-y-1">
              <p><strong>File:</strong> {result.fileName}</p>
              <p><strong>Size:</strong> {(result.size / 1024 / 1024).toFixed(2)} MB</p>
              <p><strong>URL:</strong></p>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline break-all"
              >
                {result.url}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
