import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import axiosInstance from '../axiosInstance';
import './ManageDay.css';

const ManageDay = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [imagePairs, setImagePairs] = useState([]);
  const [pendingImages, setPendingImages] = useState([]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  // Fetch image pairs for the selected date
  const fetchImagePairs = useCallback(async () => {
    try {
      const adjustedDate = new Date(selectedDate);
      adjustedDate.setUTCHours(5, 0, 0, 0);
      const formattedDate = adjustedDate.toISOString().split("T")[0];

      const response = await axiosInstance.get(`/admin/get-image-pairs-by-date/${formattedDate}`);

      if (response.data) {
        setImagePairs(response.data.pairs || []);
        setPendingImages(response.data.pendingHumanImages || []);
        setMessage('');
      } else {
        setImagePairs([]);
        setPendingImages([]);
        setMessage('No pairs scheduled for this date.');
      }
    } catch (error) {
      console.error('Error fetching image pairs:', error);
      setError('Failed to fetch image pairs. Please try again.');
      setImagePairs([]);
      setPendingImages([]);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchImagePairs();
  }, [fetchImagePairs]);

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setMessage('');
  };

  return (
    <div className="manage-day-container">
      <h1>Manage Daily Pairs</h1>
      
      <div className="info-box">
        <p>View and manage automatically scheduled image pairs:</p>
        <ul>
          <li>Select a date to view its scheduled pairs</li>
          <li>Each day can have up to 5 pairs</li>
          <li>Pending human images are waiting for AI pair generation</li>
          <li>To add more images, use the Upload page</li>
        </ul>
      </div>

      <div className="calendar-container">
        <Calendar onChange={handleDateClick} value={selectedDate} />
      </div>

      <div className="date-header">
        <h2>Pairs for {selectedDate.toDateString()}</h2>
      </div>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="info-message">{message}</div>}

      {/* Display completed pairs */}
      <div className="existing-image-pairs-container">
        <h3>Completed Pairs</h3>
        {imagePairs.length === 0 ? (
          <p className="no-pairs-message">No completed pairs for this date.</p>
        ) : (
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
        )}
      </div>

      {/* Display pending human images */}
      {pendingImages.length > 0 && (
        <div className="pending-images-container">
          <h3>Pending Human Images</h3>
          <p className="info-text">These images are queued for AI pair generation</p>
          <div className="pending-images-grid">
            {pendingImages.map((image, index) => (
              <div key={index} className="pending-image-wrapper">
                <img src={image.url} alt={`Pending Human Art ${index + 1}`} className="image-preview" />
                <p>Uploaded {new Date(image.uploadedAt).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageDay;