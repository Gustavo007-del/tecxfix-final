// E:\study\techfix\techfix-app\src\utils\TechnicianPDFGenerator.js
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Generate HTML template for technician courier invoice
 */
const generateCourierHTML = (courierData, technicianName) => {
    const currentDate = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const sentDate = new Date(courierData.sent_time).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const receivedDate = courierData.received_time 
        ? new Date(courierData.received_time).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : 'Not Received';

    // Calculate total amount based on received quantity if available, otherwise use sent quantity
    const totalAmount = courierData.items.reduce((sum, item) => {
        const qty = item.received_qty !== undefined ? item.received_qty : item.qty;
        return sum + (qty * item.mrp);
    }, 0);

    // Generate items rows
    const itemsRows = courierData.items.map((item, index) => {
        const displayQty = item.received_qty !== undefined ? item.received_qty : item.qty;
        const itemTotal = displayQty * item.mrp;
        return `
            <tr style="${index % 2 === 0 ? 'background-color: #f9f9f9;' : 'background-color: #ffffff;'}">
                <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${item.spare_id}</td>
                <td style="padding: 12px; border: 1px solid #ddd;">
                    <strong>${item.name}</strong><br/>
                    <span style="font-size: 11px; color: #666;">Brand: ${item.brand || 'N/A'}</span>
                    ${item.hsn ? `<br/><span style="font-size: 11px; color: #666;">HSN: ${item.hsn}</span>` : ''}
                </td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: 600;">
                    ${displayQty}
                    ${item.received_qty !== undefined ? 
                        `<div style="font-size: 10px; color: #666; font-weight: normal;">of ${item.qty} sent</div>` : 
                        ''}
                </td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">₹${item.mrp.toFixed(2)}</td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: right; font-weight: 600; color: #1a4d63;">₹${itemTotal.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Helvetica', 'Arial', sans-serif;
                    padding: 20px;
                    background-color: #ffffff;
                    color: #333;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #1a4d63;
                    padding-bottom: 20px;
                }
                .header h1 {
                    color: #1a4d63;
                    font-size: 28px;
                    margin-bottom: 10px;
                }
                .header .subtitle {
                    color: #666;
                    font-size: 14px;
                }
                .info-section {
                    margin-bottom: 25px;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .info-box {
                    background-color: #f5f5f5;
                    padding: 12px;
                    border-radius: 6px;
                    border-left: 4px solid #1a4d63;
                }
                .info-box .label {
                    font-size: 11px;
                    color: #666;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                    font-weight: 600;
                }
                .info-box .value {
                    font-size: 14px;
                    color: #333;
                    font-weight: 600;
                }
                .status-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                    background-color: ${courierData.status === 'received' ? '#4caf50' : '#ff9800'};
                    color: white;
                }
                .section-title {
                    font-size: 16px;
                    font-weight: 700;
                    color: #1a4d63;
                    margin: 25px 0 15px 0;
                    padding-bottom: 8px;
                    border-bottom: 2px solid #e0e0e0;
                }
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                .items-table th {
                    background-color: #1a4d63;
                    color: white;
                    padding: 12px;
                    text-align: left;
                    font-size: 13px;
                    font-weight: 600;
                }
                .items-table th:nth-child(1),
                .items-table th:nth-child(3) {
                    text-align: center;
                }
                .items-table th:nth-child(4),
                .items-table th:nth-child(5) {
                    text-align: right;
                }
                .items-table td {
                    font-size: 12px;
                }
                .total-row {
                    background-color: #e8f5e9 !important;
                }
                .total-row td {
                    padding: 15px 12px !important;
                    font-size: 16px !important;
                    font-weight: 700 !important;
                }
                .notes-section {
                    background-color: #fff9e6;
                    padding: 15px;
                    border-radius: 6px;
                    border-left: 4px solid #ffc107;
                    margin-top: 20px;
                }
                .notes-section .label {
                    font-size: 13px;
                    font-weight: 600;
                    color: #666;
                    margin-bottom: 8px;
                }
                .notes-section .text {
                    font-size: 12px;
                    color: #333;
                    line-height: 1.5;
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e0e0e0;
                    text-align: center;
                    font-size: 11px;
                    color: #999;
                }
                @media print {
                    body {
                        padding: 10px;
                    }
                }
            </style>
        </head>
        <body>
            <!-- Header -->
            <div class="header">
                <h1>COURIER RECEIPT</h1>
                <div class="subtitle">Technician Copy</div>
            </div>

            <!-- Courier Information -->
            <div class="info-section">
                <div class="info-grid">
                    <div class="info-box">
                        <div class="label">Courier ID</div>
                        <div class="value">${courierData.courier_id}</div>
                    </div>
                    <div class="info-box">
                        <div class="label">Status</div>
                        <div class="value">
                            <span class="status-badge">
                                ${courierData.status === 'received' ? 'RECEIVED' : 'IN TRANSIT'}
                            </span>
                        </div>
                    </div>
                    <div class="info-box">
                        <div class="label">Sent By</div>
                        <div class="value">
                            ${courierData.created_by_info?.first_name || courierData.created_by_info?.username || 'Admin'}
                        </div>
                    </div>
                    <div class="info-box">
                        <div class="label">Sent Date & Time</div>
                        <div class="value">${sentDate}</div>
                    </div>
                    <div class="info-box">
                        <div class="label">Assigned To</div>
                        <div class="value">${technicianName}</div>
                    </div>
                    <div class="info-box">
                        <div class="label">Received Date & Time</div>
                        <div class="value">${receivedDate}</div>
                    </div>
                </div>
            </div>

            <!-- Items Table -->
            <div class="section-title">Items Details</div>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Spare ID</th>
                        <th>Item Description</th>
                        <th>Quantity</th>
                        <th>MRP (₹)</th>
                        <th>Total (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                    <tr class="total-row">
                        <td colspan="4" style="text-align: right; border: 1px solid #ddd;">GRAND TOTAL:</td>
                        <td style="text-align: right; border: 1px solid #ddd; color: #4caf50;">₹${totalAmount.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <!-- Notes Section (if exists) -->
            ${courierData.notes ? `
                <div class="notes-section">
                    <div class="label">📝 Notes:</div>
                    <div class="text">${courierData.notes}</div>
                </div>
            ` : ''}

            <!-- Footer -->
            <div class="footer">
                <p>Generated on ${currentDate}</p>
                <p>This is an electronically generated document</p>
            </div>
        </body>
        </html>
    `;
};

/**
 * Generate and share/download PDF for technician courier
 */
export const generateTechnicianCourierPDF = async (courierData, technicianName) => {
    try {
        // Generate HTML content
        const htmlContent = generateCourierHTML(courierData, technicianName);

        // Generate PDF
        const { uri } = await Print.printToFileAsync({
            html: htmlContent,
            base64: false
        });

        console.log('PDF generated at:', uri);

        // Check if sharing is available
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
            // Share/save the PDF
            await Sharing.shareAsync(uri, {
                mimeType: 'application/pdf',
                dialogTitle: `Courier_${courierData.courier_id}.pdf`,
                UTI: 'com.adobe.pdf'
            });
            
            return { success: true, uri };
        } else {
            // Fallback for platforms where sharing is not available
            console.log('Sharing not available on this platform');
            return { success: true, uri, message: 'PDF generated but sharing not available' };
        }
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
};

/**
 * Generate PDF for printing (without sharing dialog)
 */
export const printTechnicianCourierPDF = async (courierData, technicianName) => {
    try {
        const htmlContent = generateCourierHTML(courierData, technicianName);

        // Print directly
        await Print.printAsync({
            html: htmlContent
        });

        return { success: true };
    } catch (error) {
        console.error('Error printing PDF:', error);
        throw error;
    }
};