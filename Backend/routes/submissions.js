const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const shortid = require('shortid');
const sharp = require('sharp');

const Submission = require('../models/Submission');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();









// Map color codes to problems & treatments
function getColorForProblem(problem) {
  const colorMap = {
    "Stains": { color: "#ff0000" },
    "Inflammed Gums": { color: "#ff5252" },
    "Receded Gums": { color: "#ff6b6b" },
    "Malaligned": { color: "#ffff00" },
    "Attrition": { color: "#4caf50" },
    "Crowns": { color: "#2196f3" }
  };
  return colorMap[problem] || { color: "black" };
}

// Process annotations into findings and treatments
function processColorCodedAnnotations(annotationJson) {
  const findings = {
    "Stains": [],
    "Inflammed Gums": [],
    "Receded Gums": [],
    "Malaligned": [],
    "Attrition": [],
    "Crowns": []
  };

  const treatments = {};

  if (annotationJson && annotationJson.annotations) {
    annotationJson.annotations.forEach((ann, idx) => {
      switch (ann.color) {
        case "#ff0000":
          findings["Stains"].push(`Marked area ${idx + 1}`);
          treatments["Stains"] = "Teeth cleaning and polishing.";
          break;
        case "#ff5252":
          findings["Inflammed Gums"].push(`Marked area ${idx + 1}`);
          treatments["Inflammed Gums"] = "Scaling.";
          break;
        case "#ff6b6b":
          findings["Receded Gums"].push(`Marked area ${idx + 1}`);
          treatments["Receded Gums"] = "Gum surgery.";
          break;
        case "#ffff00":
          findings["Malaligned"].push(`Marked area ${idx + 1}`);
          treatments["Malaligned"] = "Braces or Clear Aligner.";
          break;
        case "#4caf50":
          findings["Attrition"].push(`Marked area ${idx + 1}`);
          treatments["Attrition"] = "Filling / Night Guard.";
          break;
        case "#2196f3":
          findings["Crowns"].push(`Marked area ${idx + 1}`);
          treatments["Crowns"] = "Evaluation and possible replacement.";
          break;
        default:
          break;
      }
    });
  }

  return { findings, treatments };
}











// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function(req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${shortid.generate()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function(req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Create submission (patient)
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { name, patientId, email, note } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image' });
    }

    const originalImageUrl = `/uploads/${req.file.filename}`;
    
    const submission = await Submission.create({
      name,
      patientId,
      email,
      note,
      originalImageUrl,
      createdBy: req.user._id
    });

    // Populate createdBy field
    await submission.populate('createdBy', 'name email');

    res.status(201).json(submission);
  } catch (error) {
    console.error('Submission creation error:', error);
    res.status(500).json({ message: 'Failed to create submission' });
  }
});

// Get all submissions (admin)
router.get('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const submissions = await Submission.find()
      .populate('createdBy', 'name email')
      .populate('annotatedBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(submissions);
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ message: 'Failed to fetch submissions' });
  }
});

