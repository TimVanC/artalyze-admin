import React, { useState } from 'react';
import DropzoneComponent from './DropzoneComponent';
import axiosInstance from '../axiosInstance';
import { v4 as uuidv4 } from 'uuid';
import { STAGING_BASE_URL } from '../config';
import './Upload.css';

const Upload = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = (acceptedFiles) => {
    // Filter out any non-image files
    const imageFiles = acceptedFiles.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length !== acceptedFiles.length) {
      alert('Some files were skipped because they are not images.');
    }
    setUploadedFiles(prev => [...prev, ...imageFiles]);
  };

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (uploadedFiles.length === 0) {
      setUploadStatus('Please add some images first.');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Uploading images...');

    try {
      // Upload each image
      for (const file of uploadedFiles) {
        const sessionId = uuidv4(); // Generate unique sessionId for each upload
        const formData = new FormData();
        formData.append('humanImage', file);
        formData.append('sessionId', sessionId);
        
        // Set the date to null/undefined to let the backend handle scheduling
        formData.append('scheduledDate', '');

        // Connect to SSE endpoint for progress updates
        const token = localStorage.getItem('adminToken');
        const eventSource = new EventSource(
          `${STAGING_BASE_URL}/admin/progress-updates/${sessionId}?token=${token}`,
          {
            withCredentials: true
          }
        );
        
        eventSource.onmessage = (event) => {
          const { message } = JSON.parse(event.data);
          setUploadStatus(message);
        };

        eventSource.onerror = (error) => {
          // Only show error if we're still uploading and it's not a normal connection close
          if (isUploading && eventSource.readyState === EventSource.CLOSED) {
            console.error('SSE Error:', error);
            // Don't show the error message since the upload might still be working
          }
          eventSource.close();
        };

        try {
          await axiosInstance.post('/admin/upload-human-image', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          // Add success message for this specific file
          setUploadStatus(`Successfully uploaded ${file.name}`);
        } catch (error) {
          console.error('Upload error:', error);
          setUploadStatus(`Failed to upload ${file.name}. Continuing with remaining files...`);
        } finally {
          eventSource.close();
        }
      }

      setUploadStatus(`Successfully uploaded ${uploadedFiles.length} images! They will be automatically paired with AI images and scheduled.`);
      setUploadedFiles([]);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('Failed to upload images. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="upload-page-container">
      <h1>Bulk Upload Human Images</h1>
      
      <div className="info-box">
        <h2>How it works:</h2>
        <ul>
          <li>Upload multiple human artwork images at once</li>
          <li>The system will automatically generate matching AI images</li>
          <li>Image pairs will be scheduled for the next available days</li>
          <li>Each day can have up to 5 pairs</li>
          <li>You can preview the scheduled pairs in the Manage Day screen</li>
        </ul>
      </div>

      <div className="bulk-dropzone-container">
        <DropzoneComponent
          onDrop={onDrop}
          label="Drop multiple images here or click to select"
          multiple={true}
        />
      </div>

      {uploadedFiles.length > 0 && (
        <div className="uploaded-files-preview">
          <h3>Selected Images ({uploadedFiles.length})</h3>
          <div className="preview-grid">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="preview-item">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${index + 1}`}
                  className="preview-image"
                />
                <button
                  onClick={() => removeFile(index)}
                  className="remove-button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        className="upload-button"
        onClick={handleUpload}
        disabled={isUploading || uploadedFiles.length === 0}
      >
        {isUploading ? 'Uploading...' : 'Upload All Images'}
      </button>

      {uploadStatus && (
        <div className={`status-message ${uploadStatus.includes('Success') ? 'success' : 'error'}`}>
          {uploadStatus}
        </div>
      )}
    </div>
  );
};

export default Upload; 