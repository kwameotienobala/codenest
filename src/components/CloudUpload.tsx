'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Cloud, Check, AlertCircle } from 'lucide-react';
import { FileItem } from '@/types';
import { createClient } from '@supabase/supabase-js';

interface CloudUploadProps {
  files: FileItem[];
  projectName?: string;
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CloudUpload({ files, projectName = 'Untitled Project' }: CloudUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');

  const handleUpload = async () => {
    if (files.length === 0) {
      setUploadStatus('error');
      setUploadMessage('⚠️ No files to upload. Please select a folder first.');
      setTimeout(() => setUploadStatus('idle'), 3000);
      return;
    }

    setIsUploading(true);
    setUploadStatus('idle');

    try {
      // Generate a unique project ID
      const projectId = `${projectName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

      // Upload each file to Supabase
      const uploadPromises = files
        .filter(file => file.type === 'file') // Only upload files, not folders
        .map(async (file) => {
          const { error } = await supabase
            .from('code_files')
            .insert({
              filename: file.name,
              content: file.content,
              project_id: projectId
              // Don't manually set created_at, let the database handle it
            });

          if (error) {
            console.error('Supabase error details:', error);
            throw new Error(`Failed to upload ${file.name}: ${error.message}`);
          }

          return file.name;
        });

      const uploadedFiles = await Promise.all(uploadPromises);

      setUploadStatus('success');
      setUploadMessage(`✅ Uploaded ${uploadedFiles.length} files to cloud`);
      
      // Reset status after 3 seconds
      setTimeout(() => setUploadStatus('idle'), 3000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setUploadMessage(`❌ Upload failed: ${(error as Error).message}`);
      
      // Reset status after 5 seconds
      setTimeout(() => setUploadStatus('idle'), 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const getButtonIcon = () => {
    if (isUploading) return <Upload className="h-4 w-4 animate-spin" />;
    if (uploadStatus === 'success') return <Check className="h-4 w-4" />;
    if (uploadStatus === 'error') return <AlertCircle className="h-4 w-4" />;
    return <Cloud className="h-4 w-4" />;
  };

  const getButtonText = () => {
    if (isUploading) return 'Uploading...';
    if (uploadStatus === 'success') return 'Uploaded!';
    if (uploadStatus === 'error') return 'Upload Failed';
    return 'Upload to Cloud';
  };

  const getButtonVariant = () => {
    if (uploadStatus === 'success') return 'default';
    if (uploadStatus === 'error') return 'destructive';
    return 'outline';
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleUpload}
        disabled={isUploading}
        variant={getButtonVariant()}
        size="sm"
        className="w-full"
      >
        {getButtonIcon()}
        {getButtonText()}
      </Button>
      
      {uploadMessage && (
        <p className={`text-xs text-center ${
          uploadStatus === 'success' 
            ? 'text-green-600' 
            : uploadStatus === 'error' 
            ? 'text-red-600' 
            : 'text-gray-600'
        }`}>
          {uploadMessage}
        </p>
      )}
      
      {files.length > 0 && (
        <p className="text-xs text-gray-500 text-center">
          {files.filter(f => f.type === 'file').length} files ready to upload
        </p>
      )}
    </div>
  );
}