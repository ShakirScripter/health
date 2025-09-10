// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';

const Dashboard = ({ user }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const response = await API.get('/submissions/mine');
      setSubmissions(response.data);
    } catch (error) {
      console.error('Failed to fetch submissions', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading submissions...</div>;
  }

  return (
    <div>
      <div className="dashboard-header">
        <h1>My Submissions</h1>
        <Link to="/submit" className="btn btn-success">New Submission</Link>
      </div>

      {submissions.length === 0 ? (
        <div className="card">
          <div className="card-body text-center">
            <p>You haven't made any submissions yet.</p>
            <Link to="/submit" className="btn btn-success">Create Your First Submission</Link>
          </div>
        </div>
      ) : (
        <div className="submissions-grid">
          {submissions.map(submission => (
            <div key={submission._id} className="card submission-card">
              <img 
                src={`http://localhost:5000${submission.originalImageUrl}`} 
                alt="Submission" 
                className="submission-image"
              />
              <div className="card-body">
                <h3 className="card-title">{submission.name}</h3>
                <p><strong>Patient ID:</strong> {submission.patientId}</p>
                <p><strong>Status:</strong> 
                  <span className={`submission-status status-${submission.status}`}>
                    {submission.status}
                  </span>
                </p>
                <p><strong>Submitted:</strong> {new Date(submission.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="card-footer">
                <Link to={`/submission/${submission._id}`} className="btn">
                  View Details
                </Link>
                {submission.reportUrl && (
                  <a 
                    href={`http://localhost:5000${submission.reportUrl}`} 
                    className="btn btn-success"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download Report
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;