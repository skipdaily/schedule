import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Project, Attachment } from '../types';

// Helper to convert image URL to base64
const urlToBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const generateProjectPDF = async (project: Project) => {
  // Initialize PDF in landscape mode to fit the matrix
  const doc = new jsPDF({ orientation: 'landscape' });

  // --- Header Section ---
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text(project.name, 14, 15);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate 500
  const dateStr = new Date().toLocaleDateString();
  doc.text(`Generated: ${dateStr}`, 297 - 14, 15, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85); // Slate 700
  doc.text(`Address: ${project.address}`, 14, 22);
  
  if (project.projectedCompletionDate) {
      doc.text(`Target Completion: ${project.projectedCompletionDate}`, 14, 27);
  }

  // --- Statistics Summary ---
  const tasks = Object.values(project.tasks);
  const ready = tasks.filter(t => t.status === 'ready').length;
  const progress = tasks.filter(t => t.status === 'in-progress').length;
  const done = tasks.filter(t => t.status === 'complete').length;
  const total = tasks.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(`Overall Progress: ${percent}%  |  Ready: ${ready}  |  In Progress: ${progress}  |  Complete: ${done}`, 14, 35);

  // --- Interior Matrix Table ---
  const interiorTrades = project.trades.filter(t => t.scope === 'interior');
  
  // Define Columns
  const columns = [
      { header: 'Unit', dataKey: 'unit' },
      ...interiorTrades.map(t => ({ header: t.name, dataKey: t.id }))
  ];

  // Define Rows
  const body = project.units.map(unit => {
      const row: Record<string, string> = { unit: unit.name };
      
      interiorTrades.forEach(trade => {
          const key = `${unit.id}_${trade.id}`;
          const task = project.tasks[key];
          
          let cellText = '';
          
          if (task) {
              const dayAbbr = ['sun', 'mon', 'tues', 'wed', 'thurs', 'fri', 'sat'];

              // Safe parse for Expected Start Date (YYYY-MM-DD) to avoid timezone shifts
              let startStr = '';
              if (task.expectedStartDate) {
                  const parts = task.expectedStartDate.split('-');
                  if (parts.length === 3) {
                      const y = parseInt(parts[0], 10);
                      const m = parseInt(parts[1], 10);
                      const d = parseInt(parts[2], 10);
                      const dateObj = new Date(y, m - 1, d);
                      startStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                      startStr += ` ${dayAbbr[dateObj.getDay()]}`;
                  }
              }

              // Safe parse for Expected Finish Date
              let finishStr = '';
              if (task.expectedFinishDate) {
                  const parts = task.expectedFinishDate.split('-');
                  if (parts.length === 3) {
                      const y = parseInt(parts[0], 10);
                      const m = parseInt(parts[1], 10);
                      const d = parseInt(parts[2], 10);
                      const dateObj = new Date(y, m - 1, d);
                      finishStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                      finishStr += ` ${dayAbbr[dateObj.getDay()]}`;
                  }
              }

              if (task.status === 'complete') {
                  if (task.completedDate) {
                       const d = new Date(task.completedDate);
                       cellText = `Done ${d.getMonth() + 1}/${d.getDate()}`;
                  } else {
                      cellText = 'DONE';
                  }
              } else if (task.status === 'in-progress') {
                  cellText = `Work ${task.percentComplete || 0}%`;
                  if (startStr && finishStr) {
                      cellText += `\nS: ${startStr}\nF: ${finishStr}`;
                  } else if (startStr) {
                      cellText += `\nS: ${startStr}`;
                  }
              } else if (task.status === 'ready') {
                  cellText = 'READY';
                  if (startStr && finishStr) {
                      cellText += `\nS: ${startStr}\nF: ${finishStr}`;
                  } else if (startStr) {
                      cellText += `\nS: ${startStr}`;
                  }
              } else if (task.status === 'not-started') {
                  if (startStr && finishStr) {
                      cellText = `S: ${startStr}\nF: ${finishStr}`;
                  } else if (startStr) {
                      cellText = `S: ${startStr}`;
                  }
              }
          }
          row[trade.id] = cellText;
      });
      return row;
  });

  // Generate Table
  autoTable(doc, {
      startY: 40,
      columns: columns,
      body: body,
      theme: 'grid',
      styles: { 
          fontSize: 6, // Decreased font size to prevent cutoff
          cellPadding: 1,
          lineWidth: 0.1,
          lineColor: [226, 232, 240], // Slate 200
          overflow: 'linebreak', // Ensure wrapping for long text
          halign: 'center',
          valign: 'middle'
      },
      headStyles: { 
          fillColor: [79, 70, 229], // Indigo 600
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          fontSize: 6, // Match body font
          cellPadding: 1
      },
      columnStyles: {
          unit: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 15 } // Fixed width for Unit column
      },
      didParseCell: (data) => {
          // Skip header row
          if (data.section === 'head') return;
          
          // Color coding for cells based on content
          const text = data.cell.raw as string;
          
          if (text && typeof text === 'string') {
            if (text.includes('Done') || text === 'DONE') {
                data.cell.styles.fillColor = [209, 250, 229]; // Emerald 100
                data.cell.styles.textColor = [6, 95, 70];    // Emerald 800
            } else if (text.includes('Work')) {
                data.cell.styles.fillColor = [254, 243, 199]; // Amber 100
                data.cell.styles.textColor = [146, 64, 14];   // Amber 800
            } else if (text.startsWith('READY')) {
                data.cell.styles.fillColor = [219, 234, 254]; // Blue 100
                data.cell.styles.textColor = [30, 64, 175];   // Blue 800
                data.cell.styles.fontStyle = 'bold';
            }
          }
      }
  });

  // Add attachments (images only - PDFs can't be embedded)
  const imageAttachments = (project.attachments || []).filter(a => a.type === 'image');
  
  if (imageAttachments.length > 0) {
    // Pre-fetch all images and convert to base64
    const imageDataPromises = imageAttachments.map(async (attachment) => ({
      attachment,
      dataUrl: await urlToBase64(attachment.url)
    }));
    const imageData = await Promise.all(imageDataPromises);
    const validImages = imageData.filter(d => d.dataUrl !== null);
    
    if (validImages.length > 0) {
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const titleHeight = 12; // space for caption below title area
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2 - titleHeight;
      
      for (const { attachment, dataUrl } of validImages) {
        try {
          // Each image gets its own full page
          doc.addPage();
          
          // Add caption/title at the top
          doc.setFontSize(10);
          doc.setTextColor(30, 41, 59);
          doc.text(attachment.name, margin, margin + 6);
          
          // Get image dimensions and calculate size to fill the page
          const imgProps = doc.getImageProperties(dataUrl!);
          const aspectRatio = imgProps.height / imgProps.width;
          
          let imgWidth = availableWidth;
          let imgHeight = imgWidth * aspectRatio;
          
          // If height exceeds available space, scale down by height instead
          if (imgHeight > availableHeight) {
            imgHeight = availableHeight;
            imgWidth = imgHeight / aspectRatio;
          }
          
          // Center the image on the page
          const xOffset = margin + (availableWidth - imgWidth) / 2;
          const yOffset = margin + titleHeight + (availableHeight - imgHeight) / 2;
          
          doc.addImage(dataUrl!, 'JPEG', xOffset, yOffset, imgWidth, imgHeight);
          
        } catch (e) {
          console.error('Failed to add image to PDF:', attachment.name, e);
        }
      }
    }
  }

  // Save the PDF
  const filename = `${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_schedule.pdf`;
  doc.save(filename);
};