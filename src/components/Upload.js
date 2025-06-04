import React, { useState, useEffect, useRef } from 'react';
import DropzoneComponent from './DropzoneComponent';
import axiosInstance from '../axiosInstance';
import { v4 as uuidv4 } from 'uuid';
import { STAGING_BASE_URL } from '../config';
import './Upload.css';

const Upload = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const eventSourceRef = useRef(null);

  // Cleanup function for SSE connection
  const cleanupSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => cleanupSSE();
  }, []);

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

  const setupSSE = (sessionId) => {
    // Clean up any existing connection
    cleanupSSE();

    const token = localStorage.getItem('adminToken');
    const url = new URL(`${STAGING_BASE_URL}/admin/progress-updates/${sessionId}`);
    
    // Create EventSource with Authorization header
    const eventSource = new EventSourceWithAuth(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });

    eventSource.onopen = () => {
      console.log('SSE connection opened');
    };

    eventSource.onmessage = (event) => {
      try {
        const { message, type } = JSON.parse(event.data);
        console.log('SSE message received:', { message, type });
        setUploadStatus(message);
        // Update status message styling based on type
        const statusElement = document.querySelector('.status-message');
        if (statusElement) {
          statusElement.className = `status-message ${type || 'info'}`;
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Only show error if we're still uploading
      if (isUploading) {
        setUploadStatus('Connection interrupted. Upload may still be processing...');
      }
    };

    eventSourceRef.current = eventSource;
    return eventSource;
  };

  // Custom EventSource class that supports headers
  class EventSourceWithAuth {
    constructor(url, options = {}) {
      this.url = url;
      this.options = options;
      this.eventSource = null;
      this.listeners = {
        open: [],
        message: [],
        error: []
      };
      this.connect();
    }

    connect() {
      // Create fetch request with headers
      fetch(this.url, {
        method: 'GET',
        headers: this.options.headers,
        credentials: this.options.withCredentials ? 'include' : 'same-origin'
      }).then(response => {
        if (response.ok) {
          // If auth successful, create regular EventSource
          this.eventSource = new EventSource(this.url, {
            withCredentials: this.options.withCredentials
          });

          // Forward all events
          this.eventSource.onopen = (e) => this.listeners.open.forEach(fn => fn(e));
          this.eventSource.onmessage = (e) => this.listeners.message.forEach(fn => fn(e));
          this.eventSource.onerror = (e) => this.listeners.error.forEach(fn => fn(e));
        } else {
          throw new Error(`Auth failed: ${response.status}`);
        }
      }).catch(error => {
        console.error('EventSource auth error:', error);
        this.listeners.error.forEach(fn => fn(new Event('error')));
      });
    }

    addEventListener(type, callback) {
      if (this.listeners[type]) {
        this.listeners[type].push(callback);
      }
    }

    removeEventListener(type, callback) {
      if (this.listeners[type]) {
        this.listeners[type] = this.listeners[type].filter(fn => fn !== callback);
      }
    }

    set onopen(fn) {
      this.listeners.open = [fn];
    }

    set onmessage(fn) {
      this.listeners.message = [fn];
    }

    set onerror(fn) {
      this.listeners.error = [fn];
    }

    close() {
      if (this.eventSource) {
        this.eventSource.close();
      }
      this.eventSource = null;
      this.listeners = {
        open: [],
        message: [],
        error: []
      };
    }
  }

  const handleUpload = async () => {
    if (uploadedFiles.length === 0) {
      setUploadStatus('Please add some images first.');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Starting upload process...');

    try {
      // Upload each image
      for (const file of uploadedFiles) {
        const sessionId = uuidv4();
        const formData = new FormData();
        formData.append('humanImage', file);
        formData.append('sessionId', sessionId);
        formData.append('scheduledDate', '');

        // Set up SSE connection for this upload
        setupSSE(sessionId);

        try {
          const response = await axiosInstance.post('/admin/upload-human-image', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });

          // Wait a bit before closing the connection to ensure we get all messages
          setTimeout(() => {
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }
          }, 2000);

          console.log('Upload response:', response.data);
        } catch (error) {
          console.error('Upload error:', error);
          setUploadStatus(`Failed to upload ${file.name}. Continuing with remaining files...`);
        }
      }

      setUploadStatus(`Successfully uploaded ${uploadedFiles.length} images! They will be automatically paired with AI images and scheduled.`);
      setUploadedFiles([]);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('Failed to upload images. Please try again.');
    } finally {
      setIsUploading(false);
      // Final cleanup
      setTimeout(cleanupSSE, 2000);
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
        <div className={`status-message ${uploadStatus.includes('Success') ? 'success' : uploadStatus.includes('Error') || uploadStatus.includes('Failed') ? 'error' : 'info'}`}>
          {uploadStatus}
        </div>
      )}
    </div>
  );
};

export default Upload; 