Oral Health Screening System - Architecture Overview
System Architecture Diagram
text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│    │  Node.js/Express│    │   MongoDB       │
│   (Patient)     │◄──►│   Backend       │◄──►│   Database      │
│   React Frontend│    │   Server        │    │                 │
│   (Admin)       │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │    │   REST API      │    │   Image Storage │
│   User Interface│    │   Endpoints     │    │   (File System) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
How the System Works
1. Patient Submission Flow
text
Patient → Uploads dental image → Image saved to server → Submission created in DB → Status: Pending
2. Admin Annotation Flow
text
Admin → Views pending submissions → Annotates image with color codes → 
Annotations processed → Findings extracted → Status: Annotated
3. Report Generation Flow
text
Admin → Generates PDF report → Color codes converted to findings → 
Treatment recommendations created → PDF saved → Status: Reported
4. Color Coding System
text
Red (#ff0000)       → Stains           → Teeth cleaning
Cherry (#ff5252)    → Inflammed Gums   → Scaling
Light Red (#ff6b6b) → Receded Gums     → Gum surgery
Yellow (#ffff00)    → Malaligned       → Braces or aligners
Green (#4caf50)     → Attrition        → Filling/Night guard
Blue (#2196f3)      → Crowns           → Evaluation/replacement
Project Structure
text
oral-health-app/
├── backend/
│   ├── models/
│   │   └── Submission.js
│   ├── routes/
│   │   └── submissions.js
│   ├── middleware/
│   │   └── auth.js
│   ├── uploads/
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.js
│   └── package.json
└── README.md
Technology Stack
Frontend: React.js with Axios for API calls

Backend: Node.js with Express.js

Database: MongoDB with Mongoose ODM

File Processing: Multer for uploads, Sharp for image processing

PDF Generation: PDFKit for report creation

Authentication: JWT for secure access
