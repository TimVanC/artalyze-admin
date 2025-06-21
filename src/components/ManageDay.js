import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import axiosInstance from '../axiosInstance';
import ImageModal from './ImageModal';
import './ManageDay.css';

const ManageDay = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [imagePairs, setImagePairs] = useState([]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPairs, setLoadingPairs] = useState(new Set()); // Track individual pair loading states
  const [bulkLoading, setBulkLoading] = useState(false); // Track bulk operation loading
  const [selectedPairs, setSelectedPairs] = useState(new Set()); // Track selected pairs for bulk operations

  // Fetch image pairs for the selected date
  const fetchImagePairs = useCallback(async () => {
    try {
      const adjustedDate = new Date(selectedDate);
      adjustedDate.setUTCHours(5, 0, 0, 0);
      const formattedDate = adjustedDate.toISOString().split("T")[0];

      console.log('Fetching pairs for date:', formattedDate);
      const response = await axiosInstance.get(`/admin/get-image-pairs-by-date/${formattedDate}`);
      console.log('Received pairs:', response.data);

      if (response.data) {
        setImagePairs(response.data.pairs || []);
        setMessage('');
        // Clear selections when changing dates
        setSelectedPairs(new Set());
      } else {
        setImagePairs([]);
        setMessage('No pairs scheduled for this date.');
        setSelectedPairs(new Set());
      }
    } catch (error) {
      console.error('Error fetching image pairs:', error);
      setError('Failed to fetch image pairs. Please try again.');
      setImagePairs([]);
      setSelectedPairs(new Set());
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchImagePairs();
  }, [fetchImagePairs]);

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setMessage('');
  };

  const handleImageClick = (imageUrl) => {
    setSelectedImage(imageUrl);
  };

  // Handle individual pair selection
  const handlePairSelection = (pairId) => {
    setSelectedPairs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pairId)) {
        newSet.delete(pairId);
      } else {
        newSet.add(pairId);
      }
      return newSet;
    });
  };

  // Handle select all/none
  const handleSelectAll = () => {
    if (selectedPairs.size === imagePairs.length) {
      // If all are selected, deselect all
      setSelectedPairs(new Set());
    } else {
      // Select all
      const allPairIds = imagePairs.map(pair => pair._id);
      setSelectedPairs(new Set(allPairIds));
    }
  };

  const handleRegenerateAI = async (pairId) => {
    try {
      // Set individual loading state for this pair
      setLoadingPairs(prev => {
        const newSet = new Set(prev);
        newSet.add(pairId);
        return newSet;
      });
      setError(null);
      
      const adjustedDate = new Date(selectedDate);
      adjustedDate.setUTCHours(5, 0, 0, 0);
      const formattedDate = adjustedDate.toISOString().split("T")[0];
      
      console.log('Regenerating AI image for:', { pairId, formattedDate });
      const response = await axiosInstance.post('/admin/regenerate-ai-image', {
        pairId,
        scheduledDate: formattedDate
      });
      console.log('Regenerate response:', response.data);

      // Update the image pairs with the new AI image
      setImagePairs(prevPairs => 
        prevPairs.map(pair => 
          pair._id === pairId 
            ? { ...pair, aiImageURL: response.data.newAiImageUrl }
            : pair
        )
      );

      setMessage('AI image regenerated successfully!');
    } catch (error) {
      console.error('Error regenerating AI image:', error);
      setError(error.response?.data?.error || 'Failed to regenerate AI image');
    } finally {
      // Clear individual loading state for this pair
      setLoadingPairs(prev => {
        const newSet = new Set(prev);
        newSet.delete(pairId);
        return newSet;
      });
    }
  };

  const handleDeletePair = async (pairId) => {
    if (!window.confirm('Are you sure you want to delete this pair? This action cannot be undone.')) {
      return;
    }

    try {
      // Set individual loading state for this pair
      setLoadingPairs(prev => new Set(prev).add(pairId));
      setError(null);

      const adjustedDate = new Date(selectedDate);
      adjustedDate.setUTCHours(5, 0, 0, 0);
      const formattedDate = adjustedDate.toISOString().split("T")[0];

      console.log('Deleting pair:', { pairId, formattedDate });
      await axiosInstance.delete('/admin/delete-pair', {
        data: {
          pairId,
          scheduledDate: formattedDate
        }
      });

      // Remove the deleted pair from the state
      setImagePairs(prevPairs => prevPairs.filter(pair => pair._id !== pairId));
      // Remove from selected pairs
      setSelectedPairs(prev => {
        const newSet = new Set(prev);
        newSet.delete(pairId);
        return newSet;
      });
      setMessage('Image pair deleted successfully!');
    } catch (error) {
      console.error('Error deleting pair:', error);
      setError(error.response?.data?.error || 'Failed to delete image pair');
    } finally {
      // Clear individual loading state for this pair
      setLoadingPairs(prev => {
        const newSet = new Set(prev);
        newSet.delete(pairId);
        return newSet;
      });
    }
  };

  const handleBulkRegenerate = async () => {
    if (selectedPairs.size === 0) {
      setError('Please select at least one pair to regenerate.');
      return;
    }

    if (!window.confirm(`Are you sure you want to regenerate ${selectedPairs.size} AI images? This may take several minutes.`)) {
      return;
    }

    try {
      setBulkLoading(true);
      setError(null);
      
      const adjustedDate = new Date(selectedDate);
      adjustedDate.setUTCHours(5, 0, 0, 0);
      const formattedDate = adjustedDate.toISOString().split("T")[0];
      
      console.log('Bulk regenerating selected AI images for:', formattedDate);
      const response = await axiosInstance.post('/admin/bulk-regenerate-selected-ai-images', {
        scheduledDate: formattedDate,
        pairIds: Array.from(selectedPairs)
      });
      console.log('Bulk regenerate response:', response.data);

      // Update the image pairs with new AI images
      setImagePairs(response.data.updatedPairs);
      setMessage(`Successfully regenerated ${response.data.updatedPairs.length} AI images!`);
      // Clear selections after successful operation
      setSelectedPairs(new Set());
    } catch (error) {
      console.error('Error bulk regenerating AI images:', error);
      setError(error.response?.data?.error || 'Failed to bulk regenerate AI images');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPairs.size === 0) {
      setError('Please select at least one pair to delete.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedPairs.size} image pairs? This action cannot be undone.`)) {
      return;
    }

    try {
      setBulkLoading(true);
      setError(null);

      const adjustedDate = new Date(selectedDate);
      adjustedDate.setUTCHours(5, 0, 0, 0);
      const formattedDate = adjustedDate.toISOString().split("T")[0];

      console.log('Bulk deleting selected pairs for:', formattedDate);
      await axiosInstance.delete('/admin/bulk-delete-selected-pairs', {
        data: {
          scheduledDate: formattedDate,
          pairIds: Array.from(selectedPairs)
        }
      });

      // Remove deleted pairs from state
      setImagePairs(prevPairs => prevPairs.filter(pair => !selectedPairs.has(pair._id)));
      setMessage(`Successfully deleted ${selectedPairs.size} image pairs!`);
      // Clear selections after successful operation
      setSelectedPairs(new Set());
    } catch (error) {
      console.error('Error bulk deleting pairs:', error);
      setError(error.response?.data?.error || 'Failed to bulk delete image pairs');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="manage-day-container">
      <h1>Manage Daily Pairs</h1>
      
      <div className="info-box">
        <p>View and manage automatically scheduled image pairs:</p>
        <ul>
          <li>Select a date to view its scheduled pairs</li>
          <li>Click on any image to enlarge it</li>
          <li>Use checkboxes to select pairs for bulk operations</li>
          <li>Use the regenerate button to create a new AI variation</li>
          <li>Use the delete button to remove a pair completely</li>
          <li>Use bulk operations to regenerate or delete selected pairs</li>
        </ul>
      </div>

      <div className="calendar-container">
        <Calendar onChange={handleDateClick} value={selectedDate} />
      </div>

      <div className="date-header">
        <h2>Pairs for {selectedDate.toDateString()}</h2>
        {imagePairs.length > 0 && (
          <div className="bulk-actions">
            <div className="selection-controls">
              <button 
                className="select-all-button"
                onClick={handleSelectAll}
                disabled={bulkLoading || loadingPairs.size > 0}
              >
                {selectedPairs.size === imagePairs.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="selection-count">
                {selectedPairs.size} of {imagePairs.length} selected
              </span>
            </div>
            <div className="bulk-operation-buttons">
              <button 
                className="bulk-regenerate-button"
                onClick={handleBulkRegenerate}
                disabled={bulkLoading || loadingPairs.size > 0 || selectedPairs.size === 0}
              >
                {bulkLoading ? (
                  <>
                    <span className="spinner"></span>
                    Regenerating...
                  </>
                ) : (
                  'Regenerate Selected'
                )}
              </button>
              <button 
                className="bulk-delete-button"
                onClick={handleBulkDelete}
                disabled={bulkLoading || loadingPairs.size > 0 || selectedPairs.size === 0}
              >
                {bulkLoading ? (
                  <>
                    <span className="spinner"></span>
                    Deleting...
                  </>
                ) : (
                  'Delete Selected'
                )}
              </button>
            </div>
          </div>
        )}
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
            {imagePairs.map((pair, index) => {
              const isPairLoading = loadingPairs.has(pair._id);
              const isSelected = selectedPairs.has(pair._id);
              return (
                <div key={pair._id || index} className={`existing-pair-container ${isSelected ? 'selected' : ''}`}>
                  <div className="pair-header">
                    <h4>Pair #{index + 1}</h4>
                    <label className="pair-checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handlePairSelection(pair._id)}
                        disabled={isPairLoading || bulkLoading}
                      />
                      <span className="checkmark"></span>
                    </label>
                  </div>
                  <div className="existing-images">
                    <div className="image-wrapper">
                      <img 
                        src={pair.humanImageURL} 
                        alt="Human Art" 
                        className="image-preview"
                        onClick={() => handleImageClick(pair.humanImageURL)}
                      />
                      <p>Human</p>
                    </div>
                    <div className="image-wrapper">
                      <img 
                        src={pair.aiImageURL} 
                        alt="AI Art" 
                        className={`image-preview ${isPairLoading ? 'loading' : ''}`}
                        onClick={() => handleImageClick(pair.aiImageURL)}
                      />
                      {isPairLoading && (
                        <div className="image-loader">
                          <div className="spinner"></div>
                          <p>Regenerating...</p>
                        </div>
                      )}
                      <p>AI</p>
                    </div>
                  </div>
                  <div className="pair-actions">
                    <button 
                      className="regenerate-button"
                      onClick={() => handleRegenerateAI(pair._id)}
                      disabled={isPairLoading || bulkLoading}
                    >
                      {isPairLoading ? (
                        <>
                          <span className="spinner"></span>
                          Regenerating...
                        </>
                      ) : (
                        'Regenerate AI'
                      )}
                    </button>
                    <button 
                      className="delete-button"
                      onClick={() => handleDeletePair(pair._id)}
                      disabled={isPairLoading || bulkLoading}
                    >
                      {isPairLoading ? (
                        <>
                          <span className="spinner"></span>
                          Deleting...
                        </>
                      ) : (
                        'Delete Pair'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
};

export default ManageDay;