import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { COLORS } from '../theme/colors';

let isPrinting = false;

/**
 * Generate HTML content for combined sales report PDF
 */
const generateSalesReportHTML = (salesRequests) => {
  // Filter only approved requests and group by technician
  const approvedRequests = salesRequests.filter(request => request.status === 'APPROVED');
  
  if (approvedRequests.length === 0) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>SALES REPORT</title>
        <style>
          body {
            font-family: 'Helvetica', Arial, sans-serif;
            margin: 20px;
            background-color: white;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .title {
            font-size: 24px;
            color: ${COLORS.primary};
            font-weight: bold;
            margin-bottom: 10px;
          }
          .subtitle {
            font-size: 14px;
            color: #666;
            margin-bottom: 20px;
          }
          .no-data {
            text-align: center;
            padding: 40px;
            color: #666;
            font-size: 16px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">SALES REPORT</div>
          <div class="subtitle">Generated on ${new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</div>
        </div>
        <div class="no-data">No approved sales requests found for this period.</div>
      </body>
      </html>
    `;
  }

  // Group by technician
  const groupedByTechnician = approvedRequests.reduce((groups, request) => {
    const technicianName = request.technician_name || 'Unknown Technician';
    if (!groups[technicianName]) {
      groups[technicianName] = [];
    }
    groups[technicianName].push(request);
    return groups;
  }, {});

  // Calculate grand total
  const grandTotal = approvedRequests.reduce((total, request) => {
    return total + (parseFloat(request.total_amount) || 0);
  }, 0);

  // Generate HTML for each technician section
  const technicianSections = Object.entries(groupedByTechnician).map(([technicianName, requests]) => {
    const technicianTotal = requests.reduce((total, request) => {
      return total + (parseFloat(request.total_amount) || 0);
    }, 0);

    const requestRows = requests.map((request, index) => {
      const productDetails = request.products?.map((product, pIndex) => {
        const productTotal = (parseFloat(product.quantity) * parseFloat(product.mrp)) + parseFloat(product.service_charge || 0);
        return `
          <tr style="${pIndex % 2 === 0 ? 'background-color: #F8F9FA;' : ''}">
            <td style="padding: 4px; border: 1px solid #E8E8E8; font-size: 12px;">${product.product_code || 'N/A'}</td>
            <td style="padding: 4px; border: 1px solid #E8E8E8; font-size: 12px;">${product.product_name || 'N/A'}</td>
            <td style="padding: 4px; border: 1px solid #E8E8E8; text-align: center; font-size: 12px;">${product.quantity}</td>
            <td style="padding: 4px; border: 1px solid #E8E8E8; text-align: right; font-size: 12px;">Rs. ${parseFloat(product.mrp).toFixed(2)}</td>
            <td style="padding: 4px; border: 1px solid #E8E8E8; text-align: right; font-size: 12px;">Rs. ${parseFloat(product.service_charge || 0).toFixed(2)}</td>
            <td style="padding: 4px; border: 1px solid #E8E8E8; text-align: right; font-weight: bold; font-size: 12px;">Rs. ${productTotal.toFixed(2)}</td>
          </tr>
        `;
      }).join('') || '';

      return `
        <tr style="background-color: ${index % 2 === 0 ? '#FFFFFF' : '#F8F9FA'};">
          <td style="padding: 8px; border: 1px solid #E8E8E8; vertical-align: top;">
            <div style="font-weight: bold; font-size: 12px;">SR-${String(request.id).padStart(6, '0')}</div>
            <div style="font-size: 11px; color: #666;">${request.company_name}</div>
            <div style="font-size: 11px; color: #666;">${request.invoice_number}</div>
            ${request.compliant_number ? `<div style="font-size: 11px; color: ${COLORS.primary};">Compliant: ${request.compliant_number}</div>` : ''}
            <div style="font-size: 11px; color: #666;">${new Date(request.requested_at).toLocaleDateString('en-IN')}</div>
          </td>
          <td style="padding: 8px; border: 1px solid #E8E8E8; vertical-align: top;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: ${COLORS.primary}; color: white;">
                  <th style="padding: 4px; border: 1px solid #E8E8E8; text-align: center; font-size: 10px;">Code</th>
                  <th style="padding: 4px; border: 1px solid #E8E8E8; text-align: center; font-size: 10px;">Product</th>
                  <th style="padding: 4px; border: 1px solid #E8E8E8; text-align: center; font-size: 10px;">Qty</th>
                  <th style="padding: 4px; border: 1px solid #E8E8E8; text-align: center; font-size: 10px;">MRP</th>
                  <th style="padding: 4px; border: 1px solid #E8E8E8; text-align: center; font-size: 10px;">SC</th>
                  <th style="padding: 4px; border: 1px solid #E8E8E8; text-align: center; font-size: 10px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${productDetails}
              </tbody>
            </table>
          </td>
          <td style="padding: 8px; border: 1px solid #E8E8E8; text-align: right; font-weight: bold; vertical-align: top;">
            Rs. ${parseFloat(request.total_amount || 0).toFixed(2)}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div style="margin-bottom: 30px; page-break-inside: avoid;">
        <div style="background-color: ${COLORS.primary}; color: white; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
          <h2 style="margin: 0; font-size: 18px;">${technicianName}</h2>
          <div style="font-size: 12px; opacity: 0.9;">${requests.length} Approved Request(s) | Total: Rs. ${technicianTotal.toFixed(2)}</div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <thead>
            <tr style="background-color: #2C2C2C; color: white;">
              <th style="padding: 8px; border: 1px solid #E8E8E8; text-align: left; font-size: 12px;">Request Details</th>
              <th style="padding: 8px; border: 1px solid #E8E8E8; text-align: left; font-size: 12px;">Products</th>
              <th style="padding: 8px; border: 1px solid #E8E8E8; text-align: right; font-size: 12px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${requestRows}
          </tbody>
          <tfoot>
            <tr style="background-color: #2C2C2C; color: white; font-weight: bold;">
              <td colspan="2" style="padding: 8px; border: 1px solid #E8E8E8; text-align: right;">Technician Total:</td>
              <td style="padding: 8px; border: 1px solid #E8E8E8; text-align: right;">Rs. ${technicianTotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>SALES REPORT</title>
      <style>
        body {
          font-family: 'Helvetica', Arial, sans-serif;
          margin: 20px;
          background-color: white;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .title {
          font-size: 24px;
          color: ${COLORS.primary};
          font-weight: bold;
          margin-bottom: 10px;
        }
        .subtitle {
          font-size: 14px;
          color: #666;
          margin-bottom: 20px;
        }
        .summary {
          background-color: #F8F9FA;
          border: 2px solid ${COLORS.primary};
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 30px;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .summary-label {
          font-weight: bold;
          color: #333;
        }
        .summary-value {
          color: ${COLORS.primary};
          font-weight: bold;
        }
        .grand-total {
          background-color: ${COLORS.primary};
          color: white;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 30px;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 10px;
          color: #666;
          border-top: 1px solid #E8E8E8;
          padding-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">SALES REPORT</div>
        <div class="subtitle">Approved Sales Requests - ${new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })}</div>
      </div>

      <div class="summary">
        <div class="summary-row">
          <span class="summary-label">Total Technicians:</span>
          <span class="summary-value">${Object.keys(groupedByTechnician).length}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Total Approved Requests:</span>
          <span class="summary-value">${approvedRequests.length}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Report Period:</span>
          <span class="summary-value">All Time</span>
        </div>
      </div>

      ${technicianSections}

      <div class="grand-total">
        GRAND TOTAL: Rs. ${grandTotal.toFixed(2)}
      </div>

      <div class="footer">
        Generated on ${new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })} | This is an electronically generated document.
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate and share/download combined sales report PDF
 */
export const generateSalesReportPDF = async (salesRequests) => {
  if (isPrinting) {
    return { 
      success: false, 
      message: 'A PDF generation is already in progress. Please wait...' 
    };
  }

  try {
    isPrinting = true;

    // Validate sales requests data
    if (!salesRequests || !Array.isArray(salesRequests)) {
      throw new Error('Invalid sales requests data');
    }

    // Generate HTML content
    const htmlContent = generateSalesReportHTML(salesRequests);
    const fileName = `SalesReport_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.pdf`;

    // Generate PDF with specific dimensions
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      width: 595, // A4 width in points
      height: 842, // A4 height in points
      base64: false
    });

    // Share/save the PDF
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: fileName,
      UTI: 'com.adobe.pdf'
    });

    return { 
      success: true, 
      uri: uri,
      fileName: fileName
    };

  } catch (error) {
    console.error('Error generating sales report PDF:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to generate sales report. Please try again.' 
    };
  } finally {
    isPrinting = false;
  }
};
