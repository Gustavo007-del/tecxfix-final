# Generated manually to track existing ProcessedComplaint table
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_remove_stockoutorder_complaint_no_unique'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProcessedComplaint',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('complaint_no', models.CharField(db_index=True, max_length=50, unique=True)),
                ('technician_name', models.CharField(max_length=100)),
                ('product_code', models.CharField(max_length=50)),
                ('part_name', models.CharField(max_length=200)),
                ('quantity_reduced', models.IntegerField()),
                ('processed_date', models.DateTimeField(auto_now_add=True)),
                ('stock_reduced', models.BooleanField(default=True)),
                ('processing_notes', models.TextField(blank=True)),
            ],
            options={
                'ordering': ['-processed_date'],
                'indexes': [
                    models.Index(fields=['complaint_no', 'processed_date'], name='proc_complaint_date_idx'),
                    models.Index(fields=['technician_name', 'processed_date'], name='proc_tech_date_idx'),
                    models.Index(fields=['stock_reduced'], name='proc_stock_idx'),
                ],
                'verbose_name': 'Processed Complaint',
                'verbose_name_plural': 'Processed Complaints',
            },
        ),
    ]
