# Generated manually to track existing ProcessedComplaint table
from django.db import migrations, models


def create_processed_complaint_table(apps, schema_editor):
    """No-op function to mark existing table as tracked"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_remove_stockoutorder_complaint_no_unique'),
    ]

    operations = [
        # Use RunPython to mark existing table as tracked
        migrations.RunPython(
            code=create_processed_complaint_table,
            reverse_code=migrations.RunPython.noop
        ),
    ]
