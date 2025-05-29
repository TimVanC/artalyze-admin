import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { BASE_URL } from "../config";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Import calendar styles
import DropzoneComponent from './DropzoneComponent';
import axios from 'axios';
import axiosInstance from '../axiosInstance';
import './ManageDay.css';

// Component for managing image pairs for a specific date
const ManageDay = () => {
  // Keep track of the selected date and image pairs
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [humanImages, setHumanImages] = useState(Array(5).fill(null));
  const [imagePairs, setImagePairs] = useState([]); // State to store the fetched image pairs
  const [error, setError] = useState(null); // State for managing error messages
  const [uploadMessage, setUploadMessage] = useState(''); // State for managing upload messages

  // Grab the image pairs for the selected date
  const fetchImagePairs = useCallback(async () => {
    try {
      // Adjust the date to EST/EDT timezone
      const adjustedDate = new Date(selectedDate);
      adjustedDate.setUTCHours(5, 0, 0, 0);
      const formattedDate = adjustedDate.toISOString().split("T")[0];

      console.log('Fetching Image Pairs for:', formattedDate);
      const response = await axiosInstance.get(`/admin/get-image-pairs-by-date/${formattedDate}`);

      if (response.data && response.data.pairs) {
        setImagePairs(response.data.pairs);
      } else {
        setImagePairs([]);
      }
    } catch (error) {
      console.error('Error fetching image pairs:', error);
      setImagePairs([]);
    }
  }, [selectedDate]);

  // Fetch image pairs whenever the selected date changes
  useEffect(() => {
    fetchImagePairs();
  }, [fetchImagePairs]); // Runs only when `fetchImagePairs` changes

  // Handle date selection from the calendar
  const handleDateClick = (date) => {
    setSelectedDate(date);
    setUploadMessage(''); // Clear any existing upload messages when a new date is selected
  };

  // Handle file drops in the dropzones
  const onDrop = (acceptedFiles, index) => {
    const file = acceptedFiles[0];
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file.');
      return;
    }

    const updatedImages = [...humanImages];
    updatedImages[index] = file;
    setHumanImages(updatedImages);
  };

  // Upload the image pairs to the server
  const handleUpload = async () => {
    if (!selectedDate) {
      setUploadMessage('Please select a date first.');
      return;
    }

    const filledImages = humanImages.filter(img => img !== null);
    if (filledImages.length === 0) {
      setUploadMessage('Please upload at least one human image.');
      return;
    }

    try {
      // Adjust the date for daylight savings
      const date = new Date(selectedDate);
      const isDaylightSaving = date.getMonth() >= 2 && date.getMonth() <= 10;
      date.setUTCHours(isDaylightSaving ? 4 : 5, 0, 0, 0);

      // Upload each human image
      for (let i = 0; i < humanImages.length; i++) {
        const image = humanImages[i];
        if (!image) continue;

        const formData = new FormData();
        formData.append('humanImage', image);
        formData.append('scheduledDate', date.toISOString());

        try {
          await axiosInstance.post('/admin/upload-human-image', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
        } catch (error) {
          console.error('Upload failed:', error);
          setUploadMessage('Some uploads failed. Please try again.');
          return;
        }
      }

      setUploadMessage('Human images uploaded successfully! AI pairs will be generated automatically.');
      setHumanImages(Array(5).fill(null));
      fetchImagePairs(); // Refresh the image pairs
    } catch (error) {
      console.error('Upload error:', error);
      setUploadMessage('Failed to upload images. Please try again.');
    }
  };

  return (
    <div className="manage-day-container">
      <h1>Upload Human Images</h1>
      <div className="info-box">
        <p>Upload human artworks here. The system will automatically:</p>
        <ul>
          <li>Generate matching AI images using GPT-4 and Stable Diffusion</li>
          <li>Create puzzle pairs for future dates</li>
          <li>Move used images to an archive folder</li>
        </ul>
      </div>

      <div className="calendar-container">
        <Calendar onClickDay={handleDateClick} />
      </div>

      {selectedDate && (
        <>
          <h2>Upload Images for {selectedDate.toDateString()}</h2>
          {error && <p className="error-message">{error}</p>}

          {/* Show existing image pairs for the selected date */}
          <div className="existing-image-pairs-container">
            <h3>Existing Image Pairs for {selectedDate.toDateString()}</h3>
            {imagePairs.length === 0 && <p>No existing image pairs found for this date.</p>}
            <div className="existing-pairs-wrapper">
              {imagePairs.map((pair, index) => (
                <div key={index} className="existing-pair-container">
                  <h4>Pair #{index + 1}</h4>
                  <div className="existing-images">
                    <div className="image-wrapper">
                      <img src={pair.humanImageURL} alt="Human Art" className="image-preview" />
                      <p>Human</p>
                    </div>
                    <div className="image-wrapper">
                      <img src={pair.aiImageURL} alt="AI Art" className="image-preview" />
                      <p>AI</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upload dropzones */}
          <div className="upload-section">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="upload-container">
                <h3>Human Image {index + 1}</h3>
                <DropzoneComponent
                  onDrop={(files) => onDrop(files, index)}
                  label="Drop Human Image Here"
                  currentFile={humanImages[index]}
                />
              </div>
            ))}
          </div>

          <button 
            className="upload-button" 
            onClick={handleUpload}
            disabled={!humanImages.some(img => img !== null)}
          >
            Upload Human Images
          </button>
          {uploadMessage && <p className="upload-message">{uploadMessage}</p>}
        </>
      )}
    </div>
  );
};

export default ManageDay;