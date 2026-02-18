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
  try {
  // Initialize PDF in landscape mode to fit the matrix
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // --- Compact Header ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(project.name, margin, 12);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin, 12, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const headerParts = [project.address];
  if (project.projectedCompletionDate) headerParts.push(`Target: ${project.projectedCompletionDate}`);
  doc.text(headerParts.join('  •  '), margin, 18);

  // --- Statistics Bar ---
  const tasks = Object.values(project.tasks);
  const done = tasks.filter(t => t.status === 'complete').length;
  const total = tasks.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const progress = tasks.filter(t => t.status === 'in-progress').length;
  const ready = tasks.filter(t => t.status === 'ready').length;

  const barY = 22;
  const barWidth = pageWidth - margin * 2;
  const barHeight = 4;

  // Background bar
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, barY, barWidth, barHeight, 1, 1, 'F');
  // Progress fill
  if (percent > 0) {
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.roundedRect(margin, barY, barWidth * (percent / 100), barHeight, 1, 1, 'F');
  }
  // Progress label
  doc.setFontSize(6);
  doc.setTextColor(30, 41, 59);
  doc.text(`${percent}% Complete  •  ${done}/${total} tasks  •  ${progress} in progress  •  ${ready} ready`, margin, barY + barHeight + 4);

  // --- Legend ---
  const legendY = barY + barHeight + 7;
  const legendItems = [
    { symbol: '✓', label: 'Complete', fg: [22, 101, 52], bg: [220, 252, 231] },
    { symbol: '▶', label: 'In Progress', fg: [133, 77, 14], bg: [254, 249, 195] },
    { symbol: '●', label: 'Ready', fg: [30, 64, 175], bg: [219, 234, 254] },
  ];
  let legendX = pageWidth - margin;
  doc.setFontSize(5.5);
  // Draw right-to-left
  for (let i = legendItems.length - 1; i >= 0; i--) {
    const item = legendItems[i];
    const labelW = doc.getTextWidth(` ${item.label}`);
    const chipW = labelW + 5;
    legendX -= chipW + 2;
    doc.setFillColor(item.bg[0], item.bg[1], item.bg[2]);
    doc.roundedRect(legendX, legendY - 2.5, chipW, 3.5, 0.5, 0.5, 'F');
    doc.setTextColor(item.fg[0], item.fg[1], item.fg[2]);
    doc.text(`${item.symbol} ${item.label}`, legendX + 1, legendY);
  }

  // --- Helper: format date compactly ---
  const dayLetters = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];
  const fmtDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m - 1, d);
    return `${dateObj.getMonth() + 1}/${dateObj.getDate()} ${dayLetters[dateObj.getDay()]}`;
  };

  // --- Interior Matrix Table ---
  const interiorTrades = project.trades.filter(t => t.scope === 'interior').sort((a, b) => a.orderIndex - b.orderIndex);
  const tradeCount = interiorTrades.length;
  
  // Calculate column widths: fixed unit col, equal trade cols
  const unitColWidth = 22;
  const availableForTrades = pageWidth - margin * 2 - unitColWidth;
  const tradeColWidth = Math.max(12, availableForTrades / tradeCount);

  const columns = [
      { header: 'Unit', dataKey: 'unit' },
      ...interiorTrades.map(t => ({ header: t.name, dataKey: t.id }))
  ];

  // Build column styles with equal widths
  const colStyles: Record<string, any> = {
    unit: { 
      fontStyle: 'bold', 
      fillColor: [248, 250, 252], 
      cellWidth: unitColWidth,
      halign: 'left' as const
    }
  };
  interiorTrades.forEach(t => {
    colStyles[t.id] = { cellWidth: tradeColWidth };
  });

  // Build body rows with clean, compact text
  const body = project.units.map(unit => {
      const row: Record<string, string> = { unit: unit.name };
      
      interiorTrades.forEach(trade => {
          const key = `${unit.id}_${trade.id}`;
          const task = project.tasks[key];
          let cellText = '';
          
          if (task) {
              const start = fmtDate(task.expectedStartDate);
              const finish = fmtDate(task.expectedFinishDate);

              if (task.status === 'complete') {
                  if (task.completedDate) {
                      const d = new Date(task.completedDate);
                      cellText = `✓ ${d.getMonth() + 1}/${d.getDate()}`;
                  } else {
                      cellText = '✓ Done';
                  }
              } else if (task.status === 'in-progress') {
                  cellText = `▶ ${task.percentComplete || 0}%`;
                  if (start) cellText += `\n${start}`;
                  if (finish) cellText += `\n→ ${finish}`;
              } else if (task.status === 'ready') {
                  cellText = '● Ready';
                  if (start) cellText += `\n${start}`;
                  if (finish) cellText += `\n→ ${finish}`;
              } else {
                  // not-started
                  if (start && finish) {
                      cellText = `${start}\n→ ${finish}`;
                  } else if (start) {
                      cellText = start;
                  }
              }
          }
          row[trade.id] = cellText;
      });
      return row;
  });

  // Generate Table
  autoTable(doc, {
      startY: 36,
      columns: columns,
      body: body,
      theme: 'grid',
      tableWidth: pageWidth - margin * 2,
      margin: { left: margin, right: margin },
      styles: { 
          fontSize: 5.5,
          cellPadding: { top: 1.5, right: 1, bottom: 1.5, left: 1 },
          lineWidth: 0.2,
          lineColor: [203, 213, 225], // Slate 300
          overflow: 'linebreak',
          halign: 'center',
          valign: 'middle',
          minCellHeight: 10,
          textColor: [30, 41, 59]
      },
      headStyles: { 
          fillColor: [51, 65, 85], // Slate 700 (more professional than indigo)
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          fontSize: 5,
          cellPadding: { top: 2, right: 1, bottom: 2, left: 1 },
          minCellHeight: 8
      },
      columnStyles: colStyles,
      alternateRowStyles: {
          fillColor: [248, 250, 252] // Very subtle slate-50 stripe
      },
      didParseCell: (data) => {
          if (data.section === 'head') return;
          if (data.column.dataKey === 'unit') return; // Don't color the unit column

          const text = data.cell.raw as string;
          if (!text || typeof text !== 'string') return;

          if (text.startsWith('✓')) {
              data.cell.styles.fillColor = [220, 252, 231]; // Emerald 100
              data.cell.styles.textColor = [22, 101, 52];   // Emerald 800
              data.cell.styles.fontStyle = 'bold';
          } else if (text.startsWith('▶')) {
              data.cell.styles.fillColor = [254, 249, 195]; // Yellow 100
              data.cell.styles.textColor = [133, 77, 14];   // Amber 800
              data.cell.styles.fontStyle = 'bold';
          } else if (text.startsWith('●')) {
              data.cell.styles.fillColor = [219, 234, 254]; // Blue 100
              data.cell.styles.textColor = [30, 64, 175];   // Blue 800
              data.cell.styles.fontStyle = 'bold';
          }
      },
      didDrawPage: (data) => {
          // Footer on every page
          const pageCount = (doc as any).internal.getNumberOfPages();
          doc.setFontSize(6);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `${project.name}  •  Page ${data.pageNumber} of ${pageCount}`,
            pageWidth / 2, pageHeight - 5,
            { align: 'center' }
          );
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
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
};