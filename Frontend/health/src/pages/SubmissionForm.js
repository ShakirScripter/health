import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

const SubmissionForm = ({ user }) => {
  const [formData, setFormData] = useState({
    name: '',
    patientId: user.patientId || '',
    email: user.email || '',
    note: '',
    image: null
  });
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { name, patientId, email, note } = formData;

  const onChange = e => {
    if (e.target.name === 'image') {
      const file = e.target.files[0];
      setFormData({ ...formData, image: file });
      
      // Create preview
      if (file) {
        const reader = new FileReader();
        reader.onload = e => setPreview(e.target.result);
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.image) {
      setError('Please select an image');
      setLoading(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', name);
      formDataToSend.append('patientId', patientId);
      formDataToSend.append('email', email);
      formDataToSend.append('note', note);
      formDataToSend.append('image', formData.image);

      const res = await API.post('/submissions', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h1 className="form-title">New Submission</h1>
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label className="form-label">Name</label>
          <input
            type="text"
            className="form-input"
            name="name"
            value={name}
            onChange={onChange}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Patient ID</label>
          <input
            type="text"
            className="form-input"
            name="patientId"
            value={patientId}
            onChange={onChange}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-input"
            name="email"
            value={email}
            onChange={onChange}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input form-textarea"
            name="note"
            value={note}
            onChange={onChange}
            placeholder="Any additional notes about your submission..."
          />
        </div>
        <div className="form-group">
          <label className="form-label">Teeth Photo</label>
          <input
            type="file"
            className="form-input form-file"
            name="image"
            onChange={onChange}
            accept="image/*"
            required
          />
          {preview && (
            <div className="mt-2">
              <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '300px' }} />
            </div>
          )}
        </div>
        <button type="submit" className="btn btn-block" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </div>
  );
};

export default SubmissionForm;