// Get submissions for current user
router.get('/mine', auth, async (req, res) => {
  try {
    const submissions = await Submission.find({ createdBy: req.user._id })
      .populate('annotatedBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(submissions);
  } catch (error) {
    console.error('Get user submissions error:', error);
    res.status(500).json({ message: 'Failed to fetch submissions' });
  }
});

// Get single submission
router.get('/:id', auth, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('annotatedBy', 'name email');
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Check if user has access to this submission
    if (req.user.role !== 'admin' && String(submission.createdBy._id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(submission);
  } catch (error) {
    console.error('Get submission error:', error);
    res.status(500).json({ message: 'Failed to fetch submission' });
  }
});

// Annotate submission (admin) - THIS IS THE MISSING ENDPOINT
router.post('/:id/annotate', auth, requireRole('admin'), express.json({ limit: '50mb' }), async (req, res) => {
  try {
    console.log("Annotation request received for submission:", req.params.id);
    console.log("Request body keys:", Object.keys(req.body));
    
    const { annotationJson, annotatedImageBase64 } = req.body;
    const submission = await Submission.findById(req.params.id);
    
    if (!submission) {
      console.log("Submission not found:", req.params.id);
      return res.status(404).json({ message: 'Submission not found' });
    }

    console.log("Submission found, proceeding with annotation");

    // If we got a transparent PNG (just the admin's drawings)
    if (annotatedImageBase64) {
      console.log("Received annotated image base64 data");
      const matches = annotatedImageBase64.match(/^data:(.+);base64,(.+)$/);
      
      if (matches) {
        const ext = matches[1].split('/')[1] || 'png';
        const data = matches[2];

        // Paths
        const origPath = path.join(__dirname, '..', submission.originalImageUrl);
        const overlayBuffer = Buffer.from(data, 'base64');
        const outFilename = `${Date.now()}-annot-${shortid.generate()}.${ext}`;
        const outPath = path.join(uploadsDir, outFilename);

        console.log("Original image path:", origPath);
        console.log("Output annotated image path:", outPath);

        try {
          // Check if original image exists
          if (!fs.existsSync(origPath)) {
            console.error("Original image not found at path:", origPath);
            return res.status(500).json({ message: 'Original image not found' });
          }

          // Composite (merge) drawings onto the patient's original image
          await sharp(origPath)
            .composite([{ input: overlayBuffer, blend: 'over' }])
            .toFile(outPath);

          console.log("Annotation image created successfully");

          // Save new annotated image
          submission.annotatedImageUrl = `/uploads/${outFilename}`;
        } catch (err) {
          console.error('Overlay failed', err);
          return res.status(500).json({ message: 'Failed to merge annotation: ' + err.message });
        }
      } else {
        console.log("Invalid base64 format for annotated image");
      }
    } else {
      console.log("No annotatedImageBase64 received");
    }

    // Save annotation JSON
    if (annotationJson) {
      console.log("Saving annotation JSON with", annotationJson.annotations ? annotationJson.annotations.length : 0, "annotations");
      submission.annotationJson = annotationJson;
    } else {
      console.log("No annotationJson received");
    }
    
    submission.status = 'annotated';
    submission.annotatedBy = req.user._id;
    submission.annotatedAt = new Date();
    
    await submission.save();
    await submission.populate('annotatedBy', 'name email');

    console.log("Annotation saved successfully for submission:", submission._id);
    res.json(submission);
  } catch (error) {
    console.error('Annotation error:', error);
    res.status(500).json({ message: 'Failed to save annotation: ' + error.message });
  }
});

// Generate PDF (admin) - KEEP ONLY ONE VERSION OF THIS ENDPOINT

// Generate PDF (admin) - Single page version
router.post('/:id/generate-pdf', auth, requireRole('admin'), async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('annotatedBy', 'name email');
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const filename = `${Date.now()}-report-${shortid.generate()}.pdf`;
    const filepath = path.join(uploadsDir, filename);
    const writeStream = fs.createWriteStream(filepath);
    
    doc.pipe(writeStream);

    // Header with title - smaller font
    doc.fontSize(16).font('Helvetica-Bold').text('Oral Health Screening Report', 30, 30, { align: 'center' });
    
    // Horizontal line
    doc.moveTo(30, 55).lineTo(565, 55).stroke();

    // Patient Information - compact layout
    doc.fontSize(10).font('Helvetica-Bold');
doc.text(
  `Name: `, 
  30, 65, 
  { continued: true }
).font('Helvetica').text(
  `${submission.name || 'Not provided'}    `
, { continued: true });

doc.font('Helvetica-Bold').text(
  `Patient ID: `
, { continued: true }).font('Helvetica').text(
  `${submission.patientId || 'Not provided'}    `
, { continued: true });

doc.font('Helvetica-Bold').text(
  `Email: `
, { continued: true }).font('Helvetica').text(
  `${submission.email || 'Not provided'}    `
, { continued: true });

doc.font('Helvetica-Bold').text(
  `Date: `
, { continued: true }).font('Helvetica').text(
  submission.createdAt.toLocaleDateString()
);


    // Second horizontal line
    doc.moveTo(30, 125).lineTo(565, 125).stroke();

    // Process annotations to extract color-coded findings
    const colorMappings = processColorCodedAnnotations(submission.annotationJson);
    
    // SCREENING REPORT section - compact
    doc.fontSize(12).font('Helvetica-Bold').text('SCREENING REPORT:', 30, 140);
    
    // Display color-coded findings with color indicators - compact layout
    doc.fontSize(10);
    let yPosition = 160;
    
    // Display findings by color with color boxes - more compact
    Object.entries(colorMappings.findings).forEach(([problem, instances]) => {
      if (instances.length > 0 && yPosition < 400) { // Limit height for single page
        // Get color for this problem
        const colorInfo = getColorForProblem(problem);
        
        // Draw color indicator box
        doc.rect(30, yPosition, 8, 8).fill(colorInfo.color);
        
        // Draw problem text
        doc.font('Helvetica-Bold').fillColor('black')
           .text(`${problem}:`, 45, yPosition);
        
        yPosition += 12;
        
        // List each instance (more compact)
        instances.forEach(instance => {
          if (yPosition < 400) {
            doc.font('Helvetica').text(`• ${instance}`, 40, yPosition);
            yPosition += 10;
          }
        });
        
        yPosition += 5; // Add minimal spacing between problem groups
      }
    });

    // If no annotations found, show default screening items (compact)
    if (Object.values(colorMappings.findings).flat().length === 0 && yPosition < 400) {
      const defaultItems = [
        'Upper Teeth',
        'Front Teeth', 
        'Lower Teeth',
        'Inflammed / Red gums',
        'Malaligned',
        'Receded gums',
        'Stains',
        'Attrition',
        'Crowns'
      ];
      
      defaultItems.forEach((item) => {
        if (yPosition < 400) {
          doc.text(`• ${item}`, 40, yPosition);
          yPosition += 10;
        }
      });
      yPosition += 5;
    }

    // Images section - smaller and side by side
    const imageY = Math.max(yPosition, 160); // Ensure minimum spacing
    
    // Original image - smaller
    if (submission.originalImageUrl) {
      try {
        const originalImagePath = path.join(__dirname, '..', submission.originalImageUrl);
        if (fs.existsSync(originalImagePath)) {
          doc.fontSize(10).font('Helvetica-Bold').text('Original:', 30, imageY);
          doc.image(originalImagePath, 30, imageY + 15, { width: 150, height: 100 });
        }
      } catch (e) {
        console.warn('Original image add failed', e);
      }
    }

    // Annotated image - smaller
    if (submission.annotatedImageUrl) {
      try {
        const annotatedImagePath = path.join(__dirname, '..', submission.annotatedImageUrl);
        if (fs.existsSync(annotatedImagePath)) {
          doc.fontSize(10).font('Helvetica-Bold').text('Annotated:', 200, imageY);
          doc.image(annotatedImagePath, 200, imageY + 15, { width: 150, height: 100 });
        }
      } catch (e) {
        console.warn('Annotated image add failed', e);
      }
    }

    // TREATMENT RECOMMENDATIONS section - positioned to right of images
    const treatmentY = imageY;
    const treatmentX = 370; // Right side of page
    
    doc.fontSize(12).font('Helvetica-Bold').text('TREATMENT RECOMMENDATIONS:', treatmentX, treatmentY);
    
    let treatmentYPosition = treatmentY + 20;

    // Generate treatment recommendations based on color-coded findings
    doc.fontSize(10).font('Helvetica');
    
    // Display treatments by problem type with color indicators - compact
    Object.entries(colorMappings.treatments).forEach(([problem, treatment]) => {
      if (treatmentYPosition < 700) { // Keep within page bounds
        const colorInfo = getColorForProblem(problem);
        
        // Draw color indicator
        doc.rect(treatmentX, treatmentYPosition, 8, 8).fill(colorInfo.color);
        
        // Draw treatment text (compact)
        doc.fillColor('black').text(`${problem}: ${treatment}`, treatmentX + 15, treatmentYPosition, { 
          width: 180, // Limit width to fit in column
          align: 'left' 
        });
        
        treatmentYPosition += 25; // Compact spacing
      }
    });

    // If no specific recommendations, use default ones (compact)
    if (Object.keys(colorMappings.treatments).length === 0 && treatmentYPosition < 700) {
      const defaultRecommendations = [
        { problem: 'Inflammed/Red gums', treatment: 'Scaling.', color: '#ff5252' },
        { problem: 'Malaligned', treatment: 'Braces or Clear Aligner', color: '#ffff00' },
        { problem: 'Receded gums', treatment: 'Gum Surgery.', color: '#ff6b6b' },
        { problem: 'Stains', treatment: 'Teeth cleaning and polishing.', color: '#ff0000' },
        { problem: 'Attrition', treatment: 'Filling/ Night Guard.', color: '#4caf50' },
        { problem: 'Crowns', treatment: 'Evaluation and possible replacement.', color: '#2196f3' }
      ];
      
      defaultRecommendations.forEach((rec) => {
        if (treatmentYPosition < 700) {
          // Draw color indicator
          doc.rect(treatmentX, treatmentYPosition, 8, 8).fill(rec.color);
          
          // Draw treatment text
          doc.fillColor('black').text(`${rec.problem}: ${rec.treatment}`, treatmentX + 15, treatmentYPosition, { 
            width: 180,
            align: 'left' 
          });
          
          treatmentYPosition += 25;
        }
      });
    }

    // Color legend - compact version at bottom
    const legendY = Math.max(imageY + 130, treatmentYPosition + 10);
    
    if (legendY < 700) {
      doc.fontSize(10).font('Helvetica-Bold').text('Color Legend:', 30, legendY);
      
      let legendX = 30;
      let legendRowY = legendY + 15;
      
      const legendItems = [
        { color: '#ff0000', name: 'Red: Stains' },
        { color: '#ff5252', name: 'Cherry: Inflammed Gums' },
        { color: '#ff6b6b', name: 'Light Red: Receded Gums' },
        { color: '#ffff00', name: 'Yellow: Malaligned' },
        { color: '#4caf50', name: 'Green: Attrition' },
        { color: '#2196f3', name: 'Blue: Crowns' }
      ];
      
      // Display legend in two columns to save space
      legendItems.forEach((item, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        
        const xPos = column === 0 ? 30 : 150;
        const yPos = legendRowY + (row * 15);
        
        if (yPos < 750) {
          // Draw color box
          doc.rect(xPos, yPos, 8, 8).fill(item.color);
          
          // Draw text
          doc.font('Helvetica').fillColor('black');
          doc.text(item.name, xPos + 15, yPos);
        }
      });
    }

    // Footer - compact
    doc.fontSize(8).font('Helvetica-Oblique');
    doc.text(
      `Report generated on ${new Date().toLocaleDateString()} by OralVis Healthcare System`,
      30,
      780,
      { width: 535, align: 'center' }
    );

    doc.end();

    writeStream.on('finish', async () => {
      try {
        // Update submission with report URL
        submission.reportUrl = `/uploads/${filename}`;
        submission.status = 'reported';
        await submission.save();
        
        res.json({ 
          message: 'PDF generated successfully',
          reportUrl: submission.reportUrl
        });
      } catch (error) {
        console.error('Error updating submission with report URL:', error);
        res.status(500).json({ message: 'PDF generated but failed to update submission' });
      }
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ message: 'Failed to generate PDF' });
  }
});

module.exports = router;