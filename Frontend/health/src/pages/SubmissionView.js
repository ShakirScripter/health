import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import API from '../api';
import './AnnotationTool.css';

const SubmissionView = ({ user }) => {
  const { id } = useParams();
  const [submission, setSubmission] = useState(null);
  const [tool, setTool] = useState('freehand');
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [annotations, setAnnotations] = useState([]);
  const [lineWidth, setLineWidth] = useState(3);
  const [debugInfo, setDebugInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const canvasRef = useRef();
  const imageRef = useRef(null);
  const containerRef = useRef();

  // Define the color palette with dental problem mapping
  const colorPalette = [
    { value: '#ff0000', name: 'Red - Stains' },
    { value: '#ff5252', name: 'Cherry Red - Inflammed Gums' },
    { value: '#ff6b6b', name: 'Light Red - Receded Gums' },
    { value: '#ffff00', name: 'Yellow - Malaligned' },
    { value: '#4caf50', name: 'Green - Attrition' },
    { value: '#2196f3', name: 'Blue - Crowns' }
  ];

  // Set the default color
  const [color, setColor] = useState(colorPalette[0].value);

  useEffect(() => {
    fetchSubmission();
  }, [id]);

  const fetchSubmission = async () => {
    try {
      setIsLoading(true);
      const { data } = await API.get(`/submissions/${id}`);
      setSubmission(data);
      if (data.annotationJson && data.annotationJson.annotations) {
        setAnnotations(data.annotationJson.annotations);
      }
      setDebugInfo('Submission loaded successfully');
      
      // Load the image with CORS handling
      loadImageForCanvas(data);
    } catch (error) {
      console.error('Failed to fetch submission', error);
      setDebugInfo('Load failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const loadImageForCanvas = (submissionData) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      imageRef.current = img;
      
      // Set the actual image dimensions
      setImageDimensions({
        width: img.width,
        height: img.height
      });
      
      // Initialize canvas with proper dimensions
      initializeCanvas(img);
      
      setDebugInfo(`Image loaded: ${img.width}x${img.height}`);
    };
    
    img.onerror = (err) => {
      console.error('Error loading image:', err);
      setDebugInfo('Error loading image. Please check console for details.');
    };
    
    // Load the image with timestamp to avoid caching issues
    const timestamp = new Date().getTime();
    if (submissionData.annotatedImageUrl) {
      img.src = `http://localhost:5000${submissionData.annotatedImageUrl}?t=${timestamp}`;
    } else if (submissionData.originalImageUrl) {
      img.src = `http://localhost:5000${submissionData.originalImageUrl}?t=${timestamp}`;
    }
  };

  const initializeCanvas = (img) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    if (!canvas || !container || !img) return;
    
    // Set canvas to actual image dimensions
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Draw the image on canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // Redraw any existing annotations
    redrawCanvas(ctx, img);
  };

  // Redraw canvas with annotations
  const redrawCanvas = (ctx, img) => {
    if (!img) return;
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(img, 0, 0);
    
    // Draw all saved annotations
    annotations.forEach(ann => {
      drawAnnotation(ctx, ann);
    });
  };

  // Draw a single annotation
  const drawAnnotation = (ctx, ann) => {
    if (!ann) return;
    
    ctx.strokeStyle = ann.color || '#ff0000';
    ctx.lineWidth = ann.lineWidth || 3;
    ctx.beginPath();
    
    switch (ann.type) {
      case 'freehand':
        if (ann.points && ann.points.length > 0) {
          ctx.moveTo(ann.points[0].x, ann.points[0].y);
          ann.points.forEach(point => {
            ctx.lineTo(point.x, point.y);
          });
        }
        break;
      case 'rectangle':
        const rectWidth = ann.endX - ann.startX;
        const rectHeight = ann.endY - ann.startY;
        ctx.rect(ann.startX, ann.startY, rectWidth, rectHeight);
        break;
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(ann.endX - ann.startX, 2) + 
          Math.pow(ann.endY - ann.startY, 2)
        );
        ctx.arc(ann.startX, ann.startY, radius, 0, 2 * Math.PI);
        break;
      case 'arrow':
        ctx.moveTo(ann.startX, ann.startY);
        ctx.lineTo(ann.endX, ann.endY);
        
        // Draw arrowhead
        const angle = Math.atan2(ann.endY - ann.startY, ann.endX - ann.startX);
        const headLength = 15;
        ctx.lineTo(
          ann.endX - headLength * Math.cos(angle - Math.PI / 6),
          ann.endY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(ann.endX, ann.endY);
        ctx.lineTo(
          ann.endX - headLength * Math.cos(angle + Math.PI / 6),
          ann.endY - headLength * Math.sin(angle + Math.PI / 6)
        );
        break;
      default:
        break;
    }
    
    ctx.stroke();
  };

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factors
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Get mouse position relative to canvas
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return { x, y };
  };

  const startDrawing = (e) => {
    if (user.role !== 'admin') return;
    
    const { x, y } = getCanvasCoordinates(e);
    
    setStartPos({ x, y });
    setCurrentPos({ x, y });
    setDrawing(true);
    
    if (tool === 'freehand') {
      // For freehand, start a new path with points array
      setAnnotations([...annotations, {
        type: 'freehand',
        points: [{ x, y }],
        color,
        lineWidth
      }]);
    }
    
    setDebugInfo(`Started drawing at ${Math.round(x)}, ${Math.round(y)} with tool: ${tool}`);
  };

  const draw = (e) => {
    if (!drawing || user.role !== 'admin') return;
    
    const { x, y } = getCanvasCoordinates(e);
    
    setCurrentPos({ x, y });
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (tool === 'freehand') {
      // Add point to the current freehand drawing
      const updatedAnnotations = [...annotations];
      if (updatedAnnotations.length > 0) {
        const currentAnnotation = updatedAnnotations[updatedAnnotations.length - 1];
        currentAnnotation.points.push({ x, y });
        setAnnotations(updatedAnnotations);
      }
      
      // Draw in real-time - redraw the base image first
      if (imageRef.current) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageRef.current, 0, 0);
        
        // Then draw all annotations
        annotations.forEach(ann => {
          drawAnnotation(ctx, ann);
        });
      }
    } else {
      // For other tools, just redraw for preview
      if (imageRef.current) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageRef.current, 0, 0);
        
        // Draw all saved annotations
        annotations.forEach(ann => {
          drawAnnotation(ctx, ann);
        });
        
        // Draw the current preview
        const tempAnnotation = {
          type: tool,
          startX: startPos.x,
          startY: startPos.y,
          endX: x,
          endY: y,
          color,
          lineWidth
        };
        drawAnnotation(ctx, tempAnnotation);
      }
    }
  };

  const stopDrawing = () => {
    if (!drawing || user.role !== 'admin') return;
    
    setDrawing(false);
    
    if (tool !== 'freehand') {
      // Save the shape annotation
      const newAnnotation = {
        type: tool,
        startX: startPos.x,
        startY: startPos.y,
        endX: currentPos.x,
        endY: currentPos.y,
        color,
        lineWidth
      };
      
      setAnnotations([...annotations, newAnnotation]);
      
      // Redraw canvas to include the new annotation
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (imageRef.current) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageRef.current, 0, 0);
        annotations.forEach(ann => {
          drawAnnotation(ctx, ann);
        });
        drawAnnotation(ctx, newAnnotation);
      }
    }
    
    setDebugInfo(`Stopped drawing. Total annotations: ${annotations.length}`);
  };

  const saveAnnotation = async () => {
    try {
      setIsLoading(true);
      setDebugInfo('Saving annotations...');
      
      // First, create the flattened image
      const canvas = canvasRef.current;
      
      // Create a new canvas to avoid tainted canvas issues
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      // Draw the original image first
      if (imageRef.current) {
        tempCtx.drawImage(imageRef.current, 0, 0);
      }
      
      // Then draw all annotations on top
      annotations.forEach(ann => {
        drawAnnotation(tempCtx, ann);
      });
      
      // Get the data URL from the temporary canvas
      const dataUrl = tempCanvas.toDataURL("image/png");
      
      // Prepare the annotation data
      const annotationData = {
        annotatedImageBase64: dataUrl,
        annotationJson: { 
          annotations,
          savedAt: new Date() 
        }
      };
      
      setDebugInfo(`Sending ${annotations.length} annotations to server`);
      
      // Make sure we're using the correct endpoint
      const { data } = await API.post(`/submissions/${id}/annotate`, annotationData);
      
      setDebugInfo('Annotations saved successfully!');
      setSubmission(data);
      
      // Update our image reference to the newly annotated image
      const newImg = new Image();
      newImg.crossOrigin = 'Anonymous';
      newImg.onload = () => {
        imageRef.current = newImg;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(newImg, 0, 0);
        setDebugInfo('Loaded new annotated image');
      };
      newImg.src = `http://localhost:5000${data.annotatedImageUrl}?t=${new Date().getTime()}`;
      
      alert("Annotation saved successfully!");
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('Save error:', error);
      setDebugInfo('Save failed: ' + errorMsg);
      alert("Save failed: " + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const clearCanvas = () => {
    if (window.confirm("Are you sure you want to clear all annotations?")) {
      setAnnotations([]);
      
      // Redraw just the original image
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (imageRef.current) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageRef.current, 0, 0);
      }
      
      setDebugInfo('Canvas cleared');
    }
  };

  const genPdf = async () => {
    try {
      setIsLoading(true);
      setDebugInfo('Generating PDF...');
      
      const { data } = await API.post(`/submissions/${id}/generate-pdf`);
      
      setDebugInfo('PDF generated successfully');
      alert('PDF generated: ' + data.reportUrl);
      
      // Refresh the submission to get the updated report URL
      await fetchSubmission();
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error(error);
      setDebugInfo('PDF generation failed: ' + errorMsg);
      alert('PDF generation failed: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div className="loading">Loading...</div>;
  if (!submission) return <div>Loading submission...</div>;
  
  return (
    <div className="annotation-container">
      <h3>Submission {submission._id}</h3>
      <p><strong>Name:</strong> {submission.name}</p>
      <p><strong>Patient ID:</strong> {submission.patientId}</p>
      <p><strong>Email:</strong> {submission.email}</p>
      <p><strong>Note:</strong> {submission.note}</p>
      <p><strong>Status:</strong> 
        <span className={`submission-status status-${submission.status}`}>
          {submission.status}
        </span>
      </p>
      <p><strong>Submitted:</strong> {new Date(submission.createdAt).toLocaleString()}</p>
      <p><strong>Image Dimensions:</strong> {imageDimensions.width} × {imageDimensions.height} pixels</p>
      
      {user && user.role === 'admin' && (
        <div className="toolbar">
          <div className="tool-section">
            <span>Tools:</span>
            <button 
              className={tool === 'select' ? 'active' : ''} 
              onClick={() => setTool('select')}
            >
              Select
            </button>
            <button 
              className={tool === 'freehand' ? 'active' : ''} 
              onClick={() => setTool('freehand')}
            >
              Freehand
            </button>
            <button 
              className={tool === 'rectangle' ? 'active' : ''} 
              onClick={() => setTool('rectangle')}
            >
              Rectangle
            </button>
            <button 
              className={tool === 'circle' ? 'active' : ''} 
              onClick={() => setTool('circle')}
            >
              Circle
            </button>
            <button 
              className={tool === 'arrow' ? 'active' : ''} 
              onClick={() => setTool('arrow')}
            >
              Arrow
            </button>
          </div>
          
          {/* Color selection dropdown */}
          <div className="tool-section">
            <span>Annotation Type:</span>
            <select 
              value={color} 
              onChange={(e) => setColor(e.target.value)}
              style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              {colorPalette.map(colorOption => (
                <option key={colorOption.value} value={colorOption.value}>
                  {colorOption.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="tool-section">
            <span>Width:</span>
            <input 
              type="range" 
              min="1" 
              max="10" 
              value={lineWidth} 
              onChange={(e) => setLineWidth(parseInt(e.target.value))} 
            />
            <span>{lineWidth}px</span>
          </div>
          
          <div className="tool-section">
            <button onClick={clearCanvas}>Clear</button>
            <button onClick={saveAnnotation} disabled={annotations.length === 0}>
              Save Annotation
            </button>
            <button onClick={genPdf}>Generate PDF</button>
          </div>
        </div>
      )}
      
      <div className="canvas-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{ 
            cursor: user && user.role === 'admin' ? (tool === 'select' ? 'default' : 'crosshair') : 'default',
            maxWidth: '100%',
            height: 'auto',
            border: '1px solid #ccc'
          }}
        />
      </div>
      
      {/* Add a color legend for reference */}
      <div className="color-legend" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <h4>Color Legend</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {colorPalette.map(colorOption => (
            <div key={colorOption.value} style={{ display: 'flex', alignItems: 'center', marginRight: '15px' }}>
              <div 
                style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: colorOption.value,
                  marginRight: '8px',
                  border: '1px solid #ddd'
                }}
              ></div>
              <span>{colorOption.name}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="debug-panel">
        <h4>Debug Information</h4>
        <textarea 
          readOnly 
          value={debugInfo} 
          rows="4"
          placeholder="Debug information will appear here..."
        />
        <div>
          <strong>Annotations count:</strong> {annotations.length}
        </div>
        <div>
          <strong>Current tool:</strong> {tool}
        </div>
        <div>
          <strong>Current annotation type:</strong> {
            colorPalette.find(c => c.value === color)?.name || 'Unknown'
          }
        </div>
        <div>
          <strong>Canvas size:</strong> {canvasRef.current ? `${canvasRef.current.width}×${canvasRef.current.height}` : 'Not loaded'}
        </div>
      </div>
      
      {submission.reportUrl && (
        <p>
          <strong>Report:</strong> 
          <a
            className="btn btn-success"
            href={`http://localhost:5000${submission.reportUrl}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download PDF
          </a>
        </p>
      )}
    </div>
  );
};

export default SubmissionView;