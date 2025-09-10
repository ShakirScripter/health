import React, { useState } from 'react';
import API, { setAuthToken } from '../api';
import { useNavigate } from 'react-router-dom';

export default function Login({ onAuth }){
  const [email,setEmail]=useState('admin@example.com');
  const [password,setPassword]=useState('AdminPass123');
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    try{
      const { data } = await API.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setAuthToken(data.token);
      onAuth && onAuth(data.user, data.token);
      nav('/');
    }catch(err){
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <form onSubmit={submit} className="form">
      <h3>Login</h3>
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" />
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" />
      <button type="submit">Login</button>
    </form>
  );
}
