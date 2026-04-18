// E:\study\techfix\techfix-app\src\utils\SalesRequestPDFGenerator.js
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { COLORS } from '../theme/colors';

let isPrinting = false;

/**
 * Generate HTML content for sales request PDF
 */
const generateSalesRequestHTML = (salesRequest) => {
  const statusColor = salesRequest.status === 'APPROVED' ? '#27AE60' : '#E74C3C';
  const productsTotal = salesRequest.products?.reduce((total, product) => {
    const mrp = parseFloat(product.mrp) || 0;
    const serviceCharge = parseFloat(product.service_charge) || 0;
    const quantity = parseInt(product.quantity) || 0;
    return total + ((quantity * mrp) + serviceCharge);
  }, 0) || 0;

  const productsHTML = salesRequest.products?.map((product, index) => {
    // Handle mrp and service_charge as both string and number
    const mrp = parseFloat(product.mrp) || 0;
    const serviceCharge = parseFloat(product.service_charge) || 0;
    const quantity = parseInt(product.quantity) || 0;
    const productTotal = (quantity * mrp) + serviceCharge;
    
    return `
      <tr style="${index % 2 === 0 ? 'background-color: #F8F9FA;' : ''}">
        <td style="padding: 8px; border: 1px solid #E8E8E8; text-align: center;">${product.product_code || 'N/A'}</td>
        <td style="padding: 8px; border: 1px solid #E8E8E8;">${product.product_name || 'N/A'}</td>
        <td style="padding: 8px; border: 1px solid #E8E8E8; text-align: center;">${quantity}</td>
        <td style="padding: 8px; border: 1px solid #E8E8E8; text-align: right;">Rs. ${mrp.toFixed(2)}</td>
        <td style="padding: 8px; border: 1px solid #E8E8E8; text-align: right;">Rs. ${serviceCharge.toFixed(2)}</td>
        <td style="padding: 8px; border: 1px solid #E8E8E8; text-align: right; font-weight: bold;">Rs. ${productTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('') || '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>SALES REQUEST RECEIPT</title>
      <style>
        body {
          font-family: 'Helvetica', Arial, sans-serif;
          margin: 0;
          padding: 20px;
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
        .status-badge {
          display: inline-block;
          padding: 6px 12px;
          background-color: ${statusColor};
          color: white;
          border-radius: 4px;
          font-weight: bold;
          margin-bottom: 20px;
        }
        .info-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .info-table td {
          padding: 8px;
          border: 1px solid #E8E8E8;
        }
        .info-table td:first-child {
          background-color: #F8F9FA;
          font-weight: bold;
          width: 30%;
        }
        .products-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .products-table th {
          background-color: ${COLORS.primary};
          color: ${COLORS.dark};
          padding: 10px;
          border: 1px solid #E8E8E8;
          text-align: center;
          font-weight: bold;
        }
        .products-table td {
          padding: 8px;
          border: 1px solid #E8E8E8;
        }
        .total-row {
          background-color: #2C2C2C !important;
          color: white !important;
          font-weight: bold;
        }
        .total-row td {
          background-color: #2C2C2C !important;
          color: white !important;
        }
        .grand-total {
          background-color: ${COLORS.primary} !important;
          color: ${COLORS.dark} !important;
          font-size: 16px;
          font-weight: bold;
        }
        .grand-total td {
          background-color: ${COLORS.primary} !important;
          color: ${COLORS.dark} !important;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 10px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">SALES REQUEST RECEIPT</div>
        <div class="status-badge">Status: ${salesRequest.status || 'N/A'}</div>
      </div>

      <table class="info-table">
        <tr>
          <td>Request ID</td>
          <td>SR-${String(salesRequest.id || '000000').padStart(6, '0')}</td>
        </tr>
        <tr>
          <td>Technician</td>
          <td>${salesRequest.technician_name || 'N/A'}</td>
        </tr>
        <tr>
          <td>Company</td>
          <td>${salesRequest.company_name || 'N/A'}</td>
        </tr>
        <tr>
          <td>Type</td>
          <td>${salesRequest.type ? (typeof salesRequest.type === 'string' ? salesRequest.type.toUpperCase() : 'N/A') : 'N/A'}</td>
        </tr>
        <tr>
          <td>Invoice Number</td>
          <td>${salesRequest.invoice_number || 'N/A'}</td>
        </tr>
        ${salesRequest.compliant_number ? `
        <tr>
          <td>Compliant Number</td>
          <td>${salesRequest.compliant_number}</td>
        </tr>
        ` : ''}
        ${salesRequest.customer_name ? `
        <tr>
          <td>Customer Name</td>
          <td>${salesRequest.customer_name}</td>
        </tr>
        ` : ''}
        <tr>
          <td>Date Requested</td>
          <td>${salesRequest.requested_at ? new Date(salesRequest.requested_at).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : 'N/A'}</td>
        </tr>
        ${salesRequest.reviewed_at ? `
        <tr>
          <td>Date Reviewed</td>
          <td>${new Date(salesRequest.reviewed_at).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</td>
        </tr>
        ` : ''}
        ${salesRequest.remarks ? `
        <tr>
          <td>Remarks</td>
          <td>${salesRequest.remarks}</td>
        </tr>
        ` : ''}
      </table>

      <h3 style="color: ${COLORS.dark}; margin-bottom: 10px;">Products Details</h3>
      <table class="products-table">
        <thead>
          <tr>
            <th>Product Code</th>
            <th>Product Name</th>
            <th>Quantity</th>
            <th>MRP</th>
            <th>Service Charge</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${productsHTML}
          <tr class="total-row">
            <td colspan="5" style="text-align: right;">Subtotal:</td>
            <td style="text-align: right;">Rs. ${productsTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <table class="products-table">
        <tr class="grand-total">
          <td colspan="4" style="text-align: right;">GRAND TOTAL:</td>
          <td colspan="2" style="text-align: right;">Rs. ${productsTotal.toFixed(2)}</td>
        </tr>
      </table>

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
 * Generate and share/download PDF for sales request
 */
export const generateSalesRequestPDF = async (salesRequest) => {
  if (isPrinting) {
    return { 
      success: false, 
      message: 'A PDF generation is already in progress. Please wait...' 
    };
  }

  try {
    isPrinting = true;

    // Validate sales request data
    if (!salesRequest || !salesRequest.id) {
      throw new Error('Invalid sales request data');
    }

    // Only allow PDF for approved requests
    if (salesRequest.status !== 'APPROVED') {
      throw new Error('PDF download is only available for approved sales requests');
    }

    // Generate HTML content
    const htmlContent = generateSalesRequestHTML(salesRequest);
    const fileName = `SalesRequest_SR${String(salesRequest.id).padStart(6, '0')}_${salesRequest.company_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

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

    // Optionally, you can also save to documents directory
    // const fileUri = FileSystem.documentDirectory + fileName;
    // await FileSystem.moveAsync({
    //   from: uri,
    //   to: fileUri,
    // });

    return { 
      success: true, 
      uri: uri,
      fileName: fileName
    };

  } catch (error) {
    console.error('Error generating sales request PDF:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to generate PDF. Please try again.' 
    };
  } finally {
    isPrinting = false;
  }
};

/**
 * Generate PDF for printing (without sharing dialog)
 */
export const printSalesRequestPDF = async (salesRequest) => {
  if (isPrinting) {
    return { success: false, message: 'A print operation is already in progress. Please wait...' };
  }

  try {
    isPrinting = true;

    // Validate sales request data
    if (!salesRequest || !salesRequest.id) {
      throw new Error('Invalid sales request data');
    }

    // Only allow PDF for approved requests
    if (salesRequest.status !== 'APPROVED') {
      throw new Error('PDF printing is only available for approved sales requests');
    }

    // Generate HTML content
    const htmlContent = generateSalesRequestHTML(salesRequest);

    // Generate and print PDF
    await Print.printAsync({
      html: htmlContent,
      width: 595, // A4 width in points
      height: 842, // A4 height in points
      base64: false
    });

    return { success: true };

  } catch (error) {
    console.error('Error printing sales request PDF:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to prepare PDF for printing. Please try again.' 
    };
  } finally {
    isPrinting = false;
  }
};
