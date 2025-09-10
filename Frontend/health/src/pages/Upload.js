import React, { useState } from 'react';
import API, { setAuthToken } from '../api';

export default function Upload({ token }){
  const [name,setName]=useState('');
  const [patientId,setPatientId]=useState('');
  const [email,setEmail]=useState('');
  const [note,setNote]=useState('');
  const [file,setFile]=useState(null);

  if(token) setAuthToken(token);

  const submit = async e => {
    e.preventDefault();
    try{
      const fd = new FormData();
      fd.append('name', name);
      fd.append('patientId', patientId);
      fd.append('email', email);
      fd.append('note', note);
      if(file) fd.append('image', file);
      const { data } = await API.post('/submissions', fd);
      alert('Uploaded');
    }catch(err){ alert(err.response?.data?.message || err.message); }
  };

  return (
    <form onSubmit={submit} className="form">
      <h3>Upload Submission</h3>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" required />
      <input value={patientId} onChange={e=>setPatientId(e.target.value)} placeholder="Patient ID" />
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
      <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Note" />
      <input type="file" onChange={e=>setFile(e.target.files[0])} accept="image/*" />
      <button type="submit">Upload</button>
    </form>
  );
}
