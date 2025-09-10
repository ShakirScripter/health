// src/components/Navbar.js
import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = ({ user, logout }) => {
  const handleLogout = () => {
    logout();
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="nav-link">OralVis Healthcare</Link>
      </div>
      
      <ul className="navbar-nav">
        {user ? (
          <>
            <li>
              <span className="nav-link">Welcome, {user.name}</span>
            </li>
            {user.role === 'admin' ? (
              <li>
                <Link to="/admin" className="nav-link">Admin Dashboard</Link>
              </li>
            ) : (
              <>
                <li>
                  <Link to="/dashboard" className="nav-link">Dashboard</Link>
                </li>
                <li>
                  <Link to="/submit" className="nav-link">New Submission</Link>
                </li>
              </>
            )}
            <li>
              <button onClick={handleLogout} className="nav-link btn">Logout</button>
            </li>
          </>
        ) : (
          <>
            <li>
              <Link to="/login" className="nav-link">Login</Link>
            </li>
            <li>
              <Link to="/register" className="nav-link">Register</Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;