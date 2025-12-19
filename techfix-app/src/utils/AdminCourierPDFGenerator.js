// E:\study\techfix\techfix-app\src\utils\AdminCourierPDFGenerator.js
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Generate HTML template for admin courier invoice
 * Groups items by technician with proper formatting
 */
const generateAdminCourierHTML = (courierData) => {
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

    // Get technicians list
    const techniciansNames = courierData.technicians_info && courierData.technicians_info.length > 0
        ? courierData.technicians_info.map(t => t.first_name || t.username).join(', ')
        : 'N/A';

    // Group items by technician_id
    const itemsByTechnician = {};
    
    courierData.items.forEach((item) => {
        const techId = item.technician_id;
        
        if (!itemsByTechnician[techId]) {
            // Find technician info
            const techInfo = courierData.technicians_info?.find(t => t.id === techId);
            
            itemsByTechnician[techId] = {
                name: techInfo ? (techInfo.first_name || techInfo.username) : 'Unassigned',
                items: [],
                total: 0
            };
        }
        
        itemsByTechnician[techId].items.push(item);
        itemsByTechnician[techId].total += (item.qty * item.mrp);
    });

    // Generate items rows grouped by technician
    let itemsRows = '';
    let grandTotal = 0;
    
    Object.entries(itemsByTechnician).forEach(([techId, techGroup]) => {
        // Technician header row
        itemsRows += `
            <tr style="background-color: #1a4d63;">
                <td colspan="5" style="padding: 12px; border: 1px solid #0d3447; color: white; font-weight: 700; font-size: 14px;">
                    📦 ${techGroup.name}
                </td>
            </tr>`;

        // Items for this technician
        techGroup.items.forEach((item, itemIndex) => {
            const itemTotal = item.qty * item.mrp;
            const bgColor = itemIndex % 2 === 0 ? '#f9f9f9' : '#ffffff';
            
            itemsRows += `
                <tr style="background-color: ${bgColor};">
                    <td style="padding: 10px 12px; border: 1px solid #ddd; text-align: center; font-size: 12px;">
                        ${item.spare_id}
                    </td>
                    <td style="padding: 10px 12px; border: 1px solid #ddd;">
                        <strong style="font-size: 13px; color: #333;">${item.name}</strong><br/>
                        <span style="font-size: 11px; color: #666;">Brand: ${item.brand || 'N/A'}</span>
                        ${item.hsn ? `<br/><span style="font-size: 11px; color: #666;">HSN: ${item.hsn}</span>` : ''}
                    </td>
                    <td style="padding: 10px 12px; border: 1px solid #ddd; text-align: center; font-weight: 600; font-size: 13px;">
                        ${item.qty}
                    </td>
                    <td style="padding: 10px 12px; border: 1px solid #ddd; text-align: right; font-size: 12px;">
                        ₹${item.mrp.toFixed(2)}
                    </td>
                    <td style="padding: 10px 12px; border: 1px solid #ddd; text-align: right; font-weight: 600; color: #1a4d63; font-size: 13px;">
                        ₹${itemTotal.toFixed(2)}
                    </td>
                </tr>`;
        });

        // Subtotal for this technician
        itemsRows += `
            <tr style="background-color: #e3f2fd;">
                <td colspan="4" style="padding: 10px 12px; border: 1px solid #bdbdbd; text-align: right; font-weight: 700; font-size: 13px;">
                    Subtotal for ${techGroup.name}:
                </td>
                <td style="padding: 10px 12px; border: 1px solid #bdbdbd; text-align: right; font-weight: 700; color: #1976d2; font-size: 14px;">
                    ₹${techGroup.total.toFixed(2)}
                </td>
            </tr>`;

        grandTotal += techGroup.total;
    });

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
                .info-box-wide {
                    grid-column: 1 / -1;
                    background-color: #e3f2fd;
                    border-left-color: #2196f3;
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
                <h1>COURIER DISPATCH</h1>
                <div class="subtitle">Admin Copy - Items Grouped by Technician</div>
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
                        <div class="label">Created By</div>
                        <div class="value">
                            ${courierData.created_by_info?.first_name || courierData.created_by_info?.username || 'Admin'}
                        </div>
                    </div>
                    <div class="info-box">
                        <div class="label">Sent Date & Time</div>
                        <div class="value">${sentDate}</div>
                    </div>
                    <div class="info-box-wide">
                        <div class="label">Assigned Technicians (${courierData.technicians_info?.length || 0})</div>
                        <div class="value">${techniciansNames}</div>
                    </div>
                    <div class="info-box">
                        <div class="label">Received Date & Time</div>
                        <div class="value">${receivedDate}</div>
                    </div>
                </div>
            </div>

            <!-- Items Table -->
            <div class="section-title">Items Details by Technician</div>
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
                        <td style="text-align: right; border: 1px solid #ddd; color: #4caf50;">₹${grandTotal.toFixed(2)}</td>
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
 * Request storage permission for Android
 */
const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                {
                    title: "Storage Permission",
                    message: "App needs access to storage to save PDF files",
                    buttonNeutral: "Ask Me Later",
                    buttonNegative: "Cancel",
                    buttonPositive: "OK"
                }
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            console.warn('Storage permission error:', err);
            return false;
        }
    }
    return true;
};

