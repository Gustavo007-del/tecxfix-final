# E:\study\techfix\backend\api\sales_pdf_generator.py
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, 
    Spacer, PageBreak
)
from reportlab.lib import colors
from datetime import datetime
import io

def generate_sales_request_pdf(sales_request):
    """
    Generate PDF for sales request.
    Returns: PDF file bytes
    """
    
    # Create PDF in memory
    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        pdf_buffer, 
        pagesize=A4, 
        topMargin=0.5*inch, 
        bottomMargin=0.5*inch
    )
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#F4D03F'),
        spaceAfter=12,
        alignment=1,  # Center
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#2C2C2C'),
        spaceAfter=8,
        spaceBefore=12,
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=4,
    )
    
    # Title
    title = Paragraph("SALES REQUEST RECEIPT", title_style)
    elements.append(title)
    elements.append(Spacer(1, 0.2*inch))
    
    # Status Badge
    status_color = '#27AE60' if sales_request.status == 'APPROVED' else '#E74C3C'
    status_style = ParagraphStyle(
        'StatusStyle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.white,
        backgroundColor=colors.HexColor(status_color),
        alignment=1,
        spaceAfter=12
    )
    status_badge = Paragraph(f"Status: {sales_request.status}", status_style)
    elements.append(status_badge)
    
    # Request Information
    elements.append(Paragraph("Request Information", heading_style))
    
    request_info_data = [
        ['Request ID:', f'SR-{str(sales_request.id).zfill(6)}'],
        ['Technician:', sales_request.technician.get_full_name() or sales_request.technician.username],
        ['Company:', sales_request.company_name],
        ['Type:', sales_request.type.title()],
        ['Invoice Number:', sales_request.invoice_number or 'N/A'],
        ['Date Requested:', sales_request.requested_at.strftime('%d-%m-%Y %H:%M:%S')],
    ]
    
    if sales_request.compliant_number:
        request_info_data.append(['Compliant Number:', sales_request.compliant_number])
    
    if sales_request.customer_name:
        request_info_data.append(['Customer Name:', sales_request.customer_name])
    
    if sales_request.remarks:
        request_info_data.append(['Remarks:', sales_request.remarks])
    
    if sales_request.reviewed_at:
        request_info_data.append(['Date Reviewed:', sales_request.reviewed_at.strftime('%d-%m-%Y %H:%M:%S')])
        if sales_request.approved_by:
            request_info_data.append(['Reviewed By:', sales_request.approved_by.get_full_name() or sales_request.approved_by.username])
    
    request_info_table = Table(request_info_data, colWidths=[2*inch, 4*inch])
    request_info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E8E8E8')),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#F8F9FA')]),
    ]))
    
    elements.append(request_info_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Products Table
    elements.append(Paragraph("Products Details", heading_style))
    
    products_data = [['Product Code', 'Product Name', 'Quantity', 'MRP', 'Service Charge', 'Total']]
    grand_total = 0
    
    for product in sales_request.products.all():
        product_total = (product.quantity * product.mrp) + product.service_charge
        grand_total += product_total
        
        products_data.append([
            str(product.product_code),
            str(product.product_name),
            str(product.quantity),
            f"¥{product.mrp:.2f}",
            f"¥{product.service_charge:.2f}",
            f"¥{product_total:.2f}"
        ])
    
    # Add total row
    products_data.extend([
        ['', '', '', '', '', ''],
        ['', '', '', '', 'Subtotal:', f"¥{grand_total:.2f}"],
    ])
    
    products_table = Table(products_data, colWidths=[1.2*inch, 2.5*inch, 0.8*inch, 0.8*inch, 1.2*inch, 1.2*inch])
    products_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F4D03F')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#2C2C2C')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E8E8E8')),
        ('FONTNAME', (0, -2), (-1, -2), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -2), (-1, -2), 11),
        ('BACKGROUND', (0, -2), (-1, -2), colors.HexColor('#F8F9FA')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -3), [colors.white, colors.HexColor('#F8F9FA')]),
    ]))
    
    elements.append(products_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Grand Total
    grand_total_data = [['', 'GRAND TOTAL:', f"¥{grand_total:.2f}"]]
    grand_total_table = Table(grand_total_data, colWidths=[4*inch, 1.5*inch, 1.5*inch])
    grand_total_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 14),
        ('TEXTCOLOR', (1, 0), (-1, 0), colors.HexColor('#F4D03F')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2C2C2C')),
        ('GRID', (0, 0), (-1, -1), 2, colors.HexColor('#F4D03F')),
    ]))
    
    elements.append(grand_total_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Footer
    footer = Paragraph(
        f"Generated on {datetime.now().strftime('%d-%m-%Y %H:%M:%S')} | This is an electronically generated document.",
        ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=1)
    )
    elements.append(footer)
    
    # Build PDF
    doc.build(elements)
    
    # Return PDF bytes
    pdf_buffer.seek(0)
    return pdf_buffer.getvalue()
