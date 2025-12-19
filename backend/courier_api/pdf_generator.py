# E:\study\techfix\backend\courier_api\pdf_generator.py
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, 
    Spacer, PageBreak
)
from reportlab.lib import colors
from datetime import datetime
from django.core.files.base import ContentFile
import io

def generate_courier_pdf(courier_transaction):
    """
    Generate PDF for courier transaction.
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
        textColor=colors.HexColor('#1a4d63'),
        spaceAfter=12,
        alignment=1,  # Center
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#1a4d63'),
        spaceAfter=6,
        spaceBefore=6,
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=4,
    )
    
    # Title
    title = Paragraph("COURIER TRANSACTION RECEIPT", title_style)
    elements.append(title)
    elements.append(Spacer(1, 0.2*inch))
    
    # Header Information
    header_data = [
        ['Courier ID:', str(courier_transaction.courier_id), 'Date:', datetime.now().strftime('%d-%m-%Y')],
        ['Sent By:', courier_transaction.created_by.get_full_name() or courier_transaction.created_by.username, 'Time:', datetime.now().strftime('%H:%M:%S')],
    ]
    
    header_table = Table(header_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 2*inch])
    header_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
    ]))
    
    elements.append(header_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Technicians
    tech_list = ', '.join([t.get_full_name() or t.username for t in courier_transaction.technicians.all()])
    elements.append(Paragraph(f"Assigned to: {tech_list}", normal_style))
    elements.append(Spacer(1, 0.15*inch))
    
    # Items Table
    elements.append(Paragraph("Items Sent:", heading_style))
    
    items_data = [['Spare ID', 'Item Name', 'Brand', 'Qty', 'MRP', 'Total']]
    total_amount = 0
    
    for item in courier_transaction.items:
        spare_id = item.get('spare_id', '')
        name = item.get('name', '')
        brand = item.get('brand', '')
        qty = item.get('qty', 0)
        mrp = item.get('mrp', 0)
        total = qty * mrp
        total_amount += total
        
        items_data.append([
            str(spare_id),
            str(name),
            str(brand),
            str(qty),
            f"₹{mrp:.2f}",
            f"₹{total:.2f}"
        ])
    
    # Add total row
    items_data.append(['', '', '', '', 'TOTAL:', f"₹{total_amount:.2f}"])
    
    items_table = Table(items_data, colWidths=[1.2*inch, 2*inch, 1.2*inch, 0.8*inch, 1*inch, 1.2*inch])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a4d63')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f5f5f5')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 11),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f0f0f0')]),
    ]))
    
    elements.append(items_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Notes (if any)
    if courier_transaction.notes:
        elements.append(Paragraph("Notes:", heading_style))
        elements.append(Paragraph(courier_transaction.notes, normal_style))
    
    # Footer
    elements.append(Spacer(1, 0.3*inch))
    footer = Paragraph(
        f"Generated on {datetime.now().strftime('%d-%m-%Y %H:%M:%S')}This is an electronically generated document.",
        ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=1)
    )
    elements.append(footer)
    
    # Build PDF
    doc.build(elements)
    
    # Return PDF bytes
    pdf_buffer.seek(0)
    return pdf_buffer.getvalue()