/**
 * Generate and share/download PDF for admin courier
 */
export const generateAdminCourierPDF = async (courierData) => {
    try {
        console.log('Starting PDF generation for courier:', courierData.courier_id);
        
        // Validate courier data
        if (!courierData || !courierData.items || !Array.isArray(courierData.items)) {
            throw new Error('Invalid courier data: items missing or not an array');
        }

        // Request storage permission for Android
        const hasPermission = await requestStoragePermission();
        if (!hasPermission) {
            throw new Error('Storage permission not granted');
        }

        // Generate HTML content
        const htmlContent = generateAdminCourierHTML(courierData);
        const fileName = `Courier_${courierData.courier_id}_${Date.now()}.pdf`;

        console.log('Generating PDF with filename:', fileName);

        // Generate PDF with specific dimensions
        const { uri } = await Print.printToFileAsync({
            html: htmlContent,
            base64: false,
            width: 612,   // 8.5in * 72dpi
            height: 792,  // 11in * 72dpi
        });

        console.log('PDF generated successfully at:', uri);

        // Check if sharing is available
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
            console.log('Sharing PDF...');
            // Share/save the PDF
            await Sharing.shareAsync(uri, {
                mimeType: 'application/pdf',
                dialogTitle: `Download ${fileName}`,
                UTI: 'com.adobe.pdf'
            });
            
            return { success: true, uri, fileName };
        } else {
            console.log('Sharing not available on this platform');
            return { 
                success: true, 
                uri, 
                fileName,
                message: 'PDF generated but sharing not available' 
            };
        }
    } catch (error) {
        console.error('Error generating admin PDF:', error);
        
        // Provide specific error messages
        if (error.message.includes('permission') || error.message.includes('EACCES')) {
            throw new Error('Storage permission denied. Please enable storage permissions in app settings.');
        } else if (error.message.includes('ENOSPC')) {
            throw new Error('Not enough storage space available.');
        } else if (error.message.includes('ENOENT')) {
            throw new Error('Could not create PDF file. Directory does not exist.');
        } else {
            throw new Error(`Failed to generate PDF: ${error.message}`);
        }
    }
};

/**
 * Generate PDF for printing (without sharing dialog)
 */
export const printAdminCourierPDF = async (courierData) => {
    try {
        console.log('Starting print for courier:', courierData.courier_id);
        
        // Validate courier data
        if (!courierData || !courierData.items || !Array.isArray(courierData.items)) {
            throw new Error('Invalid courier data: items missing or not an array');
        }

        const htmlContent = generateAdminCourierHTML(courierData);

        // Print directly
        await Print.printAsync({
            html: htmlContent
        });

        return { success: true };
    } catch (error) {
        console.error('Error printing admin PDF:', error);
        throw new Error(`Failed to print PDF: ${error.message}`);
    }
};